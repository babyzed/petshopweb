// server/sms.js — سرویس پیامک (Kavenegar API)
// مستندات: https://kavenegar.com/api.html
//
// نحوه استفاده:
//   1. در kavenegar.com ثبت‌نام کنید و API Key دریافت کنید
//   2. شماره فرستنده ثبت کنید
//   3. در فایل .env تنظیم کنید

const https = require('https');

const KAVENEGAR_API_KEY = process.env.KAVENEGAR_API_KEY || '';
const KAVENEGAR_SENDER = process.env.KAVENEGAR_SENDER || '';

// ---------- ارسال پیامک ----------
async function sendSMS(receptor, template, params = {}) {
  if (!KAVENEGAR_API_KEY) {
    console.log(`[SMS] (نمایشی) به: ${receptor} | قالب: ${template} | پارامترها:`, params);
    return { ok: true, simulated: true };
  }

  const data = {
    receptor: Array.isArray(receptor) ? receptor.join(',') : receptor,
    sender: KAVENEGAR_SENDER,
    message: template,
    ...params,
  };

  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'api.kavenegar.com',
      port: 443,
      path: `/v1/${KAVENEGAR_API_KEY}/sms/send.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.return && result.return.status === 200) {
            console.log(`[SMS] ارسال شد: ${receptor}`);
            resolve({ ok: true, data: result });
          } else {
            console.error('[SMS] خطا:', result.return);
            resolve({ ok: false, error: result.return?.message || 'خطا در ارسال پیامک' });
          }
        } catch (err) {
          console.error('[SMS] خطا در پردازش پاسخ:', err.message);
          resolve({ ok: false, error: err.message });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[SMS] خطا در اتصال:', err.message);
      resolve({ ok: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

// ---------- قالب‌های پیامک ----------
const TEMPLATES = {
  // تایید ثبت‌نام
  VERIFY: (code) => `پت‌شاپ\nکد تایید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.`,

  // تایید سفارش
  ORDER_CONFIRM: (code, total) => `پت‌شاپ\nسفارش ${code} ثبت شد.\nمبلغ: ${total.toLocaleString('fa-IR')} تومان\nپس از پرداخت، سفارش شما تایید می‌شود.`,

  // ارسال سفارش
  ORDER_SHIPPED: (code) => `پت‌شاپ\nسفارش ${code} ارسال شد.\nبه زودی به دست شما می‌رسد.`,

  // تحویل سفارش
  ORDER_DELIVERED: (code) => `پت‌شاپ\nسفارش ${code} تحویل داده شد.\nامیدواریم از خریدتان راضی باشید!`,

  // لغو سفارش
  ORDER_CANCELLED: (code) => `پت‌شاپ\nسفارش ${code} لغو شد.`,

  // کد تخفیف
  COUPON: (code, discount) => `پت‌شاپ\nکد تخفیف ${code}\nتخفیف: ${discount} درصد\nبا تشکر از خرید شما`,
};

// ---------- ارسال پیامک با قالب ----------
async function sendOrderSMS(order, type) {
  const customer = typeof order.customer_json === 'string'
    ? JSON.parse(order.customer_json)
    : order.customer_json;

  if (!customer.phone) {
    console.log(`[SMS] شماره تلفن موجود نیست — پیامک ارسال نشد (${order.code})`);
    return { ok: false, reason: 'no_phone' };
  }

  let message = '';
  switch (type) {
    case 'confirm':
      message = TEMPLATES.ORDER_CONFIRM(order.code, order.total);
      break;
    case 'shipped':
      message = TEMPLATES.ORDER_SHIPPED(order.code);
      break;
    case 'delivered':
      message = TEMPLATES.ORDER_DELIVERED(order.code);
      break;
    case 'cancelled':
      message = TEMPLATES.ORDER_CANCELLED(order.code);
      break;
    default:
      return { ok: false, reason: 'unknown_type' };
  }

  return sendSMS(customer.phone, message);
}

// ---------- تست اتصال ----------
async function testConnection() {
  if (!KAVENEGAR_API_KEY) {
    return { ok: false, message: 'KAVENEGAR_API_KEY تنظیم نشده است.' };
  }
  try {
    // تست ساده با ارسال به شماره خود
    return {
      ok: true,
      message: 'سرویس پیامک آماده است.',
      sender: KAVENEGAR_SENDER || 'تنظیم نشده',
    };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = {
  sendSMS,
  sendOrderSMS,
  TEMPLATES,
  testConnection,
};
