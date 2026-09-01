// server/payment.js — لایهٔ یکپارچهٔ درگاه‌های پرداخت
// درگاه‌های پشتیبانی‌شده: سامان (سپ)، زرین‌پال، بانک ملی (سداد)، بانک صادرات (سپهر)
//
// تنظیمات از «پنل مدیریت → تنظیمات → پرداخت» خوانده می‌شود و در صورت خالی بودن،
// از متغیرهای محیطی (.env) استفاده می‌گردد.
const crypto = require('crypto');
const { getSetting } = require('./db');

const saman = require('./gateways/saman');
const zarinpal = require('./gateways/zarinpal');
const melli = require('./gateways/melli');
const saderat = require('./gateways/saderat');

const GATEWAYS = { saman, zarinpal, melli, saderat };
const GATEWAY_KEYS = Object.keys(GATEWAYS);

const DEFAULT_CALLBACK = '/api/payments/callback';

// ============================================================
// تنظیمات
// ============================================================
function envBool(v, fallback = false) {
  if (v === undefined || v === '') return fallback;
  return String(v).toLowerCase() === 'true' || v === '1';
}

function paymentSettings() {
  return getSetting('payment', {}) || {};
}

// آدرس بازگشت از بانک
function callbackBaseUrl() {
  const s = paymentSettings();
  return (s.callback_url
    || process.env.PAYMENT_CALLBACK_URL
    || process.env.SAMAN_CALLBACK_URL
    || ((process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '') + DEFAULT_CALLBACK)).trim();
}

// تنظیمات یک درگاه مشخص (دیتابیس ← env)
function gatewayConfig(key) {
  const s = paymentSettings();
  const g = (s.gateways && s.gateways[key]) || {};
  const callback_url = callbackBaseUrl();

  switch (key) {
    case 'saman':
      return {
        callback_url,
        terminal_id: (g.terminal_id || process.env.SAMAN_TERMINAL_ID || '').trim(),
        sandbox: g.sandbox !== undefined ? !!g.sandbox : envBool(process.env.SAMAN_SANDBOX),
      };
    case 'zarinpal':
      return {
        callback_url,
        merchant_id: (g.merchant_id || process.env.ZARINPAL_MERCHANT_ID || '').trim(),
        sandbox: g.sandbox !== undefined ? !!g.sandbox : envBool(process.env.ZARINPAL_SANDBOX),
      };
    case 'melli':
      return {
        callback_url,
        merchant_id: (g.merchant_id || process.env.MELLI_MERCHANT_ID || '').trim(),
        terminal_id: (g.terminal_id || process.env.MELLI_TERMINAL_ID || '').trim(),
        terminal_key: (g.terminal_key || process.env.MELLI_TERMINAL_KEY || '').trim(),
      };
    case 'saderat':
      return {
        callback_url,
        terminal_id: (g.terminal_id || process.env.SADERAT_TERMINAL_ID || '').trim(),
        host: (g.host || process.env.SADERAT_HOST || 'sepehr.shaparak.ir').trim(),
      };
    default:
      return { callback_url };
  }
}

function isGatewayConfigured(key) {
  const gw = GATEWAYS[key];
  if (!gw) return false;
  try { return !!gw.configured(gatewayConfig(key)); } catch { return false; }
}

// درگاه فعال (انتخاب‌شده در پنل مدیریت) — اگر تنظیم نشده باشد،
// اولین درگاهِ پیکربندی‌شده انتخاب می‌شود.
function activeGatewayKey() {
  const s = paymentSettings();
  const chosen = s.gateway || process.env.PAYMENT_GATEWAY || '';
  if (GATEWAYS[chosen] && isGatewayConfigured(chosen)) return chosen;
  return GATEWAY_KEYS.find(isGatewayConfigured) || (GATEWAYS[chosen] ? chosen : 'saman');
}

// فهرست درگاه‌ها برای پنل مدیریت
function listGateways() {
  const active = activeGatewayKey();
  return GATEWAY_KEYS.map(key => ({
    key,
    label: GATEWAYS[key].label,
    fields: GATEWAYS[key].fields(),
    configured: isGatewayConfigured(key),
    active: key === active,
  }));
}

// آیا پرداخت آنلاین قابل استفاده است؟
function isOnlineAvailable() {
  return GATEWAY_KEYS.some(isGatewayConfigured);
}

function gatewayLabel(key) {
  return GATEWAYS[key]?.label || key || '';
}

// ============================================================
// مسیر واسط برای درگاه‌هایی که نیاز به POST فرم دارند (سپهر)
// ============================================================
const pendingForms = new Map();
const FORM_TTL_MS = 20 * 60 * 1000;

function storeFormPost(formPost) {
  const id = crypto.randomBytes(16).toString('hex');
  pendingForms.set(id, { formPost, expires: Date.now() + FORM_TTL_MS });
  // پاکسازی موارد منقضی
  for (const [k, v] of pendingForms) if (v.expires < Date.now()) pendingForms.delete(k);
  return id;
}

function takeFormPost(id) {
  const item = pendingForms.get(id);
  if (!item) return null;
  if (item.expires < Date.now()) { pendingForms.delete(id); return null; }
  return item.formPost;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// صفحهٔ HTML با فرم خودکار برای انتقال کاربر به درگاه
function renderRedirectPage(formPost) {
  const inputs = Object.entries(formPost.fields || {})
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`).join('\n    ');
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>انتقال به درگاه پرداخت</title>
<style>body{font-family:Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;color:#334155}</style>
</head><body>
  <div style="text-align:center">
    <p>در حال انتقال به درگاه بانک…</p>
    <p style="font-size:12px;color:#64748b">اگر به‌صورت خودکار منتقل نشدید، دکمهٔ زیر را بزنید.</p>
    <form id="gw" method="POST" action="${escapeHtml(formPost.action)}">
    ${inputs}
      <button type="submit" style="padding:10px 22px;border-radius:10px;border:0;background:#2563eb;color:#fff;cursor:pointer">انتقال به درگاه</button>
    </form>
  </div>
  <script>document.getElementById('gw').submit();</script>
</body></html>`;
}

// ============================================================
// ساخت پرداخت
// ============================================================
// amount به «تومان» است و در همهٔ درگاه‌ها به ریال تبدیل می‌شود.
async function createPayment({ amount, orderId, orderCode, description, mobile, email, gateway }) {
  const key = gateway && GATEWAYS[gateway] ? gateway : activeGatewayKey();
  const gw = GATEWAYS[key];
  if (!gw) return { ok: false, error: 'درگاه پرداخت نامعتبر است.', errorCode: 'INVALID_GATEWAY' };

  const cfg = gatewayConfig(key);
  if (!gw.configured(cfg)) {
    return {
      ok: false,
      gateway: key,
      error: `اطلاعات درگاه «${gw.label}» تنظیم نشده است. لطفاً تنظیمات پرداخت را کامل کنید.`,
      errorCode: 'NOT_CONFIGURED',
    };
  }

  const base = cfg.callback_url;
  const sep = base.includes('?') ? '&' : '?';
  const callbackUrl = `${base}${sep}gw=${key}&order=${encodeURIComponent(orderCode)}`;

  try {
    const result = await gw.createPayment(cfg, {
      amountRial: Math.round(Number(amount) * 10),
      amountToman: Number(amount),
      orderId,
      orderCode,
      description,
      mobile,
      email,
      callbackUrl,
    });

    if (!result.ok) return { ...result, gateway: key };

    // درگاه‌های فرم‌محور (سپهر) از مسیر واسط سرور عبور می‌کنند
    let paymentUrl = result.paymentUrl;
    if (!paymentUrl && result.formPost) {
      paymentUrl = `/api/payments/redirect/${storeFormPost(result.formPost)}`;
    }

    return { ok: true, gateway: key, gatewayLabel: gw.label, paymentUrl, token: result.authority || '' };
  } catch (err) {
    console.error(`[Payment/${key}] createPayment error:`, err.message);
    return { ok: false, gateway: key, error: err.message || 'خطا در اتصال به درگاه پرداخت' };
  }
}

// ============================================================
// تایید پرداخت
// ============================================================
async function verifyPayment({ gateway, params = {}, amount }) {
  const key = gateway && GATEWAYS[gateway] ? gateway : activeGatewayKey();
  const gw = GATEWAYS[key];
  if (!gw) return { ok: false, error: 'درگاه پرداخت نامعتبر است.' };

  const cfg = gatewayConfig(key);
  try {
    const result = await gw.verifyPayment(cfg, {
      params,
      amountRial: amount !== undefined ? Math.round(Number(amount) * 10) : undefined,
    });
    return { ...result, gateway: key };
  } catch (err) {
    console.error(`[Payment/${key}] verifyPayment error:`, err.message);
    return { ok: false, gateway: key, error: err.message || 'خطا در تایید پرداخت' };
  }
}

// ============================================================
// تفسیر کال‌بک بانک
// ============================================================
function parseCallback(req) {
  const all = { ...(req.query || {}), ...(req.body || {}) };
  let key = String(all.gw || all.gateway || '').trim();
  if (!GATEWAYS[key]) {
    // تشخیص خودکار درگاه از روی پارامترهای بازگشتی
    if (all.digitalreceipt !== undefined || all.respcode !== undefined) key = 'saderat';
    else if (all.Authority !== undefined || all.authority !== undefined) key = 'zarinpal';
    else if (all.ResCode !== undefined && (all.token !== undefined || all.Token !== undefined)) key = 'melli';
    else if (all.RRN !== undefined || all.RefNum !== undefined) key = 'saman';
    else key = activeGatewayKey();
  }
  const parsed = GATEWAYS[key].parseCallback(req);
  return { ...parsed, gateway: key, gatewayLabel: GATEWAYS[key].label };
}

function getErrorMessage(code, gateway) {
  const key = gateway && GATEWAYS[gateway] ? gateway : activeGatewayKey();
  return GATEWAYS[key].errorMessage(code);
}

// ============================================================
// تست اتصال
// ============================================================
async function testConnection(gateway) {
  const key = gateway && GATEWAYS[gateway] ? gateway : activeGatewayKey();
  const gw = GATEWAYS[key];
  if (!gw) return { ok: false, message: 'درگاه پرداخت نامعتبر است.' };
  try {
    const r = await gw.testConnection(gatewayConfig(key));
    return { ...r, gateway: key, label: gw.label };
  } catch (err) {
    return { ok: false, gateway: key, label: gw.label, message: err.message };
  }
}

module.exports = {
  GATEWAY_KEYS,
  createPayment,
  verifyPayment,
  parseCallback,
  getErrorMessage,
  testConnection,
  listGateways,
  activeGatewayKey,
  isGatewayConfigured,
  isOnlineAvailable,
  gatewayLabel,
  gatewayConfig,
  callbackBaseUrl,
  takeFormPost,
  renderRedirectPage,
};
