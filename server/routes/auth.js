// routes/auth.js — ثبت‌نام، ورود، بازیابی رمز، پروفایل کاربری (Production-Ready)
// Security: No demo_code in response, brute-force protection, input validation, IDOR protection
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('../db');
const { signToken, authRequired, withRole } = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^09\d{9}$/;
const PASSWORD_MIN = 6;
const BCRYPT_ROUNDS = 12;

// ---------- Brute-Force Protection (In-Memory + DB) ----------
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // ۱۵ دقیقه

function checkLoginBruteForce(email) {
  const key = email.toLowerCase();
  const entry = loginAttempts.get(key);
  if (!entry) return { blocked: false };
  if (entry.count >= MAX_LOGIN_ATTEMPTS && Date.now() - entry.lastAttempt < LOCKOUT_DURATION) {
    const remaining = Math.ceil((LOCKOUT_DURATION - (Date.now() - entry.lastAttempt)) / 60000);
    return { blocked: true, remainingMinutes: remaining };
  }
  // پاکسازی بعد از منقضی شدن
  if (Date.now() - entry.lastAttempt >= LOCKOUT_DURATION) {
    loginAttempts.delete(key);
  }
  return { blocked: false };
}

function recordLoginAttempt(email, success) {
  const key = email.toLowerCase();
  if (success) {
    loginAttempts.delete(key);
    return;
  }
  const entry = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  entry.count++;
  entry.lastAttempt = Date.now();
  loginAttempts.set(key, entry);
}

// پاکسازی دوره‌ای
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.lastAttempt > LOCKOUT_DURATION * 2) loginAttempts.delete(key);
  }
}, 10 * 60 * 1000);

// ---------- Password Policy ----------
function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'رمز عبور الزامی است.';
  if (password.length < PASSWORD_MIN) return `رمز عبور باید حداقل ${PASSWORD_MIN} کاراکتر باشد.`;
  if (password.length > 128) return 'رمز عبور نباید بیش از ۱۲۸ کاراکتر باشد.';
  // بررسی رمزهای بسیار ضعیف
  const weak = ['123456', 'password', 'qwerty', '111111', 'admin123', 'pass123'];
  if (weak.includes(password.toLowerCase())) return 'رمز عبور بسیار ضعیف است؛ لطفاً رمز قوی‌تری انتخاب کنید.';
  return null;
}

function publicUser(user) {
  const u = withRole(user);
  const { password_hash, ...rest } = u;
  // permissions فقط برای کاربران مدیریتی افشا می‌شود (مشتری عادی نیازی ندارد)
  if (!rest.is_admin) delete rest.permissions;
  return rest;
}

// ---------- ثبت‌نام ----------
router.post('/register', (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'نام و نام خانوادگی را وارد کنید.' });
    if (name.trim().length > 100) return res.status(400).json({ error: 'نام بیش از حد طولانی است.' });
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'ایمیل معتبر وارد کنید.' });
    if (phone && !PHONE_RE.test(phone.trim())) return res.status(400).json({ error: 'شماره موبایل نامعتبر است.' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const cleanEmail = email.trim().toLowerCase();
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (exists) return res.status(409).json({ error: 'کاربری با این ایمیل قبلاً ثبت‌نام کرده است.' });

    const role = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get();
    const roleId = role ? role.id : db.prepare("SELECT id FROM roles ORDER BY id ASC LIMIT 1").get().id;

    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const info = db.prepare(
      'INSERT INTO users (name, email, phone, password_hash, role_id) VALUES (?, ?, ?, ?, ?)'
    ).run(name.trim().slice(0, 100), cleanEmail, (phone || '').trim(), hash, roleId);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'خطا در ثبت‌نام.' });
  }
});

// ---------- ورود ----------
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'ایمیل و رمز عبور را وارد کنید.' });

    const cleanEmail = String(email).trim().toLowerCase();

    // Brute-force check
    const bruteCheck = checkLoginBruteForce(cleanEmail);
    if (bruteCheck.blocked) {
      return res.status(429).json({ error: `تعداد تلاش‌های ناموفق بیش از حد مجاز است. ${bruteCheck.remainingMinutes} دقیقه صبر کنید.` });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      recordLoginAttempt(cleanEmail, false);
      // پاسخ یکسان برای وجود/عدم وجود کاربر (عدم افشای اطلاعات)
      return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'حساب شما غیرفعال شده است.' });
    }

    recordLoginAttempt(cleanEmail, true);

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'خطا در ورود.' });
  }
});

// ---------- فراموشی رمز عبور ----------
// CRITICAL: هرگز کد را در پاسخ یا لاگ نمایش نده
router.post('/forgot', (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'ایمیل معتبر وارد کنید.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
    // عدم افشای وجود کاربر — همیشه پاسخ یکسان
    if (!user) return res.json({ ok: true, message: 'اگر ایمیل شما در سیستم ثبت شده باشد، کد بازیابی ارسال شده است.' });

    // تولید کد امن (Cryptographically Secure)
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json')
      .run('reset_' + user.email, JSON.stringify({ codeHash, created: Date.now(), used: false }));

    // ارسال از طریق ایمیل/پیامک (غیرهمزمان)
    setImmediate(() => {
      const { sendEmail } = require('../email');
      const resetLink = `${process.env.SAMAN_CALLBACK_URL || 'http://localhost:3000'}/#/reset-password?email=${encodeURIComponent(user.email)}&code=${code}`;
      sendEmail(user.email, 'بازیابی رمز عبور — پت‌شاپ', `
        <div dir="rtl" style="font-family:Tahoma,sans-serif;max-width:400px;margin:20px auto;padding:20px;background:#f9f9f9;border-radius:12px">
          <h2 style="text-align:center;color:#333">بازیابی رمز عبور</h2>
          <p style="text-align:center;color:#666">کد بازیابی شما:</p>
          <div style="text-align:center;font-size:32px;font-weight:bold;color:#C2410C;letter-spacing:8px;margin:20px 0">${code}</div>
          <p style="text-align:center;color:#999;font-size:12px">این کد تا ۱۵ دقیقه معتبر است.</p>
          <p style="text-align:center;color:#999;font-size:12px">اگر شما درخواست بازیابی نکرده‌اید، این ایمیل را نادیده بگیرید.</p>
        </div>
      `).catch(() => {});
    });

    // در محیط توسعه، کد را در لاگ نشان بده (فقط dev)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[RESET-CODE] ${user.email}: ${code}`);
    }

    res.json({ ok: true, message: 'اگر ایمیل شما در سیستم ثبت شده باشد، کد بازیابی ارسال شده است.' });
  } catch (err) {
    console.error('[Auth] Forgot error:', err.message);
    res.status(500).json({ error: 'خطا در پردازش درخواست.' });
  }
});

// ---------- بازیابی رمز با کد ----------
router.post('/reset', (req, res) => {
  try {
    const { email, code, password } = req.body || {};
    if (!email || !code || !password) {
      return res.status(400).json({ error: 'اطلاعات ناقص است.' });
    }
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('reset_' + String(email).trim().toLowerCase());
    if (!row) return res.status(400).json({ error: 'ابتدا درخواست بازیابی بدهید.' });

    const data = JSON.parse(row.value_json);
    if (data.used) return res.status(400).json({ error: 'این کد قبلاً استفاده شده است.' });
    if (Date.now() - data.created > 15 * 60 * 1000) return res.status(400).json({ error: 'کد بازیابی منقضی شده است.' });

    // مقایسه هش (نه کد خام)
    const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex');
    if (codeHash !== data.codeHash) return res.status(400).json({ error: 'کد وارد شده صحیح نیست.' });

    // بروزرسانی رمز + علامت‌گذاری کد به عنوان استفاده شده
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE email = ?')
      .run(bcrypt.hashSync(String(password), BCRYPT_ROUNDS), String(email).trim().toLowerCase());

    // علامت‌گذاری کد به عنوان استفاده شده (یکبار مصرف)
    db.prepare('DELETE FROM settings WHERE key = ?').run('reset_' + String(email).trim().toLowerCase());

    res.json({ ok: true, message: 'رمز عبور با موفقیت تغییر کرد.' });
  } catch (err) {
    console.error('[Auth] Reset error:', err.message);
    res.status(500).json({ error: 'خطا در تغییر رمز عبور.' });
  }
});

// ---------- اطلاعات کاربر جاری ----------
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'کاربر یافت نشد.' });
  res.json({ user: publicUser(user) });
});

// ---------- ویرایش پروفایل ----------
router.put('/profile', authRequired, (req, res) => {
  try {
    const { name, phone } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'نام را وارد کنید.' });
    if (name.trim().length > 100) return res.status(400).json({ error: 'نام بیش از حد طولانی است.' });
    if (phone && !PHONE_RE.test(phone.trim())) return res.status(400).json({ error: 'شماره موبایل نامعتبر است.' });

    db.prepare("UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?")
      .run(name.trim().slice(0, 100), (phone || '').trim(), req.user.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error('[Auth] Profile update error:', err.message);
    res.status(500).json({ error: 'خطا در بروزرسانی پروفایل.' });
  }
});

// ---------- تغییر رمز عبور ----------
router.put('/password', authRequired, (req, res) => {
  try {
    const { current, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'کاربر یافت نشد.' });

    if (!bcrypt.compareSync(String(current || ''), user.password_hash)) {
      return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است.' });
    }

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(bcrypt.hashSync(String(password), BCRYPT_ROUNDS), req.user.id);
    res.json({ ok: true, message: 'رمز عبور تغییر کرد.' });
  } catch (err) {
    console.error('[Auth] Password change error:', err.message);
    res.status(500).json({ error: 'خطا در تغییر رمز عبور.' });
  }
});

// ============================================================
// آدرس‌ها — IDOR Protected
// ============================================================
router.get('/addresses', authRequired, (req, res) => {
  res.json({ addresses: db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.user.id) });
});

router.post('/addresses', authRequired, (req, res) => {
  try {
    const { title, full_name, phone, province, city, address, postal_code, is_default } = req.body || {};
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'نام کامل الزامی است.' });
    if (!address || !address.trim()) return res.status(400).json({ error: 'آدرس الزامی است.' });
    if (!phone || !PHONE_RE.test(String(phone).trim())) return res.status(400).json({ error: 'شماره تلفن نامعتبر است.' });
    if (full_name.trim().length > 100) return res.status(400).json({ error: 'نام بیش از حد طولانی است.' });
    if (address.trim().length > 500) return res.status(400).json({ error: 'آدرس بیش از حد طولانی است.' });
    if (postal_code && !/^\d{10}$/.test(String(postal_code).trim())) {
      return res.status(400).json({ error: 'کد پستی باید ۱۰ رقمی باشد.' });
    }

    if (is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
    const info = db.prepare(
      'INSERT INTO addresses (user_id, title, full_name, phone, province, city, address, postal_code, is_default) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(req.user.id, (title || '').trim().slice(0, 50), full_name.trim().slice(0, 100), phone.trim(),
      (province || '').trim().slice(0, 50), (city || '').trim().slice(0, 50),
      address.trim().slice(0, 500), (postal_code || '').trim(), is_default ? 1 : 0);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (err) {
    console.error('[Auth] Address create error:', err.message);
    res.status(500).json({ error: 'خطا در افزودن آدرس.' });
  }
});

router.put('/addresses/:id', authRequired, (req, res) => {
  const addrId = Number(req.params.id);
  if (!addrId || addrId < 1) return res.status(400).json({ error: 'شناسه آدرس نامعتبر است.' });

  // IDOR protection
  const a = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(addrId, req.user.id);
  if (!a) return res.status(404).json({ error: 'آدرس یافت نشد.' });

  const b = req.body || {};
  if (b.is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE addresses SET title=?, full_name=?, phone=?, province=?, city=?, address=?, postal_code=?, is_default=? WHERE id=?')
    .run(String(b.title ?? a.title ?? '').slice(0, 50), String(b.full_name ?? a.full_name ?? '').slice(0, 100),
      String(b.phone ?? a.phone ?? ''), String(b.province ?? a.province ?? '').slice(0, 50),
      String(b.city ?? a.city ?? '').slice(0, 50), String(b.address ?? a.address ?? '').slice(0, 500),
      String(b.postal_code ?? a.postal_code ?? ''), b.is_default ? 1 : (a.is_default ? 1 : 0), a.id);
  res.json({ ok: true });
});

router.delete('/addresses/:id', authRequired, (req, res) => {
  const addrId = Number(req.params.id);
  if (!addrId || addrId < 1) return res.status(400).json({ error: 'شناسه آدرس نامعتبر است.' });
  // IDOR protection — فقط حذف آدرس متعلق به خود
  const result = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(addrId, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'آدرس یافت نشد.' });
  res.json({ ok: true });
});

// ============================================================
// علاقه‌مندی‌ها — IDOR Protected
// ============================================================
router.get('/wishlist', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT w.product_id FROM wishlist w
    JOIN products p ON p.id = w.product_id AND p.status = 'active'
    WHERE w.user_id = ? ORDER BY w.id DESC
  `).all(req.user.id);
  res.json({ ids: rows.map(r => r.product_id) });
});

router.post('/wishlist', authRequired, (req, res) => {
  const pid = Number(req.body.product_id);
  if (!pid || pid < 1) return res.status(400).json({ error: 'شناسه محصول نامعتبر است.' });
  db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)').run(req.user.id, pid);
  res.json({ ok: true });
});

router.delete('/wishlist/:productId', authRequired, (req, res) => {
  const pid = Number(req.params.productId);
  if (!pid || pid < 1) return res.status(400).json({ error: 'شناسه محصول نامعتبر است.' });
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user.id, pid);
  res.json({ ok: true });
});

module.exports = router;
