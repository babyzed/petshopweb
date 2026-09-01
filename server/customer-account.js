// customer-account.js — ساخت/اتصال خودکار حساب مشتری هنگام ثبت سفارش مهمان
//
// باگ: سفارش‌های «بدون ساخت حساب» با user_id = NULL ثبت می‌شدند و مشتری بعداً
// هیچ راهی برای پیگیری آن‌ها در «سفارش‌های من» نداشت.
//
// راه‌حل: هنگام ثبت سفارش مهمان، اگر شماره موبایل/ایمیل با کاربری موجود تطبیق داشت
// سفارش به آن حساب متصل می‌شود؛ در غیر این صورت به‌صورت خودکار یک حساب مشتری
// با رمز تصادفی ساخته می‌شود (کاربر بعداً با بازیابی رمز از طریق موبایل/ایمیل وارد می‌شود).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const PHONE_RE = /^09\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_DOMAIN = 'petshop.local'; // ایمیل موقت حساب‌های ساخته‌شده با شماره موبایل
const BCRYPT_ROUNDS = 12;

// نرمال‌سازی شماره موبایل (حذف فاصله، خط تیره و ...)
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return PHONE_RE.test(digits) ? digits : '';
}

function isPlaceholderEmail(email) {
  return String(email || '').toLowerCase().endsWith('@' + PLACEHOLDER_DOMAIN);
}

// ایمیل یکتای موقت برای حساب‌هایی که مشتری ایمیل نداده است
function makeGuestEmail(phone) {
  const digits = normalizePhone(phone) || 'guest';
  let email = `guest-${digits}@${PLACEHOLDER_DOMAIN}`;
  let n = 1;
  while (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    email = `guest-${digits}-${n++}@${PLACEHOLDER_DOMAIN}`;
  }
  return email;
}

// پیدا کردن یا ساخت حساب مشتری بر اساس اطلاعات سفارش
// customer: { full_name, phone, email, address, postal_code, ... }
function ensureCustomerUser(customer = {}, opts = {}) {
  const { createAddress = true } = opts;
  const phone = normalizePhone(customer.phone);
  const email = String(customer.email || '').trim().toLowerCase();

  // ۱) تطبیق با حساب موجود (اول موبایل، بعد ایمیل)
  let user = phone ? db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) : null;
  if (!user && EMAIL_RE.test(email)) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }
  if (user && user.status !== 'active') {
    // حساب غیرفعال قابل استفاده نیست؛ سفارش مهمان می‌ماند و ادمین از customer_json پیگیری می‌کند
    return { user: null, created: false, blocked: true };
  }
  if (user) return { user, created: false };

  // ۲) ساخت حساب جدید با رمز تصادفی (کاربر با «بازیابی رمز» وارد می‌شود)
  const role = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get();
  const roleId = role ? role.id : (db.prepare('SELECT id FROM roles ORDER BY id ASC LIMIT 1').get()?.id || null);
  if (!roleId) throw new Error('نقش مشتری در سیستم تعریف نشده است.');

  const name = String(customer.full_name || customer.name || 'مشتری پت‌شاپ').trim().slice(0, 100);
  const realEmail = EMAIL_RE.test(email) ? email : makeGuestEmail(phone);
  const password = crypto.randomBytes(16).toString('hex');

  const info = db.prepare(
    "INSERT INTO users (name, email, phone, password_hash, role_id, status, is_demo) VALUES (?,?,?,?,?,'active',0)"
  ).run(name, realEmail, phone, bcrypt.hashSync(password, BCRYPT_ROUNDS), roleId);

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

  // ذخیره آدرس سفارش به‌عنوان پیش‌فرض حساب (برای تسویه سریع دفعات بعد)
  if (createAddress && newUser && String(customer.address || '').trim() && phone) {
    try {
      db.prepare(`
        INSERT INTO addresses (user_id, title, full_name, phone, province, city, address, postal_code, is_default)
        VALUES (?,?,?,?,?,?,?,?,1)
      `).run(
        newUser.id,
        'آدرس سفارش',
        name,
        phone,
        String(customer.province || '').slice(0, 50),
        String(customer.city || '').slice(0, 50),
        String(customer.address).trim().slice(0, 500),
        String(customer.postal_code || '').trim().slice(0, 10)
      );
    } catch (err) {
      console.error('[Accounts] Address save error:', err.message);
    }
  }

  return { user: newUser, created: true };
}

// ---------- Backfill: اتصال سفارش‌های قدیمی مهمان به حساب کاربری ----------
// سفارش‌هایی که قبل از این اصلاح با user_id = NULL ثبت شده‌اند را بر اساس
// موبایل/ایمیل داخل customer_json به حساب موجود یا ساخته‌شده متصل می‌کند.
function backfillGuestOrders() {
  const orphans = db.prepare(
    'SELECT id, customer_json FROM orders WHERE user_id IS NULL AND is_demo = 0'
  ).all();
  if (!orphans.length) return 0;

  let linked = 0;
  db.transaction(() => {
    for (const o of orphans) {
      let c = {};
      try { c = JSON.parse(o.customer_json || '{}'); } catch { continue; }
      if (!normalizePhone(c.phone) && !EMAIL_RE.test(String(c.email || ''))) continue;
      const { user } = ensureCustomerUser(c, { createAddress: false });
      if (user) {
        const r = db.prepare('UPDATE orders SET user_id = ? WHERE id = ? AND user_id IS NULL').run(user.id, o.id);
        linked += r.changes;
      }
    }
  })();

  if (linked) {
    console.log(`[Accounts] ${linked} سفارش مهمان قدیمی به حساب کاربری متصل شد.`);
  }
  return linked;
}

module.exports = { ensureCustomerUser, backfillGuestOrders, normalizePhone, isPlaceholderEmail, makeGuestEmail };
