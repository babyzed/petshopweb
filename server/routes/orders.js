// routes/orders.js — کد تخفیف، ثبت سفارش، سفارش‌های من، پرداخت (نمایشی)
const express = require('express');
const { db, getSetting } = require('../db');
const { authRequired } = require('../auth');

const router = express.Router();

const STATUS_LABELS = {
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت شده',
  shipped: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
};

// ---------- اعتبارسنجی کد تخفیف ----------
router.post('/coupons/validate', (req, res) => {
  const { code, subtotal } = req.body || {};
  const row = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(String(code || '').trim());
  if (!row) return res.json({ valid: false, error: 'کد تخفیف معتبر نیست.' });
  if (row.expires_at && new Date(row.expires_at) < new Date()) return res.json({ valid: false, error: 'کد تخفیف منقضی شده است.' });
  if (row.max_usage > 0 && row.used_count >= row.max_usage) return res.json({ valid: false, error: 'ظرفیت استفاده از این کد تمام شده است.' });
  if (row.min_amount > 0 && subtotal < row.min_amount) return res.json({ valid: false, error: `حداقل مبلغ سفارش برای این کد ${row.min_amount.toLocaleString('fa-IR')} تومان است.` });

  let discount = row.type === 'percent' ? Math.round(subtotal * row.value / 100) : Math.min(row.value, subtotal);
  discount = Math.max(0, discount);
  res.json({ valid: true, discount, code: row.code, type: row.type, value: row.value });
});

// ---------- محاسبه هزینه ارسال ----------
function calcShipping(subtotal) {
  const shipping = getSetting('shipping', { cost: 75000, free_over: 2000000 });
  if (subtotal >= shipping.free_over) return { shipping: 0, free_over: shipping.free_over, message: 'ارسال رایگان' };
  return { shipping: shipping.cost, free_over: shipping.free_over };
}

// ---------- ثبت سفارش ----------
router.post('/orders', (req, res) => {
  const { customer, items, address, coupon_code, payment_method, note, use_coupon } = req.body || {};
  if (!customer || !customer.full_name || !customer.phone) return res.status(400).json({ error: 'اطلاعات گیرنده را کامل وارد کنید.' });
  if (!items || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'سبد خرید خالی است.' });

  // اعتبارسنجی سمت سرور (قیمت‌ها از دیتابیس خوانده می‌شوند، نه از کلاینت)
  let subtotal = 0;
  const finalItems = [];
  for (const it of items) {
    const p = db.prepare("SELECT * FROM products WHERE id = ? AND status = 'active'").get(Number(it.product_id));
    if (!p) return res.status(400).json({ error: 'یکی از محصولات موجود نیست.' });
    const qty = Math.max(1, Math.min(99, Number(it.quantity) || 1));
    if (p.stock < qty) return res.status(400).json({ error: `موجودی «${p.name}» کافی نیست (موجودی: ${p.stock}).` });
    const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
    const total = price * qty;
    subtotal += total;
    finalItems.push({ product_id: p.id, name: p.name, image: (it.image || ''), price, quantity: qty, total });
  }

  let discount = 0;
  let coupon = null;
  if (use_coupon && coupon_code) {
    const row = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(String(coupon_code).trim());
    if (!row) return res.status(400).json({ error: 'کد تخفیف معتبر نیست.' });
    if (row.expires_at && new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'کد تخفیف منقضی شده است.' });
    if (row.max_usage > 0 && row.used_count >= row.max_usage) return res.status(400).json({ error: 'ظرفیت کد تخفیف تمام شده است.' });
    if (row.min_amount > 0 && subtotal < row.min_amount) return res.status(400).json({ error: `حداقل مبلغ سفارش برای این کد ${row.min_amount.toLocaleString('fa-IR')} تومان است.` });
    discount = row.type === 'percent' ? Math.round(subtotal * row.value / 100) : Math.min(row.value, subtotal);
    coupon = row;
  }

  const { shipping } = calcShipping(subtotal - discount);
  const total = subtotal - discount + shipping;
  const userId = req.user ? req.user.id : null;
  const payment = ['online', 'cod'].includes(payment_method) ? payment_method : 'cod';

  const code = 'PS-' + Date.now().toString(36).toUpperCase() + '-' + String(Math.floor(1000 + Math.random() * 9000));
  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (code, user_id, customer_json, status, subtotal, discount, shipping, total, coupon_code, payment_method, payment_status, note)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(code, userId, JSON.stringify({ ...customer, address: address || '' }), payment === 'cod' ? 'pending' : 'paid',
      subtotal, discount, shipping, total, coupon ? coupon.code : '', payment, payment === 'cod' ? 'unpaid' : 'paid', note || '');
    const orderId = info.lastInsertRowid;
    for (const fi of finalItems) {
      db.prepare('INSERT INTO order_items (order_id, product_id, name, image, price, quantity, total) VALUES (?,?,?,?,?,?,?)')
        .run(orderId, fi.product_id, fi.name, fi.image, fi.price, fi.quantity, fi.total);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(fi.quantity, fi.product_id);
    }
    if (coupon) db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
    return orderId;
  });
  const orderId = tx();

  res.json({
    ok: true,
    order: db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId),
    message: payment === 'online'
      ? 'سفارش شما ثبت و پرداخت شد (پرداخت نمایشی).'
      : 'سفارش شما ثبت شد؛ مبلغ را هنگام تحویل پرداخت می‌کنید.',
  });
});

// ---------- پرداخت نمایشی ----------
router.post('/payments/mock', (req, res) => {
  const { code } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  db.prepare("UPDATE orders SET payment_status = 'paid', status = 'paid' WHERE id = ?").run(order.id);
  res.json({ ok: true, message: 'پرداخت با موفقیت انجام شد.' });
});

// ---------- سفارش‌های من ----------
router.get('/orders/my', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*,
      (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC
  `).all(req.user.id);
  res.json({ orders: rows.map(o => ({ ...o, status_label: STATUS_LABELS[o.status] || o.status })) });
});

router.get('/orders/my/:id', authRequired, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  order.customer = JSON.parse(order.customer_json || '{}');
  order.status_label = STATUS_LABELS[order.status] || order.status;
  order.statuses = [
    { key: 'pending', label: 'ثبت سفارش', done: ['pending','paid','shipped','delivered'].includes(order.status) },
    { key: 'paid', label: 'پرداخت', done: ['paid','shipped','delivered'].includes(order.status) },
    { key: 'shipped', label: 'ارسال', done: ['shipped','delivered'].includes(order.status) },
    { key: 'delivered', label: 'تحویل', done: order.status === 'delivered' },
  ];
  res.json({ order });
});

// ---------- لغو سفارش ----------
router.post('/orders/my/:id/cancel', authRequired, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  if (!['pending', 'paid'].includes(order.status)) return res.status(400).json({ error: 'امکان لغو این سفارش وجود ندارد.' });
  db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
  // برگرداندن موجودی
  db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
    .forEach(oi => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(oi.quantity, oi.product_id));
  res.json({ ok: true, message: 'سفارش لغو شد.' });
});

module.exports = router;
