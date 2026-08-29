// routes/auth.js — ثبت‌نام، ورود، بازیابی رمز، پروفایل کاربری
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, authRequired, withRole } = require('../auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  const u = withRole(user);
  const { password_hash, permissions, ...rest } = u;
  return rest;
}

// ---------- ثبت‌نام ----------
router.post('/register', (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'نام و نام خانوادگی را وارد کنید.' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'ایمیل معتبر وارد کنید.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (exists) return res.status(409).json({ error: 'کاربری با این ایمیل قبلاً ثبت‌نام کرده است.' });

  const role = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get();
  const roleId = role ? role.id : db.prepare("SELECT id FROM roles ORDER BY id ASC LIMIT 1").get().id;

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash, role_id) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), email.trim().toLowerCase(), (phone || '').trim(), hash, roleId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.json({ token: signToken(user), user: publicUser(user) });
});

// ---------- ورود ----------
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'ایمیل و رمز عبور را وارد کنید.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
  }
  if (user.status !== 'active') return res.status(403).json({ error: 'حساب شما غیرفعال شده است.' });
  const pub = publicUser(user);
  // مدیران برای پنل مدیریت به لیست دسترسی‌ها نیاز دارند
  if (pub.is_admin) pub.permissions = withRole(user).permissions;
  res.json({ token: signToken(user), user: pub });
});

// ---------- فراموشی رمز عبور ----------
router.post('/forgot', (req, res) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'ایمیل معتبر وارد کنید.' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  if (!user) return res.json({ ok: true }); // عدم افشای وجود کاربر

  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json')
    .run('reset_' + user.email, JSON.stringify({ code, created: Date.now() }));
  console.log('[reset-code]', user.email, code);
  // در نسخه واقعی کد از طریق ایمیل/پیامک ارسال می‌شود؛ در دمو همین‌جا نمایش داده می‌شود
  res.json({ ok: true, demo_code: code, message: 'کد بازیابی صادر شد.' });
});

// ---------- بازیابی رمز با کد ----------
router.post('/reset', (req, res) => {
  const { email, code, password } = req.body || {};
  if (!email || !code || !password || password.length < 6) {
    return res.status(400).json({ error: 'اطلاعات ناقص است. رمز جدید حداقل ۶ کاراکتر باشد.' });
  }
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get('reset_' + String(email).trim().toLowerCase());
  if (!row) return res.status(400).json({ error: 'ابتدا درخواست بازیابی بدهید.' });
  const { code: saved, created } = JSON.parse(row.value_json);
  if (Date.now() - created > 15 * 60 * 1000) return res.status(400).json({ error: 'کد بازیابی منقضی شده است.' });
  if (String(saved) !== String(code)) return res.status(400).json({ error: 'کد وارد شده صحیح نیست.' });

  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?')
    .run(bcrypt.hashSync(String(password), 10), String(email).trim().toLowerCase());
  db.prepare('DELETE FROM settings WHERE key = ?').run('reset_' + String(email).trim().toLowerCase());
  res.json({ ok: true, message: 'رمز عبور با موفقیت تغییر کرد.' });
});

// ---------- اطلاعات کاربر جاری ----------
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

// ---------- ویرایش پروفایل ----------
router.put('/profile', authRequired, (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'نام را وارد کنید.' });
  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name.trim(), (phone || '').trim(), req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, user: publicUser(user) });
});

// ---------- تغییر رمز عبور ----------
router.put('/password', authRequired, (req, res) => {
  const { current, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), user.password_hash)) {
    return res.status(400).json({ error: 'رمز عبور فعلی اشتباه است.' });
  }
  if (!password || password.length < 6) return res.status(400).json({ error: 'رمز جدید حداقل ۶ کاراکتر باشد.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(password), 10), req.user.id);
  res.json({ ok: true, message: 'رمز عبور تغییر کرد.' });
});

// ---------- آدرس‌ها ----------
router.get('/addresses', authRequired, (req, res) => {
  res.json({ addresses: db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.user.id) });
});
router.post('/addresses', authRequired, (req, res) => {
  const { title, full_name, phone, province, city, address, postal_code, is_default } = req.body || {};
  if (!full_name || !address || !phone) return res.status(400).json({ error: 'نام، تلفن و آدرس الزامی است.' });
  if (is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  const info = db.prepare(
    'INSERT INTO addresses (user_id, title, full_name, phone, province, city, address, postal_code, is_default) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(req.user.id, title || '', full_name, phone, province || '', city || '', address, postal_code || '', is_default ? 1 : 0);
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/addresses/:id', authRequired, (req, res) => {
  const a = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!a) return res.status(404).json({ error: 'آدرس یافت نشد.' });
  const b = req.body || {};
  if (b.is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
  db.prepare('UPDATE addresses SET title=?, full_name=?, phone=?, province=?, city=?, address=?, postal_code=?, is_default=? WHERE id=?')
    .run(b.title ?? a.title, b.full_name ?? a.full_name, b.phone ?? a.phone, b.province ?? a.province,
         b.city ?? a.city, b.address ?? a.address, b.postal_code ?? a.postal_code,
         b.is_default ? 1 : (a.is_default ? 1 : 0), a.id);
  res.json({ ok: true });
});
router.delete('/addresses/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ---------- علاقه‌مندی‌ها ----------
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
  db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)').run(req.user.id, pid);
  res.json({ ok: true });
});
router.delete('/wishlist/:productId', authRequired, (req, res) => {
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  res.json({ ok: true });
});

module.exports = router;
