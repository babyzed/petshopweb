// server/gateways/saman.js — درگاه بانک سامان (Sepehr REST / sep.ir)
// مستندات: https://developer.sep.ir
const { request } = require('./http');

const KEY = 'saman';
const LABEL = 'بانک سامان (سپ)';

function baseUrl(cfg) {
  return cfg.sandbox
    ? 'https://sep.shaparak.ir/sandbox/api/v1'
    : 'https://sep.shaparak.ir/api/v1';
}

function configured(cfg) {
  return !!cfg.terminal_id;
}

function fields() {
  return [
    { key: 'terminal_id', label: 'Terminal ID', secret: false },
    { key: 'sandbox', label: 'حالت تست (Sandbox)', type: 'boolean' },
  ];
}

// ---------- دریافت توکن دسترسی (سرور به سرور) ----------
async function getToken(cfg) {
  const res = await request(`${baseUrl(cfg)}/token`, { json: { terminalId: cfg.terminal_id } });
  if (res.status === 200 && res.data?.token) return res.data.token;
  throw new Error(res.data?.message || 'خطا در دریافت توکن سامان');
}

// ---------- ایجاد پرداخت ----------
async function createPayment(cfg, { amountRial, orderId, orderCode, description, mobile, email, callbackUrl }) {
  const token = await getToken(cfg);
  const res = await request(`${baseUrl(cfg)}/payments`, {
    json: {
      terminalId: cfg.terminal_id,
      amount: amountRial,
      callbackUrl,
      orderId: String(orderId),
      orderCode: String(orderCode),
      description: description || `پرداخت سفارش ${orderCode}`,
      mobile: mobile || undefined,
      email: email || undefined,
    },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 200 && res.data?.paymentUrl) {
    return { ok: true, paymentUrl: res.data.paymentUrl, authority: res.data.token || token };
  }
  return { ok: false, error: res.data?.message || res.data?.errorCode || 'خطا در ایجاد لینک پرداخت سامان' };
}

// ---------- تایید پرداخت ----------
async function verifyPayment(cfg, { params }) {
  const rrn = String(params.RRN || params.RefNum || params.rrn || '').trim();
  if (!rrn) return { ok: false, error: 'شناسه تراکنش (RRN) دریافت نشد.' };

  const token = await getToken(cfg);
  const res = await request(`${baseUrl(cfg)}/payments/${encodeURIComponent(rrn)}/verify`, {
    json: { terminalId: cfg.terminal_id },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 200 && res.data?.verified === true) {
    return {
      ok: true,
      refId: res.data.RRN || rrn,
      cardNumber: res.data.cardNumber || '',
      amountRial: Number(res.data.amount) || 0,
      raw: res.data,
    };
  }
  return { ok: false, error: res.data?.message || res.data?.errorCode || 'تایید پرداخت سامان ناموفق بود', raw: res.data };
}

// ---------- تفسیر کال‌بک بانک ----------
// سامان با GET/POST و پارامترهای Status/RRN/RefNum برمی‌گردد
function parseCallback(req) {
  const p = { ...(req.query || {}), ...(req.body || {}) };
  const status = String(p.Status ?? p.status ?? '');
  return {
    params: p,
    orderCode: p.order || p.orderCode || '',
    orderId: Number(p.orderId || p.OrderId) || null,
    ok: status === '0' || status === '2' || status.toUpperCase() === 'OK',
    ref: p.RRN || p.RefNum || '',
    statusCode: status,
  };
}

const ERROR_MESSAGES = {
  '-1': 'پارامترهای ارسالی نامعتبر هستند',
  '-2': 'ترمینال یافت نشد',
  '-3': 'پرداخت تایید نشد',
  '-4': 'تعداد درخواست‌ها از حد مجاز فراتر رفته',
  '-5': 'مبلغ پرداخت نامعتبر است',
  '-6': 'درخواست منقضی شده',
  '-7': 'خطای سمت سرور',
  '-8': 'نسخه API نامعتبر',
  '-9': 'آدرس callback نامعتبر',
  '-10': 'توکن منقضی شده',
  '-11': 'درخواست تکراری',
  '-12': 'IP ترمینال متفاوت است',
  '-13': 'امکان پرداخت با این مبلغ وجود ندارد',
  '-14': 'پرداخت قبلاً برگردانده شده',
  '-15': 'پرداخت نامعتبر',
  '-16': 'پرداخت با موفقیت برگردانده شد',
  '-17': 'خطا در برگشت وجه',
  '-18': 'مبلغ درخواستی با مبلغ پرداختی متفاوت',
  '-19': 'خطای احراز هویت',
  '-20': 'پرداخت انجام شده',
  '-21': 'پرداخت یافت نشد',
  '-22': 'پرداخت در حالت بررسی است',
  '-23': 'خطا در ایجاد پرداخت',
  '1': 'پرداخت توسط کاربر لغو شد',
};

function errorMessage(code) {
  return ERROR_MESSAGES[String(code)] || `تراکنش ناموفق (${code})`;
}

async function testConnection(cfg) {
  if (!configured(cfg)) return { ok: false, message: 'Terminal ID سامان تنظیم نشده است.' };
  try {
    await getToken(cfg);
    return { ok: true, message: `اتصال با سامان ${cfg.sandbox ? '(sandbox)' : '(تولید)'} برقرار است.` };
  } catch (err) {
    return { ok: false, message: `خطا در اتصال به سامان: ${err.message}` };
  }
}

module.exports = { key: KEY, label: LABEL, fields, configured, createPayment, verifyPayment, parseCallback, errorMessage, testConnection };
