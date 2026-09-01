// server/gateways/zarinpal.js — درگاه زرین‌پال (Payment API v4)
// مستندات: https://www.zarinpal.com/docs/paymentGateway/
const { request } = require('./http');

const KEY = 'zarinpal';
const LABEL = 'زرین‌پال';

function endpoints(cfg) {
  return cfg.sandbox
    ? {
        request: 'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
        verify: 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json',
        startPay: 'https://sandbox.zarinpal.com/pg/StartPay/',
      }
    : {
        request: 'https://payment.zarinpal.com/pg/v4/payment/request.json',
        verify: 'https://payment.zarinpal.com/pg/v4/payment/verify.json',
        startPay: 'https://payment.zarinpal.com/pg/StartPay/',
      };
}

function configured(cfg) {
  return !!cfg.merchant_id;
}

function fields() {
  return [
    { key: 'merchant_id', label: 'Merchant ID (۳۶ کاراکتری)', secret: true },
    { key: 'sandbox', label: 'حالت تست (Sandbox)', type: 'boolean' },
  ];
}

// ---------- ایجاد پرداخت ----------
async function createPayment(cfg, { amountRial, orderCode, description, mobile, email, callbackUrl }) {
  const ep = endpoints(cfg);
  const res = await request(ep.request, {
    json: {
      merchant_id: cfg.merchant_id,
      amount: amountRial,          // زرین‌پال مبلغ را به ریال می‌گیرد
      callback_url: callbackUrl,
      description: description || `پرداخت سفارش ${orderCode}`,
      metadata: { mobile: mobile || undefined, email: email || undefined },
    },
  });

  const d = res.data?.data;
  if (d && Number(d.code) === 100 && d.authority) {
    return { ok: true, paymentUrl: ep.startPay + d.authority, authority: d.authority };
  }
  const errs = res.data?.errors;
  const msg = (errs && (errs.message || errs[0]?.message)) || d?.message || 'خطا در ایجاد تراکنش زرین‌پال';
  return { ok: false, error: msg, errorCode: errs?.code ?? d?.code };
}

// ---------- تایید پرداخت ----------
async function verifyPayment(cfg, { params, amountRial }) {
  const authority = String(params.Authority || params.authority || '').trim();
  if (!authority) return { ok: false, error: 'شناسه Authority دریافت نشد.' };

  const res = await request(endpoints(cfg).verify, {
    json: { merchant_id: cfg.merchant_id, amount: amountRial, authority },
  });

  const d = res.data?.data;
  // 100 = تایید موفق، 101 = قبلاً تایید شده
  if (d && (Number(d.code) === 100 || Number(d.code) === 101)) {
    return {
      ok: true,
      refId: String(d.ref_id || ''),
      cardNumber: d.card_pan || '',
      amountRial,
      alreadyVerified: Number(d.code) === 101,
      raw: d,
    };
  }
  const errs = res.data?.errors;
  return { ok: false, error: (errs && (errs.message || errs[0]?.message)) || 'تایید پرداخت زرین‌پال ناموفق بود', raw: res.data };
}

// ---------- تفسیر کال‌بک ----------
// زرین‌پال با GET و پارامترهای Authority و Status=OK|NOK برمی‌گردد
function parseCallback(req) {
  const p = { ...(req.query || {}), ...(req.body || {}) };
  const status = String(p.Status || p.status || '').toUpperCase();
  return {
    params: p,
    orderCode: p.order || p.orderCode || '',
    orderId: Number(p.orderId) || null,
    ok: status === 'OK',
    ref: p.Authority || p.authority || '',
    statusCode: status,
  };
}

const ERROR_MESSAGES = {
  NOK: 'پرداخت توسط کاربر لغو شد یا ناموفق بود',
  '-9': 'خطای اعتبارسنجی اطلاعات ارسالی',
  '-10': 'آی‌پی یا مرچنت کد پذیرنده صحیح نیست',
  '-11': 'مرچنت کد فعال نیست',
  '-12': 'تلاش بیش از حد مجاز',
  '-15': 'درگاه پرداخت تعلیق شده است',
  '-16': 'سطح تایید پذیرنده پایین‌تر از سطح نقره‌ای است',
  '-30': 'اجازه دسترسی به تسویه اشتراکی وجود ندارد',
  '-50': 'مبلغ پرداخت‌شده با مقدار ارسالی برابر نیست',
  '-51': 'پرداخت ناموفق',
  '-53': 'پرداخت متعلق به این مرچنت کد نیست',
  '-54': 'Authority نامعتبر است',
  '101': 'تراکنش قبلاً تایید شده است',
};

function errorMessage(code) {
  return ERROR_MESSAGES[String(code)] || `تراکنش زرین‌پال ناموفق (${code})`;
}

async function testConnection(cfg) {
  if (!configured(cfg)) return { ok: false, message: 'Merchant ID زرین‌پال تنظیم نشده است.' };
  // درخواست آزمایشی با مبلغ حداقلی؛ فقط صحت مرچنت بررسی می‌شود
  try {
    const res = await createPayment(cfg, {
      amountRial: 10000,
      orderCode: 'TEST',
      description: 'تست اتصال درگاه',
      callbackUrl: (cfg.callback_url || 'https://example.com/api/payments/callback'),
    });
    return res.ok
      ? { ok: true, message: `اتصال با زرین‌پال ${cfg.sandbox ? '(sandbox)' : '(تولید)'} برقرار است.` }
      : { ok: false, message: `خطا در اتصال به زرین‌پال: ${res.error}` };
  } catch (err) {
    return { ok: false, message: `خطا در اتصال به زرین‌پال: ${err.message}` };
  }
}

module.exports = { key: KEY, label: LABEL, fields, configured, createPayment, verifyPayment, parseCallback, errorMessage, testConnection };
