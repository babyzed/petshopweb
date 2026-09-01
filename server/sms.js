// server/sms.js — سرویس پیامک (Kavenegar API)
// مستندات: https://kavenegar.com/api.html
//
// نحوه استفاده:
//   1. در kavenegar.com ثبت‌نام کنید و API Key دریافت کنید
//   2. شماره فرستنده ثبت کنید
//   3. در فایل .env تنظیم کنید

const https = require('https');
const { getSetting } = require('./db');

// تنظیمات پیامک: اول از پنل مدیریت (دیتابیس)، سپس متغیرهای محیطی
function smsConfig() {
  const dbCfg = getSetting('sms', {}) || {};
  return {
    apiKey: dbCfg.api_key || process.env.KAVENEGAR_API_KEY || '',
    sender: dbCfg.sender || process.env.KAVENEGAR_SENDER || '',
  };
}

// ---------- ارسال پیامک ----------
async function sendSMS(receptor, template, params = {}) {
  const { apiKey, sender } = smsConfig();
  if (!apiKey) {
    console.log(`[SMS] (نمایشی) به: ${receptor} | قالب: ${template} | پارامترها:`, params);
    return { ok: true, simulated: true };
  }

  const data = {
    receptor: Array.isArray(receptor) ? receptor.join(',') : receptor,
    sender,
    message: template,
    ...params,
  };

  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'api.kavenegar.com',
      port: 443,
      path: `/v1/${apiKey}/sms/send.json`,
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

  // تایید سفارش — متن بر اساس روش پرداخت متفاوت است
  ORDER_CONFIRM: (code, total, method) => {
    const payNote = method === 'cod'
      ? 'پرداخت در محل: مبلغ هنگام تحویل دریافت می‌شود.'
      : 'پرداخت آنلاین: پس از پرداخت، سفارش تایید می‌شود.';
    return `پت‌شاپ\nسفارش ${code} ثبت شد.\nمبلغ: ${total.toLocaleString('fa-IR')} تومان\n${payNote}`;
  },

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
      message = TEMPLATES.ORDER_CONFIRM(order.code, order.total, order.payment_method);
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
    case 'paid':
      message = `پت‌شاپ\nسفارش ${order.code} پرداخت شد.\nمبلغ: ${order.total.toLocaleString('fa-IR')} تومان`;
      break;
    default:
      return { ok: false, reason: 'unknown_type' };
  }

  return sendSMS(customer.phone, message);
}

// ---------- تست اتصال ----------
async function testConnection() {
  const { apiKey, sender } = smsConfig();
  if (!apiKey) {
    return { ok: false, message: 'کلید API کاوه‌نگار تنظیم نشده است.' };
  }
  return {
    ok: true,
    message: 'سرویس پیامک آماده است.',
    sender: sender || 'تنظیم نشده',
  };
}

module.exports = {
  sendSMS,
  sendOrderSMS,
  TEMPLATES,
  testConnection,
};
