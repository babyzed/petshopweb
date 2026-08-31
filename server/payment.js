// server/payment.js — ماژول پرداخت بانک سامان (Saman Sepehr API)
// مستندات: https://developer.sep.ir
//
// نحوه استفاده:
//   1. اکانت سامان را فعال کنید و Terminal ID دریافت کنید
//   2. در فایل .env مقدار SAMAN_TERMINAL_ID را تنظیم کنید
//   3. برای تست از sandbox استفاده کنید (SAMAN_SANDBOX=true)

const https = require('https');
const http = require('http');

// ---------- تنظیمات ----------
const SAMAN_TERMINAL_ID = process.env.SAMAN_TERMINAL_ID || '';
const SAMAN_SANDBOX = process.env.SAMAN_SANDBOX === 'true';
const SAMAN_CALLBACK_URL = process.env.SAMAN_CALLBACK_URL || 'http://localhost:3000/api/payments/callback';

// آدرس‌های API
const BASE_URL = SAMAN_SANDBOX
  ? 'https://sep.shaparak.ir/sandbox/api/v1'
  : 'https://sep.shaparak.ir/api/v1';

// ---------- درخواست HTTP ----------
function httpRequest(url, method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const client = isHttps ? https : http;
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// ---------- دریافت توکن از سامان ----------
async function getToken() {
  try {
    const res = await httpRequest(`${BASE_URL}/token`, 'POST', {
      terminalId: SAMAN_TERMINAL_ID,
    });

    if (res.status === 200 && res.data?.token) {
      return res.data.token;
    }

    console.error('[Saman] Token error:', res.data);
    throw new Error('خطا در دریافت توکن سامان');
  } catch (err) {
    console.error('[Saman] Token request failed:', err.message);
    throw err;
  }
}

// ---------- ایجاد لینک پرداخت ----------
async function createPayment({ amount, orderId, orderCode, description, mobile, email }) {
  if (!SAMAN_TERMINAL_ID) {
    return {
      ok: false,
      error: 'SAMAN_TERMINAL_ID تنظیم نشده است. لطفاً فایل .env را بررسی کنید.',
      errorCode: 'NO_TERMINAL_ID',
    };
  }

  // دریافت توکن
  const token = await getToken();

  // ساخت URL callback
  const callbackUrl = `${SAMAN_CALLBACK_URL}?order=${encodeURIComponent(orderCode)}`;

  // درخواست پرداخت
  const res = await httpRequest(`${BASE_URL}/payments`, 'POST', {
    terminalId: SAMAN_TERMINAL_ID,
    amount: amount * 10, // تبدیل تومان به ریال (Saman API ریال می‌خواهد)
    callbackUrl,
    orderId: String(orderId),
    orderCode: String(orderCode),
    description: description || `پرداخت سفارش ${orderCode}`,
    mobile: mobile || undefined,
    email: email || undefined,
  }, {
    Authorization: `Bearer ${token}`,
  });

  if (res.status === 200 && res.data?.paymentUrl) {
    return {
      ok: true,
      paymentUrl: res.data.paymentUrl,
      token: res.data.token || token,
      fee: res.data.fee || 0,
    };
  }

  console.error('[Saman] Payment creation failed:', res.data);
  return {
    ok: false,
    error: res.data?.message || res.data?.errorCode || 'خطا در ایجاد لینک پرداخت',
    errorCode: res.data?.errorCode,
  };
}

// ---------- تایید پرداخت ----------
async function verifyPayment({ token, RRN }) {
  if (!SAMAN_TERMINAL_ID) {
    throw new Error('SAMAN_TERMINAL_ID تنظیم نشده است.');
  }

  const res = await httpRequest(`${BASE_URL}/payments/${RRN}/verify`, 'POST', {
    terminalId: SAMAN_TERMINAL_ID,
  }, {
    Authorization: `Bearer ${token}`,
  });

  if (res.status === 200 && res.data?.verified === true) {
    return {
      ok: true,
      RRN: res.data.RRN || RRN,
      cardNumber: res.data.cardNumber || '',
      amount: res.data.amount || 0,
    };
  }

  console.error('[Saman] Verification failed:', res.data);
  return {
    ok: false,
    error: res.data?.message || res.data?.errorCode || 'تایید پرداخت ناموفق',
    errorCode: res.data?.errorCode,
  };
}

// ---------- وضعیت خطاها ----------
const ERROR_MESSAGES = {
  '-1': 'پارامترهای ارسالی نامعتبر هستند',
  '-2': 'ترمینال یافت نشد',
  '-3': 'پرداخت تایید نشد',
  '-4': 'تعداد درخواست‌ها از حد مجاز فراتر رفته',
  '-5': 'مبلغ پرداخت نامعتبر است',
  '-6': 'درخواست منقضی شده',
  '-7': 'خطای سمت سرور',
  '-8': 'نسخه API نامعتبر',
  '-9': '/callbackDomain نامعتبر',
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
};

function getErrorMessage(code) {
  return ERROR_MESSAGES[String(code)] || `خطای ناشناخته (${code})`;
}

// ---------- تست اتصال ----------
async function testConnection() {
  if (!SAMAN_TERMINAL_ID) {
    return { ok: false, message: 'SAMAN_TERMINAL_ID تنظیم نشده است.' };
  }
  try {
    const token = await getToken();
    return {
      ok: true,
      message: `اتصال با سامان ${SAMAN_SANDBOX ? '(sandbox)' : '(تولید)'} برقرار است.`,
      sandbox: SAMAN_SANDBOX,
      terminalId: SAMAN_TERMINAL_ID.slice(0, 4) + '****',
    };
  } catch (err) {
    return { ok: false, message: `خطا در اتصال: ${err.message}` };
  }
}

module.exports = {
  createPayment,
  verifyPayment,
  getErrorMessage,
  testConnection,
  SAMAN_SANDBOX,
  SAMAN_TERMINAL_ID,
  SAMAN_CALLBACK_URL,
};
