// server/gateways/saderat.js — درگاه بانک صادرات (پرداخت الکترونیک سپهر / مبنا کارت آریا)
// مستندات: https://sepehr.shaparak.ir  (GetToken + Advice)
const { request } = require('./http');

const KEY = 'saderat';
const LABEL = 'بانک صادرات (سپهر)';

function endpoints(cfg) {
  const host = cfg.host || 'sepehr.shaparak.ir'; // برای پذیرندگان مبنا: mabna.shaparak.ir
  return {
    token: `https://${host}:8081/V1/PeymentApi/GetToken`,
    advice: `https://${host}:8081/V1/PeymentApi/Advice`,
    rollback: `https://${host}:8081/V1/PeymentApi/Rollback`,
    pay: `https://${host}:8080/pay`,
  };
}

function configured(cfg) {
  return !!cfg.terminal_id;
}

function fields() {
  return [
    { key: 'terminal_id', label: 'Terminal ID (شماره پایانه)', secret: false },
    { key: 'host', label: 'دامنه درگاه (پیش‌فرض sepehr.shaparak.ir)', secret: false },
  ];
}

// ---------- ایجاد پرداخت ----------
// سپهر بعد از دریافت توکن، نیازمند ارسال فرم POST به صفحهٔ پرداخت است.
async function createPayment(cfg, { amountRial, orderId, mobile, callbackUrl }) {
  const ep = endpoints(cfg);
  const res = await request(ep.token, {
    form: {
      Amount: amountRial,
      callbackURL: callbackUrl,
      invoiceID: String(orderId),
      terminalID: cfg.terminal_id,
      CellNumber: mobile || '',
      payload: '',
    },
    insecure: true, // برخی سرورهای سپهر زنجیرهٔ گواهی کامل ارائه نمی‌کنند
  });

  const d = res.data || {};
  if (String(d.Status) === '0' && d.Accesstoken) {
    return {
      ok: true,
      authority: d.Accesstoken,
      // ارسال فرم POST توسط مسیر واسط سرور انجام می‌شود
      formPost: {
        action: ep.pay,
        fields: { TerminalID: cfg.terminal_id, token: d.Accesstoken, getMethod: '1' },
      },
    };
  }
  return { ok: false, error: errorMessage(d.Status), errorCode: d.Status };
}

// ---------- تایید پرداخت (Advice) ----------
async function verifyPayment(cfg, { params }) {
  const digitalreceipt = String(params.digitalreceipt || params.DigitalReceipt || '').trim();
  if (!digitalreceipt) return { ok: false, error: 'رسید دیجیتال تراکنش دریافت نشد.' };

  const res = await request(endpoints(cfg).advice, {
    form: { digitalreceipt, Tid: cfg.terminal_id },
    insecure: true,
  });

  const d = res.data || {};
  const status = String(d.Status || '').toLowerCase();
  if (status === 'ok' || status === 'duplicate') {
    return {
      ok: true,
      refId: String(params.rrn || params.RRN || digitalreceipt),
      returnId: d.ReturnId != null ? String(d.ReturnId) : '',
      traceNo: String(params.tracenumber || ''),
      cardNumber: params.cardnumber || '',
      // سپهر مبلغ را در پارامترهای بازگشتی (به ریال) ارسال می‌کند
      amountRial: Number(params.amount) || 0,
      alreadyVerified: status === 'duplicate',
      raw: d,
    };
  }
  return { ok: false, error: d.Message || d.Status || 'تایید تراکنش سپهر ناموفق بود', raw: d };
}

// ---------- تفسیر کال‌بک ----------
// سپهر با POST و پارامترهای respcode، digitalreceipt، invoiceid، rrn و ... برمی‌گردد
function parseCallback(req) {
  const p = { ...(req.query || {}), ...(req.body || {}) };
  const code = String(p.respcode ?? p.RespCode ?? '');
  return {
    params: p,
    orderCode: p.order || p.orderCode || '',
    orderId: Number(p.invoiceid || p.invoiceID || p.InvoiceId) || null,
    ok: code === '0',
    ref: p.digitalreceipt || '',
    statusCode: code,
  };
}

const ERROR_MESSAGES = {
  '-1': 'تراکنش پیدا نشد',
  '-2': 'تراکنش قبلاً برگشت خورده است',
  '-3': 'خطای داخلی سیستم',
  '-4': 'رسید دیجیتال نامعتبر است',
  '-5': 'مبلغ تراکنش نامعتبر است',
  '-6': 'شماره پایانه نامعتبر است',
  '1': 'کاربر از انجام تراکنش منصرف شد',
  '2': 'پرداخت با موفقیت انجام شد اما تایید نشده است',
  '3': 'پذیرنده نامعتبر است',
  '4': 'موجودی حساب کافی نیست',
  '5': 'رمز کارت اشتباه است',
  '6': 'تعداد دفعات ورود رمز اشتباه بیش از حد مجاز است',
  '7': 'کارت نامعتبر است',
  '8': 'زمان جلسه پرداخت به پایان رسیده است',
  '9': 'انصراف کاربر یا خطای درگاه',
};

function errorMessage(code) {
  return ERROR_MESSAGES[String(code)] || `تراکنش بانک صادرات ناموفق (${code})`;
}

async function testConnection(cfg) {
  if (!configured(cfg)) return { ok: false, message: 'Terminal ID درگاه سپهر (بانک صادرات) تنظیم نشده است.' };
  try {
    const res = await request(endpoints(cfg).token, {
      form: {
        Amount: 10000,
        callbackURL: cfg.callback_url || 'https://example.com/api/payments/callback',
        invoiceID: String(Date.now()).slice(-9),
        terminalID: cfg.terminal_id,
        payload: '',
      },
      insecure: true,
    });
    const d = res.data || {};
    return String(d.Status) === '0'
      ? { ok: true, message: 'اتصال با درگاه سپهر (بانک صادرات) برقرار است.' }
      : { ok: false, message: `خطا در اتصال به سپهر: ${errorMessage(d.Status)}` };
  } catch (err) {
    return { ok: false, message: `خطا در اتصال به سپهر: ${err.message}` };
  }
}

module.exports = { key: KEY, label: LABEL, fields, configured, createPayment, verifyPayment, parseCallback, errorMessage, testConnection };
