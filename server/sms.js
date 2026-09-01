// server/sms.js — سرویس پیامک «آموت» (AmootSMS REST)
// مستندات: https://doc.amootsms.com/Documentation
//
// این سرویس سه API مجزا در اختیار برنامه می‌گذارد:
//   1) ارسال کد تایید (OTP)      →  /rest/SendOTP یا /rest/SendWithPattern
//   2) پیامک تستی/خدماتی        →  /rest/SendSimple
//   3) پیامک تبلیغاتی (انبوه)    →  /rest/SendSimple روی خط تبلیغاتی
//
// نحوه استفاده:
//   1. در amootsms.com ثبت‌نام کنید و از بخش «وب سرویس» یک Token از نوع REST بسازید
//   2. خط خدماتی/تبلیغاتی خود را در پنل ببینید (یا از خط اشتراکی public استفاده کنید)
//   3. مقادیر را در پنل مدیریت (تنظیمات → سرویس پیامک) یا فایل .env تنظیم کنید

const https = require('https');
const { getSetting } = require('./db');

const API_HOST = 'portal.amootsms.com';
const API_BASE = '/rest';

// نقاط پایانی (سه API اصلی مورد استفاده)
const ENDPOINTS = {
  OTP: '/SendOTP',                 // ارسال کد اعتبارسنجی
  PATTERN: '/SendWithPattern',     // ارسال کد از طریق الگو (در صورت تنظیم الگو)
  SIMPLE: '/SendSimple',           // پیامک ساده/تستی/خدماتی
  ADS: '/SendSimple',              // پیامک تبلیغاتی (روی خط تبلیغاتی)
  CREDIT: '/AccountStatus',        // اعتبار حساب
};

// حداکثر تعداد گیرنده در هر درخواست ارسال انبوه
const BULK_CHUNK = 100;

// ---------- تنظیمات: اول از پنل مدیریت (دیتابیس)، سپس متغیرهای محیطی ----------
function smsConfig() {
  const cfg = getSetting('sms', {}) || {};
  const serviceLine = cfg.line_service || cfg.sender || process.env.AMOOT_LINE_SERVICE || 'public';
  return {
    provider: 'amoot',
    token: cfg.token || cfg.api_key || process.env.AMOOT_TOKEN || '',
    // خط خدماتی (پیامک سفارش‌ها و پیامک تستی)
    lineService: serviceLine,
    // خط ارسال کد تایید (اگر تنظیم نشود از خط خدماتی استفاده می‌شود)
    lineOtp: cfg.line_otp || process.env.AMOOT_LINE_OTP || serviceLine,
    // خط تبلیغاتی (اگر تنظیم نشود از خط خدماتی استفاده می‌شود)
    lineAds: cfg.line_ads || process.env.AMOOT_LINE_ADS || serviceLine,
    // کد الگوی کد تایید (اختیاری — در صورت تنظیم، OTP با الگو ارسال می‌شود)
    otpPatternId: cfg.otp_pattern_id || process.env.AMOOT_OTP_PATTERN_ID || '',
  };
}

function isConfigured() {
  return !!smsConfig().token;
}

// ---------- نرمال‌سازی شماره موبایل ----------
// آموت شماره را به شکل 09xxxxxxxxx یا 9xxxxxxxxx می‌پذیرد
function normalizeMobile(input) {
  let m = String(input || '').trim();
  // ارقام فارسی/عربی → لاتین
  m = m.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
       .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  m = m.replace(/[^\d+]/g, '');
  if (m.startsWith('+98')) m = '0' + m.slice(3);
  else if (m.startsWith('0098')) m = '0' + m.slice(4);
  else if (m.startsWith('98') && m.length === 12) m = '0' + m.slice(2);
  else if (m.startsWith('9') && m.length === 10) m = '0' + m;
  return m;
}

function isValidMobile(m) {
  return /^09\d{9}$/.test(normalizeMobile(m));
}

// ---------- درخواست به وب‌سرویس آموت ----------
function amootRequest(endpoint, params = {}) {
  const { token } = smsConfig();
  const body = new URLSearchParams();
  body.append('Token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    body.append(k, String(v));
  }
  const postData = body.toString();

  return new Promise((resolve) => {
    const req = https.request({
      hostname: API_HOST,
      port: 443,
      path: API_BASE + endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        Authorization: token,
      },
      timeout: 20000,
    }, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch { data = { Status: 'ParseError', raw }; }
        resolve(interpret(endpoint, data));
      });
    });

    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'زمان پاسخ سرویس پیامک به پایان رسید.' }); });
    req.on('error', (err) => {
      console.error('[SMS/Amoot] خطا در اتصال:', err.message);
      resolve({ ok: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

// ---------- تفسیر پاسخ آموت ----------
// پاسخ موفق آموت: { Status: "Success", RetStatus: 1, StrRetStatus: "Ok", ... }
function interpret(endpoint, data) {
  const status = String(data.Status ?? data.StrRetStatus ?? '').toLowerCase();
  const ret = Number(data.RetStatus);
  const ok = ret === 1 || status === 'success' || status === 'ok';
  if (ok) {
    console.log(`[SMS/Amoot] ${endpoint} ارسال شد.`);
    return { ok: true, data, messageId: data.MessageID || data.MessageIDs || null, code: data.Code || null };
  }
  const error = data.StrRetStatus || data.Status || data.explanation || 'خطا در ارسال پیامک';
  console.error(`[SMS/Amoot] ${endpoint} ناموفق:`, error);
  return { ok: false, error: String(error), data };
}

// آموت زمان ارسال «اکنون» را با مقدار 0 می‌پذیرد
const NOW = '0';

// ============================================================
// API 1 — ارسال کد تایید (OTP)
// ============================================================
// اگر کد الگو (otp_pattern_id) تنظیم شده باشد، از SendWithPattern استفاده می‌شود
// و در غیر این صورت از SendOTP روی خط کد تایید.
async function sendVerificationCode(mobile, code, options = {}) {
  const { token, lineOtp, otpPatternId } = smsConfig();
  const to = normalizeMobile(mobile);
  if (!isValidMobile(to)) return { ok: false, error: 'شماره موبایل نامعتبر است.' };

  if (!token) {
    console.log(`[SMS] (نمایشی) کد تایید ${code} به ${to}`);
    return { ok: true, simulated: true, code };
  }

  if (otpPatternId) {
    return amootRequest(ENDPOINTS.PATTERN, {
      Mobile: to,
      PatternCodeID: otpPatternId,
      PatternValues: String(code),
    });
  }

  return amootRequest(ENDPOINTS.OTP, {
    SendDateTime: NOW,
    Mobile: to,
    LineNumber: lineOtp,
    SMSMessageText: options.text || TEMPLATES.VERIFY(code),
    CodeLength: String(code).length || 6,
  });
}

// ============================================================
// API 2 — پیامک تستی / خدماتی (ارسال ساده)
// ============================================================
async function sendSMS(receptor, message, options = {}) {
  const { token, lineService } = smsConfig();
  const list = (Array.isArray(receptor) ? receptor : [receptor])
    .map(normalizeMobile).filter(isValidMobile);

  if (!list.length) return { ok: false, error: 'شماره موبایل معتبری وارد نشده است.' };

  if (!token) {
    console.log(`[SMS] (نمایشی) به: ${list.join(',')} | متن: ${message}`);
    return { ok: true, simulated: true };
  }

  return amootRequest(ENDPOINTS.SIMPLE, {
    SendDateTime: NOW,
    SMSMessageText: message,
    LineNumber: options.line || lineService,
    Mobiles: list.join(','),
  });
}

// پیامک آزمایشی برای بررسی صحت اتصال (از پنل مدیریت)
async function sendTestSMS(mobile, text) {
  const message = text || 'پت‌شاپ\nپیامک آزمایشی: اتصال سرویس پیامکی آموت با موفقیت برقرار شد. 🐾';
  return sendSMS(mobile, message);
}

// ============================================================
// API 3 — پیامک تبلیغاتی (ارسال انبوه روی خط تبلیغاتی)
// ============================================================
async function sendAdvertisingSMS(mobiles, message, options = {}) {
  const { token, lineAds } = smsConfig();
  const list = [...new Set((Array.isArray(mobiles) ? mobiles : [mobiles])
    .map(normalizeMobile).filter(isValidMobile))];

  if (!list.length) return { ok: false, error: 'هیچ شماره موبایل معتبری یافت نشد.' };
  if (!message || !String(message).trim()) return { ok: false, error: 'متن پیامک تبلیغاتی خالی است.' };

  // طبق قوانین ساترا، پیامک تبلیغاتی باید امکان لغو داشته باشد
  const text = options.appendOptOut === false
    ? String(message).trim()
    : `${String(message).trim()}\nلغو۱۱`;

  if (!token) {
    console.log(`[SMS] (نمایشی) تبلیغاتی به ${list.length} شماره | متن: ${text}`);
    return { ok: true, simulated: true, total: list.length, sent: list.length, failed: 0 };
  }

  let sent = 0, failed = 0;
  const errors = [];
  for (let i = 0; i < list.length; i += BULK_CHUNK) {
    const chunk = list.slice(i, i + BULK_CHUNK);
    const result = await amootRequest(ENDPOINTS.ADS, {
      SendDateTime: options.sendAt || NOW,
      SMSMessageText: text,
      LineNumber: options.line || lineAds,
      Mobiles: chunk.join(','),
    });
    if (result.ok) sent += chunk.length;
    else { failed += chunk.length; errors.push(result.error); }
  }

  return {
    ok: sent > 0,
    total: list.length,
    sent,
    failed,
    error: sent === 0 ? (errors[0] || 'ارسال تبلیغاتی ناموفق بود.') : undefined,
  };
}

// ---------- قالب‌های پیامک ----------
const TEMPLATES = {
  // تایید ثبت‌نام / کد یکبار مصرف
  VERIFY: (code) => `پت‌شاپ\nکد تایید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.`,

  // تایید سفارش — متن بر اساس روش پرداخت متفاوت است
  ORDER_CONFIRM: (code, total, method) => {
    const payNote = method === 'cod'
      ? 'پرداخت در محل: مبلغ هنگام تحویل دریافت می‌شود.'
      : 'پرداخت آنلاین: پس از پرداخت، سفارش تایید می‌شود.';
    return `پت‌شاپ\nسفارش شما با موفقیت ثبت شد.\nکد پیگیری: ${code}\nمبلغ: ${total.toLocaleString('fa-IR')} تومان\n${payNote}`;
  },

  // ارسال سفارش — کد رهگیری پستی همزمان با ارسال پیامک می‌شود
  ORDER_SHIPPED: (code, trackingCode) => {
    const track = String(trackingCode || '').trim();
    return `پت‌شاپ\nسفارش ${code} ارسال شد${track ? `\nکد رهگیری پستی: ${track}` : ''}\nوضعیت مرسوله را با همین کد در سامانه پست پیگیری کنید.`;
  },

  // تایید سفارش توسط فروشگاه (مرحله تایید سفارش‌های پرداخت در محل)
  ORDER_APPROVED: (code) => `پت‌شاپ\nسفارش ${code} توسط فروشگاه تایید شد و در حال آماده‌سازی است.`,

  // تحویل سفارش
  ORDER_DELIVERED: (code) => `پت‌شاپ\nسفارش ${code} تحویل داده شد.\nامیدواریم از خریدتان راضی باشید!`,

  // لغو سفارش
  ORDER_CANCELLED: (code) => `پت‌شاپ\nسفارش ${code} لغو شد.`,

  // کد تخفیف
  COUPON: (code, discount) => `پت‌شاپ\nکد تخفیف ${code}\nتخفیف: ${discount} درصد\nبا تشکر از خرید شما`,
};

// ---------- ارسال پیامک با قالب سفارش ----------
async function sendOrderSMS(order, type) {
  const customer = typeof order.customer_json === 'string'
    ? JSON.parse(order.customer_json)
    : order.customer_json;

  if (!customer || !customer.phone) {
    console.log(`[SMS] شماره تلفن موجود نیست — پیامک ارسال نشد (${order.code})`);
    return { ok: false, reason: 'no_phone' };
  }

  let message = '';
  switch (type) {
    case 'confirm':
      message = TEMPLATES.ORDER_CONFIRM(order.code, order.total, order.payment_method);
      break;
    case 'shipped':
      message = TEMPLATES.ORDER_SHIPPED(order.code, order.tracking_code);
      break;
    case 'approved':
    case 'confirmed':
      message = TEMPLATES.ORDER_APPROVED(order.code);
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

// ---------- اعتبار حساب ----------
async function getCredit() {
  if (!isConfigured()) return { ok: false, error: 'توکن سرویس پیامک آموت تنظیم نشده است.' };
  const res = await amootRequest(ENDPOINTS.CREDIT, {});
  if (!res.ok) return res;
  const d = res.data || {};
  return { ok: true, credit: d.RemaindCredit ?? d.Credit ?? d.remaindCredit ?? null, data: d };
}

// ---------- تست اتصال ----------
async function testConnection() {
  const { token, lineService, lineOtp, lineAds } = smsConfig();
  if (!token) {
    return { ok: false, provider: 'amoot', message: 'توکن سرویس پیامک آموت تنظیم نشده است.' };
  }
  const credit = await getCredit();
  return {
    ok: credit.ok,
    provider: 'amoot',
    message: credit.ok ? 'اتصال به سرویس پیامک آموت برقرار است.' : (credit.error || 'اتصال برقرار نشد.'),
    credit: credit.credit ?? null,
    lines: { service: lineService, otp: lineOtp, ads: lineAds },
  };
}

module.exports = {
  // سه API اصلی
  sendVerificationCode,   // ۱) ارسال کد تایید
  sendTestSMS,            // ۲) پیامک تستی
  sendAdvertisingSMS,     // ۳) پیامک تبلیغاتی
  // کمکی
  sendSMS,
  sendOrderSMS,
  getCredit,
  testConnection,
  isConfigured,
  normalizeMobile,
  isValidMobile,
  smsConfig,
  TEMPLATES,
};
