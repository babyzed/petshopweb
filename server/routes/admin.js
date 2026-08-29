// routes/admin.js — تمام عملیات پنل مدیریت (Database Driven)
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, getSetting, setSetting } = require('../db');
const { authRequired, requirePerm, withRole } = require('../auth');
const { PERMISSION_CATALOG, hasPermission } = require('../permissions');
const { upload } = require('../upload');

const router = express.Router();
router.use(authRequired);

// ============================================================
// داشبورد
// ============================================================
router.get('/dashboard', requirePerm('dashboard.view'), (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysAgo = n => { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status NOT IN ('cancelled')").get().s;
  const paidRevenue = db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status IN ('paid','shipped','delivered')").get().s;
  const orderCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status NOT IN ('cancelled')").get().c;
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role_id NOT IN (SELECT id FROM roles WHERE name IN ('super_admin','admin','content','support'))").get().c;
  const newUsers = db.prepare('SELECT COUNT(*) AS c FROM users WHERE date(created_at) >= ?').get(daysAgo(6)).c;
  const todayOrders = db.prepare('SELECT COUNT(*) AS c FROM orders WHERE date(created_at) = ?').get(daysAgo(0)).c;
  const todayRevenue = db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE date(created_at) = ? AND status NOT IN ('cancelled')").get(daysAgo(0)).s;

  // نمودار ۳۰ روز اخیر
  const chart = [];
  for (let i = 29; i >= 0; i--) {
    const day = daysAgo(i);
    const row = db.prepare("SELECT COALESCE(SUM(total),0) AS s, COUNT(*) AS c FROM orders WHERE date(created_at) = ? AND status NOT IN ('cancelled')").get(day);
    chart.push({ day, revenue: row.s, orders: row.c });
  }

  const bestsellers = db.prepare(`
    SELECT oi.product_id, p.name,
      COALESCE((SELECT image FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1),'') AS image,
      SUM(oi.quantity) AS sold, SUM(oi.total) AS total
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
    GROUP BY oi.product_id ORDER BY sold DESC LIMIT 5
  `).all();

  const recent = db.prepare("SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 8").all();
  const lowStock = db.prepare(`
    SELECT p.id, p.name, p.stock,
      COALESCE((SELECT image FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1),'') AS image
    FROM products p WHERE p.status = 'active' AND p.stock <= 10 ORDER BY p.stock ASC LIMIT 8
  `).all();

  // وضعیت سفارش‌ها برای دایره
  const statusDist = db.prepare('SELECT status, COUNT(*) AS c FROM orders GROUP BY status').all();

  // فروش به تفکیک دسته
  const catSales = db.prepare(`
    SELECT c.name, SUM(oi.total) AS total FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
    JOIN products p ON p.id = oi.product_id LEFT JOIN categories c ON c.id = p.category_id
    GROUP BY c.id ORDER BY total DESC LIMIT 6
  `).all();

  res.json({
    revenue, paidRevenue, orderCount, userCount, newUsers, todayOrders, todayRevenue,
    chart, bestsellers, recent, lowStock, statusDist, catSales,
  });
});

// ============================================================
// محصولات
// ============================================================
router.get('/products', requirePerm('products.manage'), (req, res) => {
  const { q, category, status, page = 1, per_page = 15 } = req.query;
  const where = ['1=1']; const params = [];
  if (q) { where.push('(p.name LIKE ? OR p.sku LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (category) { where.push('p.category_id = ?'); params.push(Number(category)); }
  if (status && status !== 'all') { where.push('p.status = ?'); params.push(status); }
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Number(per_page) || 15);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM products p WHERE ${where.join(' AND ')}`).get(...params).c;
  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name, b.name AS brand_name,
      COALESCE((SELECT image FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1),'') AS image
    FROM products p LEFT JOIN categories c ON c.id=p.category_id LEFT JOIN brands b ON b.id=p.brand_id
    WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT ? OFFSET ?
  `).all(...params, size, (pageNum - 1) * size);
  res.json({ products: rows, total, page: pageNum, pages: Math.ceil(total / size) });
});

router.get('/products/:id', requirePerm('products.manage'), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'محصول یافت نشد.' });
  p.features = (() => { try { return JSON.parse(p.features); } catch { return {}; } })();
  p.images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC').all(p.id);
  res.json({ product: p });
});

function slugifyFa(str) {
  const s = String(str).trim().toLowerCase()
    .replace(/[^\w\u0600-\u06FF\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return s || 'item-' + Date.now();
}

router.post('/products', requirePerm('products.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.price) return res.status(400).json({ error: 'نام و قیمت محصول الزامی است.' });
  let slug = slugifyFa(b.slug || b.name);
  if (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) slug = slug + '-' + Date.now().toString(36);
  const info = db.prepare(`
    INSERT INTO products (name, slug, sku, category_id, brand_id, price, sale_price, stock, weight, description, features, status, is_special)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(b.name, slug, b.sku || '', b.category_id ? Number(b.category_id) : null, b.brand_id ? Number(b.brand_id) : null,
    Number(b.price), b.sale_price ? Number(b.sale_price) : null, Number(b.stock) || 0, b.weight || '',
    b.description || '', JSON.stringify(b.features || {}), b.status || 'active', b.is_special ? 1 : 0);
  if (b.images && Array.isArray(b.images)) {
    b.images.forEach((img, i) => db.prepare('INSERT INTO product_images (product_id, image, sort_order) VALUES (?,?,?)').run(info.lastInsertRowid, img, i));
  }
  res.json({ ok: true, id: info.lastInsertRowid, slug });
});

router.put('/products/:id', requirePerm('products.manage'), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'محصول یافت نشد.' });
  const b = req.body || {};
  let slug = slugifyFa(b.slug || b.name || p.name);
  const clash = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(slug, p.id);
  if (clash) slug = slug + '-' + Date.now().toString(36);
  db.prepare(`
    UPDATE products SET name=?, slug=?, sku=?, category_id=?, brand_id=?, price=?, sale_price=?, stock=?,
      weight=?, description=?, features=?, status=?, is_special=? WHERE id=?
  `).run(b.name ?? p.name, slug, b.sku ?? p.sku, b.category_id ? Number(b.category_id) : p.category_id,
    b.brand_id ? Number(b.brand_id) : p.brand_id, Number(b.price ?? p.price),
    b.sale_price !== undefined && b.sale_price !== '' && Number(b.sale_price) > 0 ? Number(b.sale_price) : null,
    Number(b.stock ?? p.stock), b.weight ?? p.weight, b.description ?? p.description,
    JSON.stringify(b.features || {}), b.status ?? p.status, b.is_special ? 1 : 0, p.id);
  res.json({ ok: true, slug });
});

router.delete('/products/:id', requirePerm('products.manage'), (req, res) => {
  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// آپلود و مدیریت تصاویر محصول
router.post('/products/:id/images', requirePerm('products.manage'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایلی دریافت نشد.' });
  const url = '/uploads/' + req.file.filename;
  const last = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM product_images WHERE product_id = ?').get(req.params.id).m;
  db.prepare('INSERT INTO product_images (product_id, image, sort_order) VALUES (?,?,?)').run(req.params.id, url, last + 1);
  res.json({ ok: true, image: url });
});
router.delete('/products/:id/images/:imgId', requirePerm('products.manage'), (req, res) => {
  db.prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?').run(req.params.imgId, req.params.id);
  res.json({ ok: true });
});

// ============================================================
// دسته‌بندی‌ها
// ============================================================
router.get('/categories', requirePerm('categories.manage'), (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
  const byParent = {};
  rows.forEach(c => { (byParent[c.parent_id || 0] = byParent[c.parent_id || 0] || []).push({ ...c, children: [] }); });
  const tree = byParent[0] || [];
  const attach = list => list.forEach(c => { c.children = byParent[c.id] || []; attach(c.children); });
  attach(tree);
  res.json({ categories: tree, flat: rows });
});
router.post('/categories', requirePerm('categories.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'نام دسته الزامی است.' });
  const info = db.prepare('INSERT INTO categories (name, slug, parent_id, image, icon, sort_order, is_active) VALUES (?,?,?,?,?,?,?)')
    .run(b.name, slugifyFa(b.slug || b.name), b.parent_id ? Number(b.parent_id) : null, b.image || '',
      b.icon || '🐾', Number(b.sort_order) || 0, b.is_active === false ? 0 : 1);
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/categories/:id', requirePerm('categories.manage'), (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'دسته یافت نشد.' });
  const b = req.body || {};
  db.prepare('UPDATE categories SET name=?, slug=?, parent_id=?, image=?, icon=?, sort_order=?, is_active=? WHERE id=?')
    .run(b.name ?? c.name, slugifyFa(b.slug || b.name || c.name), b.parent_id !== undefined ? (Number(b.parent_id) || null) : c.parent_id,
      b.image ?? c.image, b.icon ?? c.icon, Number(b.sort_order ?? c.sort_order), b.is_active === false ? 0 : 1, c.id);
  res.json({ ok: true });
});
router.delete('/categories/:id', requirePerm('categories.manage'), (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?').get(req.params.id).c;
  if (used > 0) return res.status(400).json({ error: `این دسته دارای ${used} محصول است؛ ابتدا محصولات را جابه‌جا کنید.` });
  db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// برندها
// ============================================================
router.get('/brands', requirePerm('brands.manage'), (req, res) => {
  res.json({ brands: db.prepare('SELECT * FROM brands ORDER BY name ASC').all() });
});
router.post('/brands', requirePerm('brands.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'نام برند الزامی است.' });
  const info = db.prepare('INSERT INTO brands (name, slug, logo, is_active) VALUES (?,?,?,?)')
    .run(b.name, slugifyFa(b.slug || b.name), b.logo || '', b.is_active === false ? 0 : 1);
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/brands/:id', requirePerm('brands.manage'), (req, res) => {
  const c = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'برند یافت نشد.' });
  const b = req.body || {};
  db.prepare('UPDATE brands SET name=?, slug=?, logo=?, is_active=? WHERE id=?')
    .run(b.name ?? c.name, slugifyFa(b.slug || b.name || c.name), b.logo ?? c.logo, b.is_active === false ? 0 : 1, c.id);
  res.json({ ok: true });
});
router.delete('/brands/:id', requirePerm('brands.manage'), (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS c FROM products WHERE brand_id = ?').get(req.params.id).c;
  if (used > 0) return res.status(400).json({ error: `این برند روی ${used} محصول ثبت شده است.` });
  db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// سفارش‌ها
// ============================================================
router.get('/orders', requirePerm('orders.manage'), (req, res) => {
  const { status, q, page = 1, per_page = 15 } = req.query;
  const where = ['1=1']; const params = [];
  if (status && status !== 'all') { where.push('o.status = ?'); params.push(status); }
  if (q) { where.push('(o.code LIKE ? OR o.customer_json LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Number(per_page) || 15);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM orders o WHERE ${where.join(' AND ')}`).get(...params).c;
  const rows = db.prepare(`
    SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT ? OFFSET ?
  `).all(...params, size, (pageNum - 1) * size);
  res.json({ orders: rows, total, page: pageNum, pages: Math.ceil(total / size) });
});

router.get('/orders/:id', requirePerm('orders.manage'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  order.customer = JSON.parse(order.customer_json || '{}');
  const user = order.user_id ? db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(order.user_id) : null;
  res.json({ order, user });
});

router.put('/orders/:id/status', requirePerm('orders.manage'), (req, res) => {
  const { status } = req.body || {};
  const valid = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'وضعیت نامعتبر است.' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  if (status === 'cancelled' && order.status !== 'cancelled') {
    db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
      .forEach(oi => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(oi.quantity, oi.product_id));
  }
  res.json({ ok: true, message: 'وضعیت سفارش به‌روزرسانی شد.' });
});

// ============================================================
// کاربران
// ============================================================
router.get('/users', requirePerm('users.manage'), (req, res) => {
  const { q, page = 1, per_page = 15 } = req.query;
  const where = ['1=1']; const params = [];
  if (q) { where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Number(per_page) || 15);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM users u WHERE ${where.join(' AND ')}`).get(...params).c;
  const rows = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.status, u.created_at, r.title AS role_title, r.name AS role_name,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
    FROM users u LEFT JOIN roles r ON r.id = u.role_id
    WHERE ${where.join(' AND ')} ORDER BY u.id DESC LIMIT ? OFFSET ?
  `).all(...params, size, (pageNum - 1) * size);
  res.json({ users: rows, total, page: pageNum, pages: Math.ceil(total / size) });
});

router.get('/users/:id', requirePerm('users.manage'), (req, res) => {
  const u = db.prepare('SELECT u.*, r.title AS role_title FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'کاربر یافت نشد.' });
  u.orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(u.id);
  u.addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ?').all(u.id);
  delete u.password_hash;
  res.json({ user: u });
});

// ساخت کاربر جدید (مدیر اصلی می‌تواند ادمین دلخواه بسازد)
router.post('/users', requirePerm('users.manage'), (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  const email = (b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const phone = (b.phone || '').trim();
  if (!name) return res.status(400).json({ error: 'نام و نام خانوادگی را وارد کنید.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'ایمیل معتبر وارد کنید.' });
  if (password.length < 6) return res.status(400).json({ error: 'رمز عبور حداقل ۶ کاراکتر باشد.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(400).json({ error: 'این ایمیل قبلاً ثبت شده است.' });
  }
  let roleId = null;
  if (b.role_id) {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(b.role_id));
    if (!role) return res.status(400).json({ error: 'نقش نامعتبر است.' });
    // تعیین نقش اداری فقط توسط مدیر کل (super_admin)
    if (!hasPermission(req.user.permissions, 'roles.manage')) {
      return res.status(403).json({ error: 'تعیین نقش نیازمند دسترسی مدیریت نقش‌ها است.' });
    }
    roleId = role.id;
  } else {
    roleId = db.prepare("SELECT id FROM roles WHERE name = 'customer'").get()?.id || null;
  }
  const info = db.prepare('INSERT INTO users (name, email, phone, password_hash, role_id, status) VALUES (?,?,?,?,?,?)')
    .run(name, email, phone, bcrypt.hashSync(password, 10), roleId, 'active');
  res.json({ ok: true, message: 'کاربر با موفقیت ساخته شد ✅', id: info.lastInsertRowid });
});

router.put('/users/:id', requirePerm('users.manage'), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'کاربر یافت نشد.' });
  const b = req.body || {};
  const role = b.role_id ? db.prepare('SELECT * FROM roles WHERE id = ?').get(Number(b.role_id)) : null;
  if (b.role_id && !role) return res.status(400).json({ error: 'نقش نامعتبر است.' });
  // فقط super_admin می‌تواند نقش عوض کند
  if (b.role_id && !hasPermission(req.user.permissions, 'roles.manage')) {
    return res.status(403).json({ error: 'تغییر نقش نیاز به دسترسی مدیریت نقش‌ها دارد.' });
  }
  // محافظ‌ها
  if (b.role_id && role && Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'نمی‌توانید نقش خودتان را تغییر دهید.' });
  }
  if (b.role_id && role && role.name !== 'super_admin' && u.role_id) {
    const cur = db.prepare('SELECT name FROM roles WHERE id = ?').get(u.role_id);
    if (cur && cur.name === 'super_admin') {
      const superCount = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role_id IN (SELECT id FROM roles WHERE name = 'super_admin')").get().c;
      if (superCount <= 1) return res.status(400).json({ error: 'حداقل یک مدیر کل باید باقی بماند.' });
    }
  }
  db.prepare('UPDATE users SET name=?, phone=?, status=?, role_id=? WHERE id=?')
    .run(b.name ?? u.name, b.phone ?? u.phone, b.status ?? u.status, role ? role.id : u.role_id, u.id);
  res.json({ ok: true, message: 'کاربر به‌روزرسانی شد.' });
});

// ============================================================
// نظرات محصولات
// ============================================================
router.get('/reviews', requirePerm('reviews.manage'), (req, res) => {
  const { status = 'all', page = 1, per_page = 15 } = req.query;
  const where = status === 'all' ? '1=1' : 'r.status = ?';
  const params = status === 'all' ? [] : [status];
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Number(per_page) || 15);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM product_reviews r WHERE ${where}`).get(...params).c;
  const rows = db.prepare(`
    SELECT r.*, p.name AS product_name, p.slug AS product_slug, u.name AS user_name
    FROM product_reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id
    WHERE ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?
  `).all(...params, size, (pageNum - 1) * size);
  res.json({ reviews: rows, total, page: pageNum, pages: Math.ceil(total / size) });
});
router.put('/reviews/:id/status', requirePerm('reviews.manage'), (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'وضعیت نامعتبر است.' });
  db.prepare('UPDATE product_reviews SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});
router.delete('/reviews/:id', requirePerm('reviews.manage'), (req, res) => {
  db.prepare('DELETE FROM product_reviews WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// کدهای تخفیف
// ============================================================
router.get('/coupons', requirePerm('coupons.manage'), (req, res) => {
  res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() });
});
router.post('/coupons', requirePerm('coupons.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.value) return res.status(400).json({ error: 'کد و مقدار تخفیف الزامی است.' });
  if (!['percent', 'fixed'].includes(b.type)) return res.status(400).json({ error: 'نوع تخفیف نامعتبر است.' });
  db.prepare('INSERT INTO coupons (code, type, value, min_amount, max_usage, expires_at, is_active) VALUES (?,?,?,?,?,?,?)')
    .run(String(b.code).trim().toUpperCase(), b.type, Number(b.value), Number(b.min_amount) || 0,
      Number(b.max_usage) || 0, b.expires_at || null, b.is_active === false ? 0 : 1);
  res.json({ ok: true });
});
router.put('/coupons/:id', requirePerm('coupons.manage'), (req, res) => {
  const c = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'کد تخفیف یافت نشد.' });
  const b = req.body || {};
  db.prepare('UPDATE coupons SET code=?, type=?, value=?, min_amount=?, max_usage=?, expires_at=?, is_active=? WHERE id=?')
    .run(String(b.code ?? c.code).trim().toUpperCase(), b.type ?? c.type, Number(b.value ?? c.value),
      Number(b.min_amount ?? c.min_amount) || 0, Number(b.max_usage ?? c.max_usage) || 0,
      b.expires_at !== undefined ? b.expires_at : c.expires_at, b.is_active === false ? 0 : 1, c.id);
  res.json({ ok: true });
});
router.delete('/coupons/:id', requirePerm('coupons.manage'), (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// بنرها
// ============================================================
router.get('/banners', requirePerm('banners.manage'), (req, res) => {
  res.json({ banners: db.prepare('SELECT * FROM banners ORDER BY position ASC, sort_order ASC, id ASC').all() });
});
router.post('/banners', requirePerm('banners.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'عنوان بنر الزامی است.' });
  const info = db.prepare('INSERT INTO banners (title, subtitle, image, link, position, sort_order, is_active) VALUES (?,?,?,?,?,?,?)')
    .run(b.title, b.subtitle || '', b.image || '', b.link || '', b.position || 'hero', Number(b.sort_order) || 0, b.is_active === false ? 0 : 1);
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/banners/:id', requirePerm('banners.manage'), (req, res) => {
  const c = db.prepare('SELECT * FROM banners WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'بنر یافت نشد.' });
  const b = req.body || {};
  db.prepare('UPDATE banners SET title=?, subtitle=?, image=?, link=?, position=?, sort_order=?, is_active=? WHERE id=?')
    .run(b.title ?? c.title, b.subtitle ?? c.subtitle, b.image ?? c.image, b.link ?? c.link,
      b.position ?? c.position, Number(b.sort_order ?? c.sort_order), b.is_active === false ? 0 : 1, c.id);
  res.json({ ok: true });
});
router.delete('/banners/:id', requirePerm('banners.manage'), (req, res) => {
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});
router.post('/banners/:id/image', requirePerm('banners.manage'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایلی دریافت نشد.' });
  const url = '/uploads/' + req.file.filename;
  db.prepare('UPDATE banners SET image = ? WHERE id = ?').run(url, req.params.id);
  res.json({ ok: true, image: url });
});

// ============================================================
// مقالات
// ============================================================
router.get('/articles', requirePerm('articles.manage'), (req, res) => {
  res.json({ articles: db.prepare('SELECT * FROM articles ORDER BY id DESC').all() });
});
router.post('/articles', requirePerm('articles.manage'), upload.single('image'), (req, res) => {
  const b = req.body || {};
  if (!b.title || !b.content) return res.status(400).json({ error: 'عنوان و متن مقاله الزامی است.' });
  const image = req.file ? '/uploads/' + req.file.filename : (b.image || '');
  const info = db.prepare('INSERT INTO articles (title, slug, excerpt, content, image, category, status) VALUES (?,?,?,?,?,?,?)')
    .run(b.title, slugifyFa(b.slug || b.title), b.excerpt || '', b.content, image, b.category || '', b.status || 'active');
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/articles/:id', requirePerm('articles.manage'), upload.single('image'), (req, res) => {
  const c = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'مقاله یافت نشد.' });
  const b = req.body || {};
  const image = req.file ? '/uploads/' + req.file.filename : (b.image !== undefined ? b.image : c.image);
  db.prepare('UPDATE articles SET title=?, slug=?, excerpt=?, content=?, image=?, category=?, status=? WHERE id=?')
    .run(b.title ?? c.title, slugifyFa(b.slug || b.title || c.title), b.excerpt ?? c.excerpt, b.content ?? c.content,
      image, b.category ?? c.category, b.status ?? c.status, c.id);
  res.json({ ok: true });
});
router.delete('/articles/:id', requirePerm('articles.manage'), (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// محتوای صفحه اصلی (home)
// ============================================================
router.get('/home', requirePerm('home.manage'), (req, res) => {
  res.json({
    home_settings: getSetting('home_settings', {}),
    features: getSetting('features', []),
    about_teaser: getSetting('about_teaser', {}),
  });
});
router.put('/home', requirePerm('home.manage'), (req, res) => {
  const b = req.body || {};
  if (b.home_settings !== undefined) setSetting('home_settings', b.home_settings);
  if (b.features !== undefined) setSetting('features', b.features);
  if (b.about_teaser !== undefined) setSetting('about_teaser', b.about_teaser);
  res.json({ ok: true, message: 'محتوای صفحه اصلی ذخیره شد.' });
});
// آپلود تصویر عمومی (مثلاً برای بخش معرفی)
router.post('/upload', requirePerm('home.manage'), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایلی دریافت نشد.' });
  res.json({ ok: true, url: '/uploads/' + req.file.filename });
});

// ============================================================
// سوالات متداول
// ============================================================
router.get('/faqs', requirePerm('faq.manage'), (req, res) => {
  res.json({ faqs: db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all() });
});
router.post('/faqs', requirePerm('faq.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.question || !b.answer) return res.status(400).json({ error: 'پرسش و پاسخ الزامی است.' });
  db.prepare('INSERT INTO faqs (question, answer, sort_order, is_active) VALUES (?,?,?,?)')
    .run(b.question, b.answer, Number(b.sort_order) || 0, b.is_active === false ? 0 : 1);
  res.json({ ok: true });
});
router.put('/faqs/:id', requirePerm('faq.manage'), (req, res) => {
  const c = db.prepare('SELECT * FROM faqs WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'یافت نشد.' });
  const b = req.body || {};
  db.prepare('UPDATE faqs SET question=?, answer=?, sort_order=?, is_active=? WHERE id=?')
    .run(b.question ?? c.question, b.answer ?? c.answer, Number(b.sort_order ?? c.sort_order), b.is_active === false ? 0 : 1, c.id);
  res.json({ ok: true });
});
router.delete('/faqs/:id', requirePerm('faq.manage'), (req, res) => {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// نظرات مشتریان (testimonials)
// ============================================================
router.get('/testimonials', requirePerm('testimonials.manage'), (req, res) => {
  res.json({ testimonials: db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all() });
});
router.post('/testimonials', requirePerm('testimonials.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.text) return res.status(400).json({ error: 'نام و متن نظر الزامی است.' });
  db.prepare('INSERT INTO testimonials (name, role, text, rating, is_active) VALUES (?,?,?,?,?)')
    .run(b.name, b.role || '', b.text, Number(b.rating) || 5, b.is_active === false ? 0 : 1);
  res.json({ ok: true });
});
router.put('/testimonials/:id', requirePerm('testimonials.manage'), (req, res) => {
  const c = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'یافت نشد.' });
  const b = req.body || {};
  db.prepare('UPDATE testimonials SET name=?, role=?, text=?, rating=?, is_active=? WHERE id=?')
    .run(b.name ?? c.name, b.role ?? c.role, b.text ?? c.text, Number(b.rating ?? c.rating), b.is_active === false ? 0 : 1, c.id);
  res.json({ ok: true });
});
router.delete('/testimonials/:id', requirePerm('testimonials.manage'), (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============================================================
// صفحات محتوایی
// ============================================================
router.get('/pages/:key', requirePerm('pages.manage'), (req, res) => {
  const allowed = ['about_page', 'rules_page'];
  if (!allowed.includes(req.params.key)) return res.status(404).json({ error: 'صفحه یافت نشد.' });
  res.json({ page: getSetting(req.params.key, { title: '', content: '', image: '' }) });
});
router.put('/pages/:key', requirePerm('pages.manage'), (req, res) => {
  const allowed = ['about_page', 'rules_page'];
  if (!allowed.includes(req.params.key)) return res.status(404).json({ error: 'صفحه یافت نشد.' });
  setSetting(req.params.key, req.body || {});
  res.json({ ok: true, message: 'صفحه ذخیره شد.' });
});

// ============================================================
// تنظیمات عمومی
// ============================================================
router.get('/settings', requirePerm('settings.manage'), (req, res) => {
  res.json({
    contact: getSetting('contact', {}),
    socials: getSetting('socials', {}),
    footer: getSetting('footer', {}),
    shipping: getSetting('shipping', {}),
    site: getSetting('site', {}),
  });
});
router.put('/settings', requirePerm('settings.manage'), (req, res) => {
  const b = req.body || {};
  ['contact', 'socials', 'footer', 'shipping', 'site'].forEach(k => { if (b[k] !== undefined) setSetting(k, b[k]); });
  res.json({ ok: true, message: 'تنظیمات ذخیره شد.' });
});

// ============================================================
// نقش‌ها و دسترسی‌ها
// ============================================================
router.get('/roles', requirePerm('roles.manage'), (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all().map(r => {
    let perms = [];
    try { perms = JSON.parse(r.permissions); } catch {}
    return { ...r, permissions: perms };
  });
  const stats = db.prepare('SELECT role_id, COUNT(*) AS c FROM users GROUP BY role_id').all();
  res.json({ roles, stats, catalog: PERMISSION_CATALOG });
});
router.post('/roles', requirePerm('roles.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.title) return res.status(400).json({ error: 'نام و عنوان نقش الزامی است.' });
  const perms = Array.isArray(b.permissions) ? b.permissions : [];
  perms.forEach(p => { if (!PERMISSION_CATALOG.some(c => c.key === p)) throw new Error('دسترسی نامعتبر'); });
  const info = db.prepare('INSERT INTO roles (name, title, permissions, is_system) VALUES (?,?,?,0)')
    .run(slugifyFa(b.name), b.title, JSON.stringify(perms));
  res.json({ ok: true, id: info.lastInsertRowid });
});
router.put('/roles/:id', requirePerm('roles.manage'), (req, res) => {
  const r = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'نقش یافت نشد.' });
  const b = req.body || {};
  if (r.is_system) return res.status(400).json({ error: 'نقش‌های سیستمی قابل ویرایش نیستند.' });
  const perms = Array.isArray(b.permissions) ? b.permissions : JSON.parse(r.permissions);
  perms.forEach(p => { if (!PERMISSION_CATALOG.some(c => c.key === p)) throw new Error('دسترسی نامعتبر'); });
  db.prepare('UPDATE roles SET title=?, permissions=? WHERE id=?').run(b.title ?? r.title, JSON.stringify(perms), r.id);
  res.json({ ok: true });
});
router.delete('/roles/:id', requirePerm('roles.manage'), (req, res) => {
  const r = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'نقش یافت نشد.' });
  if (r.is_system) return res.status(400).json({ error: 'نقش‌های سیستمی قابل حذف نیستند.' });
  const used = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role_id = ?').get(r.id).c;
  if (used > 0) return res.status(400).json({ error: `${used} کاربر این نقش را دارند؛ ابتدا نقش آن‌ها را تغییر دهید.` });
  db.prepare('DELETE FROM roles WHERE id = ?').run(r.id);
  res.json({ ok: true });
});

// ============================================================
// پروفایل مدیر
// ============================================================
router.put('/profile/password', (req, res) => {
  const { current, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(String(current || ''), user.password_hash)) return res.status(400).json({ error: 'رمز فعلی اشتباه است.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'رمز جدید حداقل ۶ کاراکتر باشد.' });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(password), 10), req.user.id);
  res.json({ ok: true, message: 'رمز عبور تغییر کرد.' });
});

module.exports = router;
