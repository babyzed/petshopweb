// server/gateways/melli.js — درگاه بانک ملی (پرداخت الکترونیک سداد / VPG)
// مستندات: https://sadad.shaparak.ir  (Request/PaymentRequest + Advice/Verify)
const crypto = require('crypto');
const { request } = require('./http');

const KEY = 'melli';
const LABEL = 'بانک ملی (سداد)';

const BASE = 'https://sadad.shaparak.ir';
const EP = {
  request: `${BASE}/VPG/api/v0/Request/PaymentRequest`,
  verify: `${BASE}/VPG/api/v0/Advice/Verify`,
  purchase: `${BASE}/VPG/Purchase`,
};

function configured(cfg) {
  return !!(cfg.merchant_id && cfg.terminal_id && cfg.terminal_key);
}

function fields() {
  return [
    { key: 'merchant_id', label: 'Merchant ID', secret: false },
    { key: 'terminal_id', label: 'Terminal ID', secret: false },
    { key: 'terminal_key', label: 'Terminal Key (کلید Base64)', secret: true },
  ];
}

// ---------- امضای داده با TripleDES/ECB/PKCS7 ----------
function signData(text, base64Key) {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 24) throw new Error('کلید ترمینال سداد باید ۲۴ بایتی (Base64) باشد.');
  const cipher = crypto.createCipheriv('des-ede3', key, null); // ECB
  cipher.setAutoPadding(true); // PKCS7
  return Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]).toString('base64');
}

// تاریخ محلی به فرمت مورد انتظار سداد: MM/dd/yyyy hh:mm:ss a
function localDateTime() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ampm}`;
}

// ---------- ایجاد پرداخت ----------
async function createPayment(cfg, { amountRial, orderId, orderCode, mobile, callbackUrl }) {
  const sign = signData(`${cfg.terminal_id};${orderId};${amountRial}`, cfg.terminal_key);
  const res = await request(EP.request, {
    json: {
      TerminalId: cfg.terminal_id,
      MerchantId: cfg.merchant_id,
      Amount: amountRial,
      SignData: sign,
      ReturnUrl: callbackUrl,
      LocalDateTime: localDateTime(),
      OrderId: Number(orderId),
      UserId: mobile ? Number(String(mobile).replace(/\D/g, '')) || undefined : undefined,
    },
  });

  const d = res.data || {};
  if (Number(d.ResCode) === 0 && d.Token) {
    return { ok: true, paymentUrl: `${EP.purchase}?Token=${encodeURIComponent(d.Token)}`, authority: d.Token };
  }
  return { ok: false, error: d.Description || errorMessage(d.ResCode), errorCode: d.ResCode };
}

// ---------- تایید پرداخت ----------
async function verifyPayment(cfg, { params }) {
  const token = String(params.token || params.Token || '').trim();
  if (!token) return { ok: false, error: 'توکن تراکنش سداد دریافت نشد.' };

  const res = await request(EP.verify, {
    json: { Token: token, SignData: signData(token, cfg.terminal_key) },
  });

  const d = res.data || {};
  if (Number(d.ResCode) === 0) {
    return {
      ok: true,
      refId: String(d.RetrivalRefNo || d.SystemTraceNo || token),
      traceNo: String(d.SystemTraceNo || ''),
      cardNumber: d.CustomerCardNumber || '',
      amountRial: Number(d.Amount) || 0,
      raw: d,
    };
  }
  return { ok: false, error: d.Description || errorMessage(d.ResCode), raw: d };
}

// ---------- تفسیر کال‌بک ----------
// سداد با POST و پارامترهای OrderId, token, ResCode برمی‌گردد
function parseCallback(req) {
  const p = { ...(req.query || {}), ...(req.body || {}) };
  const code = String(p.ResCode ?? p.rescode ?? '');
  return {
    params: p,
    orderCode: p.order || p.orderCode || '',
    orderId: Number(p.OrderId || p.orderId) || null,
    ok: code === '0',
    ref: p.token || p.Token || '',
    statusCode: code,
  };
}

const ERROR_MESSAGES = {
  '-1': 'خطای داخلی درگاه سداد',
  '0': 'موفق',
  '3': 'پذیرنده اینترنتی نامعتبر است',
  '23': 'کاربر انصراف داده است',
  '58': 'انجام تراکنش مربوطه توسط پایانه مجاز نیست',
  '61': 'مبلغ تراکنش از حد مجاز بیشتر است',
  '1000': 'ترتیب پارامترهای ارسالی صحیح نیست',
  '1001': 'مبلغ تراکنش نامعتبر است',
  '1002': 'خطا در سیستم؛ تراکنش ناموفق',
  '1003': 'آی‌پی پذیرنده نامعتبر است',
  '1004': 'شماره پذیرنده نامعتبر است',
  '1005': 'خطای دسترسی؛ لطفاً با پشتیبانی تماس بگیرید',
  '1006': 'خطا در سیستم',
  '1011': 'درخواست تکراری؛ شماره سفارش تکراری است',
  '1012': 'اطلاعات پذیرنده صحیح نیست',
  '1015': 'پاسخ خطای نامشخص از سمت مرکز',
  '1017': 'مبلغ تراکنش با مبلغ پرداخت‌شده مغایرت دارد',
  '1018': 'اشکال در تاریخ و ساعت سیستم',
  '1019': 'امکان پرداخت از طریق سیستم شتاب وجود ندارد',
  '1020': 'پذیرنده مجوز پذیرش کارت‌های بین‌المللی را ندارد',
  '1023': 'آدرس بازگشت پذیرنده نامعتبر است',
  '1024': 'مهر زمانی پذیرنده نامعتبر است',
  '1025': 'امضای دیجیتال پذیرنده نامعتبر است',
  '1026': 'درخواست نامعتبر است',
  '1030': 'دسترسی غیرمجاز',
  '1031': 'زمان جلسه به پایان رسیده است',
  '1032': 'شماره سفارش نامعتبر است',
  '1033': 'ترمینال غیرفعال است',
};

function errorMessage(code) {
  return ERROR_MESSAGES[String(code)] || `تراکنش بانک ملی ناموفق (${code})`;
}

async function testConnection(cfg) {
  if (!configured(cfg)) return { ok: false, message: 'اطلاعات درگاه بانک ملی (سداد) کامل نیست.' };
  try {
    signData('test', cfg.terminal_key);
    return { ok: true, message: 'اطلاعات درگاه بانک ملی (سداد) معتبر است و کلید ترمینال قابل استفاده است.' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = { key: KEY, label: LABEL, fields, configured, createPayment, verifyPayment, parseCallback, errorMessage, testConnection };
