// routes/orders.js — کد تخفیف، ثبت سفارش، سفارش‌های من، پرداخت واقعی
// Production-Ready: Transactional orders, atomic stock, idempotent payments
const express = require('express');
const { db, getSetting } = require('../db');
const { authRequired, requirePerm, optionalAuth, signToken, withRole } = require('../auth');
const { ensureCustomerUser } = require('../customer-account');
const {
  createPayment, verifyPayment, parseCallback, getErrorMessage, testConnection,
  listGateways, activeGatewayKey, isOnlineAvailable, takeFormPost, renderRedirectPage,
} = require('../payment');
const { sendOrderConfirmation, sendOrderShipped } = require('../email');
const { sendOrderSMS } = require('../sms');

const router = express.Router();

const STATUS_LABELS = {
  pending: 'در انتظار پرداخت',
  confirmed: 'تایید شده',
  paid: 'پرداخت شده',
  processing: 'در حال پردازش',
  shipped: 'ارسال شده',
  delivered: 'تحویل شده',
  cancelled: 'لغو شده',
  refunded: 'بازپرداخت شده',
  failed: 'ناموفق',
};

// برچسب وضعیت با در نظر گرفتن روش پرداخت:
// سفارش «پرداخت در محل» در حالت pending یعنی در انتظار تایید/ارسال (نه در انتظار پرداخت)
function statusLabel(order) {
  if (order.status === 'pending') {
    return order.payment_method === 'cod' ? 'در انتظار تایید' : 'در انتظار پرداخت';
  }
  return STATUS_LABELS[order.status] || order.status;
}

// مراحل پیگیری سفارش — بسته به روش پرداخت متفاوت است:
// آنلاین: ثبت سفارش → پرداخت → ارسال → تحویل
// در محل: ثبت سفارش → تایید فروشگاه → ارسال → تحویل → پرداخت در محل (هنگام تحویل)
function buildStatusTimeline(order) {
  if (order.payment_method === 'cod') {
    return [
      { key: 'pending', label: 'ثبت سفارش', done: true },
      { key: 'confirmed', label: 'تایید فروشگاه', done: ['confirmed', 'shipped', 'delivered'].includes(order.status) },
      { key: 'shipped', label: 'ارسال', done: ['shipped', 'delivered'].includes(order.status) },
      { key: 'delivered', label: 'تحویل', done: order.status === 'delivered' },
      { key: 'paid', label: 'پرداخت در محل', done: order.payment_status === 'paid' },
    ];
  }
  return [
    { key: 'pending', label: 'ثبت سفارش', done: true },
    { key: 'paid', label: 'پرداخت', done: ['paid', 'shipped', 'delivered'].includes(order.status) },
    { key: 'shipped', label: 'ارسال', done: ['shipped', 'delivered'].includes(order.status) },
    { key: 'delivered', label: 'تحویل', done: order.status === 'delivered' },
  ];
}

// لغو سفارش + برگرداندن موجودی (برای پرداخت ناموفق)
function cancelOrder(orderId, reason) {
  try {
    db.transaction(() => {
      const cur = db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(orderId);
      if (!cur || cur.status === 'cancelled') return; // قبلاً لغو شده
      db.prepare("UPDATE orders SET status = 'cancelled', payment_status = 'failed', updated_at = datetime('now') WHERE id = ?").run(orderId);
      db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId)
        .forEach(oi => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(oi.quantity, oi.product_id));
      db.prepare('DELETE FROM coupon_usage WHERE order_id = ?').run(orderId);
      addOrderHistory(orderId, cur.status, 'cancelled', null, reason || 'لغو خودکار — پرداخت ناموفق');
    })();
  } catch (err) {
    console.error('[Orders] cancelOrder error:', err.message);
  }
}

// ثبت تاریخچه تغییر وضعیت سفارش
function addOrderHistory(orderId, oldStatus, newStatus, userId, note = '') {
  db.prepare('INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note) VALUES (?,?,?,?,?)')
    .run(orderId, oldStatus || '', newStatus, userId || null, note);
}

// ثبت لاگ امنیتی
function addAuditLog(userId, action, entityType, entityId, metadata, req) {
  const ip = req ? (req.ip || req.connection?.remoteAddress || '') : '';
  const ua = req ? (req.headers['user-agent'] || '') : '';
  db.prepare('INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata, ip, user_agent) VALUES (?,?,?,?,?,?,?)')
    .run(userId, action, entityType, entityId || null, JSON.stringify(metadata || {}), ip, ua);
}

// ---------- اعتبارسنجی کد تخفیف ----------
// هویت کاربر برای محدودیت «هر کاربر یک بار»:
// کاربر لاگین‌شده → user_id | مهمان → شماره موبایل (یا ایمیل) نرمال‌شده
function normalizeGuestKey(phone, email) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits) return 'phone:' + digits;
  const em = String(email || '').trim().toLowerCase();
  if (em) return 'email:' + em;
  return null;
}

function couponUsedBy(couponId, userId, guestKey) {
  if (userId) {
    return !!db.prepare('SELECT id FROM coupon_usage WHERE coupon_id = ? AND user_id = ?').get(couponId, userId);
  }
  if (guestKey) {
    return !!db.prepare('SELECT id FROM coupon_usage WHERE coupon_id = ? AND guest_key = ?').get(couponId, guestKey);
  }
  return false;
}

router.post('/coupons/validate', optionalAuth, (req, res) => {
  const { code, subtotal, phone, email } = req.body || {};
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'کد تخفیف را وارد کنید.' });
  if (!subtotal || isNaN(subtotal) || subtotal < 0) return res.status(400).json({ error: 'مبلغ نامعتبر است.' });

  const row = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(code.trim().toUpperCase());
  if (!row) return res.json({ valid: false, error: 'کد تخفیف معتبر نیست.' });
  if (row.expires_at && new Date(row.expires_at) < new Date()) return res.json({ valid: false, error: 'کد تخفیف منقضی شده است.' });
  if (row.max_usage > 0 && row.used_count >= row.max_usage) return res.json({ valid: false, error: 'ظرفیت استفاده از این کد تمام شده است.' });
  if (row.min_amount > 0 && subtotal < row.min_amount) return res.json({ valid: false, error: `حداقل مبلغ سفارش برای این کد ${row.min_amount.toLocaleString('fa-IR')} تومان است.` });

  // محدودیت هر کاربر: فقط یک بار می‌توان از یک کد استفاده کرد
  const userId = req.user ? req.user.id : null;
  const guestKey = userId ? null : normalizeGuestKey(phone, email);
  if (couponUsedBy(row.id, userId, guestKey)) {
    return res.json({ valid: false, error: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید.' });
  }

  let discount = row.type === 'percent' ? Math.round(subtotal * row.value / 100) : Math.min(row.value, subtotal);
  discount = Math.max(0, Math.min(discount, subtotal));
  res.json({ valid: true, discount, code: row.code, type: row.type, value: row.value });
});

// ---------- محاسبه هزینه ارسال ----------
function calcShipping(subtotal) {
  const shipping = getSetting('shipping', { cost: 75000, free_over: 2000000 });
  const freeOver = Number(shipping.free_over) || 2000000;
  const cost = Number(shipping.cost) || 75000;
  if (subtotal >= freeOver) return { shipping: 0, free_over: freeOver, message: 'ارسال رایگان' };
  return { shipping: cost, free_over: freeOver };
}

// ============================================================
// ثبت سفارش — Atomic Transaction + Server-Side Validation
// ============================================================
router.post('/orders', optionalAuth, (req, res) => {
  try {
    const { customer, items, address, coupon_code, payment_method, note, use_coupon } = req.body || {};

    // --- اعتبارسنجی ورودی ---
    if (!customer || !customer.full_name || !customer.phone) {
      return res.status(400).json({ error: 'اطلاعات گیرنده را کامل وارد کنید.' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'سبد خرید خالی است.' });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: 'حداکثر ۵۰ قلم کالا در هر سفارش.' });
    }
    // محدودیت تعداد هر آیتم
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      if (qty < 1 || qty > 99) {
        return res.status(400).json({ error: 'تعداد هر محصول باید بین ۱ تا ۹۹ باشد.' });
      }
    }

    // بررسی تنظیمات پرداخت
    const paySettings = getSetting('payment', { online_enabled: true, cod_enabled: true });
    let payment = ['online', 'cod'].includes(payment_method) ? payment_method : 'cod';
    if (payment === 'online' && !paySettings.online_enabled) {
      return res.status(400).json({ error: 'پرداخت آنلاین در حال حاضر غیرفعال است.' });
    }
    if (payment === 'cod' && !paySettings.cod_enabled) {
      return res.status(400).json({ error: 'پرداخت در محل در حال حاضر غیرفعال است.' });
    }

    // --- محاسبه قیمت‌ها از دیتابیس (Frontend هرگز منبع قیمت نیست) ---
    let subtotal = 0;
    const finalItems = [];
    // در اسکوپ بیرونی تعریف می‌شود تا هم داخل transaction و هم در مسیر پرداخت آنلاین در دسترس باشد
    let userId = req.user ? req.user.id : null;
    let autoAccount = null;
    let customerData = null;

    // استفاده از Transaction برای اطمینان از Atomic بودن
    const createOrder = db.transaction(() => {
      // === FIX: ساخت/اتصال خودکار حساب برای مهمان‌ها ===
      // تا سفارش‌ها همیشه قابل پیگیری در «سفارش‌های من» باشند
      customerData = { ...customer, address: address || '' };
      // حذف فیلدهای حساس از customer_json
      delete customerData.password;
      delete customerData.token;
      if (!userId) {
        autoAccount = ensureCustomerUser(customerData, { createAddress: true });
        userId = autoAccount.user ? autoAccount.user.id : null;
      }

      for (const it of items) {
        const productId = Number(it.product_id);
        if (!productId || productId < 1) {
          throw new Error('شناسه محصول نامعتبر است.');
        }

        // خواندن محصول از دیتابیس با قفل مناسب
        const p = db.prepare("SELECT * FROM products WHERE id = ? AND status = 'active'").get(productId);
        if (!p) {
          throw new Error(`محصول ${productId} موجود نیست.`);
        }

        const qty = Math.max(1, Math.min(99, Number(it.quantity) || 1));

        // === RACE CONDITION FIX: بررسی اتمیک موجودی ===
        const stockResult = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
          .run(qty, productId, qty);
        if (stockResult.changes === 0) {
          throw new Error(`موجودی «${p.name}» کافی نیست.`);
        }

        const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
        const total = price * qty;
        subtotal += total;
        finalItems.push({
          product_id: p.id,
          name: p.name,
          image: (it.image || ''),
          price,
          quantity: qty,
          total,
        });
      }

      // --- اعمال کد تخفیف ---
      let discount = 0;
      let coupon = null;
      const guestKey = userId ? null : normalizeGuestKey(customer?.phone, customer?.email);
      if (use_coupon && coupon_code && typeof coupon_code === 'string') {
        const row = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(coupon_code.trim().toUpperCase());
        if (!row) throw new Error('کد تخفیف معتبر نیست.');
        if (row.expires_at && new Date(row.expires_at) < new Date()) throw new Error('کد تخفیف منقضی شده است.');
        if (row.max_usage > 0 && row.used_count >= row.max_usage) throw new Error('ظرفیت کد تخفیف تمام شده است.');
        if (row.min_amount > 0 && subtotal < row.min_amount) {
          throw new Error(`حداقل مبلغ سفارش برای این کد ${row.min_amount.toLocaleString('fa-IR')} تومان است.`);
        }
        // هر کاربر فقط یک بار می‌تواند از این کد استفاده کند
        if (couponUsedBy(row.id, userId, guestKey)) {
          throw new Error('شما قبلاً از این کد تخفیف استفاده کرده‌اید.');
        }
        discount = row.type === 'percent' ? Math.round(subtotal * row.value / 100) : Math.min(row.value, subtotal);
        discount = Math.max(0, Math.min(discount, subtotal));
        coupon = row;
      }

      const { shipping } = calcShipping(subtotal - discount);
      const total = subtotal - discount + shipping;

      const code = 'PS-' + Date.now().toString(36).toUpperCase() + '-' + String(Math.floor(1000 + Math.random() * 9000));

      // === FIX: پرداخت آنلاین = pending + unpaid (نه paid!) ===
      // فقط پرداخت COD بعد از تحویل وضعیت تغییر می‌کند
      const orderStatus = 'pending';
      const paymentStatus = 'unpaid';

      const info = db.prepare(`
        INSERT INTO orders (code, user_id, customer_json, status, subtotal, discount, shipping, total, coupon_code, payment_method, payment_status, note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(code, userId, JSON.stringify(customerData), orderStatus,
        subtotal, discount, shipping, total, coupon ? coupon.code : '', payment, paymentStatus, (note || '').substring(0, 500));

      const orderId = info.lastInsertRowid;

      // ثبت اقلام سفارش
      for (const fi of finalItems) {
        db.prepare('INSERT INTO order_items (order_id, product_id, name, image, price, quantity, total) VALUES (?,?,?,?,?,?,?)')
          .run(orderId, fi.product_id, fi.name, fi.image, fi.price, fi.quantity, fi.total);
      }

      // ثبت تاریخچه وضعیت
      addOrderHistory(orderId, '', 'pending', userId, 'ثبت سفارش');

      // اعمال کد تخفیف
      if (coupon) {
        db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
        // ثبت استفادهٔ این کاربر از کد (محدودیت هر کاربر = یک بار)
        db.prepare('INSERT INTO coupon_usage (coupon_id, user_id, guest_key, order_id) VALUES (?,?,?,?)')
          .run(coupon.id, userId, guestKey, orderId);
      }

      return orderId;
    });

    const orderId = createOrder();

    // دریافت سفارش کامل
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    order.customer = JSON.parse(order.customer_json || '{}');

    // === برای مهمان‌هایی که حساب برای‌شان ساخته/متصل شد، جلسه (توکن) برمی‌گردانیم
    // تا مشتری بلافاصله بتواند سفارش را در «سفارش‌های من» پیگیری کند
    let sessionUser = null;
    if (autoAccount && autoAccount.user && !req.user) {
      const full = withRole(autoAccount.user);
      delete full.password_hash;
      sessionUser = full;
    }
    const sessionToken = sessionUser ? signToken(withRole(autoAccount.user)) : null;

    // ارسال اطلاع‌رسانی (غیرهمزمان — نباید باعث Rollback شود)
    setImmediate(() => {
      sendOrderConfirmation(order).catch(err => console.error('[Email] Order confirmation error:', err.message));
      sendOrderSMS(order, 'confirm').catch(err => console.error('[SMS] Order confirmation error:', err.message));
    });

    // لاگ امنیتی
    addAuditLog(userId || null, 'order.created', 'order', orderId, { total: order.total, payment, auto_account: !!(autoAccount && autoAccount.created) }, req);

    // === اگر پرداخت آنلاین است، لینک پرداخت بانکی بساز ===
    if (payment === 'online') {
      return createPayment({
        amount: order.total,
        orderId: order.id,
        orderCode: order.code,
        description: `پرداخت سفارش ${order.code}`,
        mobile: customer.phone || '',
        email: customer.email || '',
      }).then(result => {
        if (result.ok) {
          // ذخیره رکورد پرداخت
          db.prepare('INSERT INTO payments (order_id, user_id, amount, gateway, authority, status) VALUES (?,?,?,?,?,?)')
            .run(orderId, userId, order.total, result.gateway || 'unknown', result.token || '', 'pending');
          res.json({ ok: true, order, needsPayment: true, paymentUrl: result.paymentUrl, gateway: result.gateway, gatewayLabel: result.gatewayLabel, message: `سفارش ثبت شد. در حال انتقال به درگاه ${result.gatewayLabel || 'پرداخت'}...`, accountCreated: !!(autoAccount && autoAccount.created), token: sessionToken || undefined, user: sessionUser || undefined });
        } else {
          // درگاه پرداخت تنظیم نشده — سفارش ثبت می‌شود ولی پرداخت pending می‌ماند
          // هیچ پرداخت جعلی ثبت نمی‌شود
          console.log('[Payment] Gateway not available:', result.error || result.errorCode);
          res.json({ ok: true, order, needsPayment: true, paymentUnavailable: true, message: 'سفارش ثبت شد. پرداخت آنلاین در حال حاضر فعال نیست. لطفاً با پشتیبانی تماس بگیرید.', accountCreated: !!(autoAccount && autoAccount.created), token: sessionToken || undefined, user: sessionUser || undefined });
        }
      }).catch(err => {
        console.error('[Payment] Error:', err.message);
        // === خطا در شبکه — سفارش را لغو کن ===
        cancelOrder(orderId, 'خطای شبکه در اتصال به درگاه پرداخت: ' + err.message);
        res.status(500).json({ error: 'خطای داخلی در پرداخت' });
      });
    }

    res.json({
      ok: true,
      order,
      message: 'سفارش شما ثبت شد؛ مبلغ را هنگام تحویل پرداخت می‌کنید.',
      accountCreated: !!(autoAccount && autoAccount.created),
      token: sessionToken || undefined,
      user: sessionUser || undefined,
    });

  } catch (err) {
    // خطا در Transaction → خودکار Rollback
    console.error('[Order] Creation error:', err.message);
    res.status(400).json({ error: err.message || 'خطا در ثبت سفارش.' });
  }
});

// ============================================================
// ایجاد لینک پرداخت — با بررسی وضعیت سفارش
// ============================================================
router.post('/payments/create', (req, res) => {
  const { orderCode } = req.body || {};
  if (!orderCode || typeof orderCode !== 'string') return res.status(400).json({ error: 'کد سفارش الزامی است.' });

  const order = db.prepare("SELECT * FROM orders WHERE code = ? AND payment_method = 'online' AND payment_status = 'unpaid'").get(orderCode.trim());
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد یا قبلاً پرداخت شده است.' });

  // بررسی مالکیت (اگر کاربر لاگین است)
  if (req.user && order.user_id !== req.user.id) {
    return res.status(403).json({ error: 'دسترسی غیرمجاز.' });
  }

  const customer = JSON.parse(order.customer_json || '{}');

  createPayment({
    amount: order.total,
    orderId: order.id,
    orderCode: order.code,
    description: `پرداخت سفارش ${order.code}`,
    mobile: customer.phone || '',
    email: customer.email || '',
  }).then(result => {
    if (result.ok) {
      // به‌روزرسانی یا ایجاد رکورد پرداخت
      const existing = db.prepare("SELECT id FROM payments WHERE order_id = ? AND status = 'pending'").get(order.id);
      if (existing) {
        db.prepare("UPDATE payments SET authority = ?, gateway = ? WHERE id = ?").run(result.token || '', result.gateway || 'unknown', existing.id);
      } else {
        db.prepare('INSERT INTO payments (order_id, user_id, amount, gateway, authority, status) VALUES (?,?,?,?,?,?)')
          .run(order.id, order.user_id, order.total, result.gateway || 'unknown', result.token || '', 'pending');
      }
      res.json({ ok: true, paymentUrl: result.paymentUrl, gateway: result.gateway, gatewayLabel: result.gatewayLabel });
    } else {
      if (result.errorCode === 'NOT_CONFIGURED' && process.env.NODE_ENV !== 'production') {
        res.json({ ok: true, mockPayment: true, message: 'پرداخت نمایشی (فقط توسعه)' });
      } else {
        res.status(502).json({ ok: false, error: result.error || 'خطا در اتصال به درگاه پرداخت' });
      }
    }
  }).catch(err => {
    console.error('[Payment] Error:', err.message);
    res.status(500).json({ error: 'خطای داخلی در پرداخت' });
  });
});

// ============================================================
// مسیر واسط انتقال به درگاه‌هایی که فرم POST می‌خواهند (بانک صادرات/سپهر)
// ============================================================
router.get('/payments/redirect/:id', (req, res) => {
  const formPost = takeFormPost(req.params.id);
  if (!formPost) {
    return res.redirect('/#/payment-result?status=error&message=' + encodeURIComponent('لینک پرداخت منقضی شده است. دوباره تلاش کنید.'));
  }
  res.set('Content-Type', 'text/html; charset=utf-8').send(renderRedirectPage(formPost));
});

// ============================================================
// Callback از بانک — Idempotent و مشترک بین همهٔ درگاه‌ها
// (برخی درگاه‌ها GET و برخی POST برمی‌گردانند)
// ============================================================
function handlePaymentCallback(req, res) {
  const cb = parseCallback(req);

  // یافتن سفارش: ابتدا با کد سفارش، سپس با شناسهٔ عددی سفارش
  let dbOrder = null;
  if (cb.orderCode) dbOrder = db.prepare('SELECT * FROM orders WHERE code = ?').get(String(cb.orderCode).trim());
  if (!dbOrder && cb.orderId) dbOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(cb.orderId);
  if (!dbOrder) {
    return res.redirect('/#/payment-result?status=error&message=' + encodeURIComponent('سفارش یافت نشد'));
  }

  const orderCode = dbOrder.code;

  // === IDEMPOTENCY: اگر قبلاً پرداخت شده، دوباره پردازش نکن ===
  if (dbOrder.payment_status === 'paid') {
    return res.redirect(`/#/payment-result?status=success&order=${orderCode}&RRN=${encodeURIComponent(cb.ref || '')}&message=${encodeURIComponent('پرداخت قبلاً تایید شده')}`);
  }

  // بررسی وضعیت بازگشتی بانک
  if (!cb.ok) {
    const errorMsg = getErrorMessage(cb.statusCode, cb.gateway);
    db.prepare('INSERT INTO payments (order_id, user_id, amount, gateway, authority, status, raw_response) VALUES (?,?,?,?,?,?,?)')
      .run(dbOrder.id, dbOrder.user_id, dbOrder.total, cb.gateway, String(cb.ref || ''), 'failed', JSON.stringify({ status: cb.statusCode, error: errorMsg }));
    return res.redirect(`/#/payment-result?status=failed&message=${encodeURIComponent(errorMsg)}&order=${orderCode}`);
  }

  // تایید پرداخت با بانک
  verifyPayment({ gateway: cb.gateway, params: cb.params, amount: dbOrder.total }).then(result => {
    if (result.ok) {
      const refId = String(result.refId || cb.ref || '');

      // بررسی مبلغ (در صورتی که بانک مبلغ را برگرداند)
      if (result.amountRial && Math.round(dbOrder.total * 10) !== Number(result.amountRial)) {
        console.error(`[Payment Callback] Amount mismatch for ${orderCode}: expected ${dbOrder.total * 10} got ${result.amountRial}`);
        db.prepare('INSERT INTO payments (order_id, user_id, amount, gateway, authority, status, raw_response) VALUES (?,?,?,?,?,?,?)')
          .run(dbOrder.id, dbOrder.user_id, dbOrder.total, cb.gateway, refId, 'failed', JSON.stringify({ error: 'amount_mismatch', raw: result.raw || null }));
        return res.redirect(`/#/payment-result?status=failed&order=${orderCode}&message=${encodeURIComponent('مبلغ پرداخت‌شده با مبلغ سفارش مطابقت ندارد')}`);
      }

      // === TRANSACTION: به‌روزرسانی اتمیک وضعیت ===
      db.transaction(() => {
        // دوباره بررسی idempotency داخل Transaction
        const current = db.prepare('SELECT payment_status FROM orders WHERE id = ?').get(dbOrder.id);
        if (current.payment_status === 'paid') return; // قبلاً پرداخت شده

        db.prepare("UPDATE orders SET payment_status = 'paid', status = 'paid', updated_at = datetime('now') WHERE id = ? AND payment_status = 'unpaid'")
          .run(dbOrder.id);

        const updated = db.prepare("UPDATE payments SET status = 'paid', gateway = ?, transaction_id = ?, raw_response = ?, verified_at = datetime('now') WHERE order_id = ? AND status = 'pending'")
          .run(cb.gateway, refId, JSON.stringify(result.raw || {}), dbOrder.id);
        if (!updated.changes) {
          db.prepare("INSERT INTO payments (order_id, user_id, amount, gateway, authority, transaction_id, status, raw_response, verified_at) VALUES (?,?,?,?,?,?,'paid',?,datetime('now'))")
            .run(dbOrder.id, dbOrder.user_id, dbOrder.total, cb.gateway, String(cb.ref || ''), refId, JSON.stringify(result.raw || {}));
        }

        addOrderHistory(dbOrder.id, dbOrder.status, 'paid', dbOrder.user_id, `پرداخت موفق بانکی (${cb.gatewayLabel})`);
      })();

      // اطلاع‌رسانی (غیرهمزمان)
      setImmediate(() => {
        const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(dbOrder.id);
        sendOrderSMS(updatedOrder, 'paid').catch(() => {});
      });

      res.redirect(`/#/payment-result?status=success&order=${orderCode}&RRN=${encodeURIComponent(refId)}`);
    } else {
      res.redirect(`/#/payment-result?status=failed&message=${encodeURIComponent(result.error || 'تایید پرداخت ناموفق')}&order=${orderCode}`);
    }
  }).catch(err => {
    console.error('[Payment Callback] Verify error:', err.message);
    res.redirect(`/#/payment-result?status=error&message=${encodeURIComponent('خطا در تایید پرداخت')}&order=${orderCode}`);
  });
}

router.get('/payments/callback', handlePaymentCallback);
router.post('/payments/callback', handlePaymentCallback);


// ============================================================
// تایید پرداخت (API) — Idempotent
// ============================================================
router.post('/payments/verify', authRequired, (req, res) => {
  const { orderCode, RRN, gateway, params } = req.body || {};
  if (!orderCode || (!RRN && !params)) return res.status(400).json({ error: 'اطلاعات ناقص است.' });

  const order = db.prepare("SELECT * FROM orders WHERE code = ?").get(orderCode);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });

  // بررسی مالکیت
  if (order.user_id && order.user_id !== req.user.id) {
    return res.status(403).json({ error: 'دسترسی غیرمجاز.' });
  }

  // Idempotency
  if (order.payment_status === 'paid') {
    return res.json({ ok: true, message: 'پرداخت قبلاً تایید شده.' });
  }

  // درگاه: از بدنهٔ درخواست یا از رکورد پرداخت ثبت‌شدهٔ سفارش
  const payRow = db.prepare('SELECT gateway FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id);
  const gw = gateway || payRow?.gateway || undefined;
  const verifyParams = params && typeof params === 'object'
    ? params
    : { RRN, RefNum: RRN, Authority: RRN, token: RRN, digitalreceipt: RRN };

  verifyPayment({ gateway: gw, params: verifyParams, amount: order.total }).then(result => {
    if (result.ok) {
      const refId = String(result.refId || RRN || '');
      db.transaction(() => {
        db.prepare("UPDATE orders SET payment_status = 'paid', status = 'paid', updated_at = datetime('now') WHERE id = ? AND payment_status = 'unpaid'")
          .run(order.id);
        db.prepare("UPDATE payments SET status = 'paid', gateway = ?, transaction_id = ?, verified_at = datetime('now') WHERE order_id = ? AND status = 'pending'")
          .run(result.gateway, refId, order.id);
        addOrderHistory(order.id, order.status, 'paid', req.user.id, 'تایید پرداخت دستی');
      })();
      res.json({ ok: true, message: 'پرداخت با موفقیت تایید شد.', gateway: result.gateway });
    } else {
      res.json({ ok: false, error: result.error || 'تایید پرداخت ناموفق' });
    }
  }).catch(err => {
    console.error('[Payment Verify] Error:', err.message);
    res.status(500).json({ error: 'خطا در تایید پرداخت' });
  });
});

// ============================================================
// پرداخت نمایشی — فقط در حالت Development
// ============================================================
router.post('/payments/mock', (req, res) => {
  // === CRITICAL: غیرفعال در Production ===
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'این مسیر در محیط تولید فعال نیست.' });
  }

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'کد سفارش الزامی است.' });

  const order = db.prepare('SELECT * FROM orders WHERE code = ?').get(String(code).trim());
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  if (order.payment_status === 'paid') return res.json({ ok: true, message: 'پرداخت قبلاً انجام شده.' });

  db.transaction(() => {
    db.prepare("UPDATE orders SET payment_status = 'paid', status = 'paid', updated_at = datetime('now') WHERE id = ? AND payment_status = 'unpaid'")
      .run(order.id);
    db.prepare('INSERT INTO payments (order_id, user_id, amount, gateway, authority, transaction_id, status) VALUES (?,?,?,?,?,?,?)')
      .run(order.id, order.user_id, order.total, 'mock', 'MOCK-' + Date.now(), 'MOCK-' + Date.now(), 'paid');
    addOrderHistory(order.id, order.status, 'paid', null, 'پرداخت نمایشی (توسعه)');
  })();

  console.log(`[MOCK PAYMENT] Order ${code} marked as paid (development only)`);
  res.json({ ok: true, message: 'پرداخت با موفقیت انجام شد (نمایشی — فقط توسعه).' });
});

// ============================================================
// تست اتصال درگاه
// ============================================================
// ============================================================
// تست اتصال درگاه‌ها
// ============================================================
router.get('/payments/gateways', authRequired, requirePerm('orders.manage'), (req, res) => {
  res.json({ gateways: listGateways(), active: activeGatewayKey(), online_available: isOnlineAvailable() });
});

router.get('/payments/test', authRequired, requirePerm('orders.manage'), (req, res) => {
  testConnection(req.query.gateway).then(result => {
    res.json(result);
  }).catch(err => {
    res.json({ ok: false, message: err.message });
  });
});

// ============================================================
// سفارش‌های من — با بررسی مالکیت
// ============================================================
router.get('/orders/my', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*,
      (SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o WHERE o.user_id = ? AND o.is_demo = 0 ORDER BY o.created_at DESC, o.id DESC
  `).all(req.user.id);
  res.json({ orders: rows.map(o => ({ ...o, status_label: statusLabel(o) })) });
});

router.get('/orders/my/:id', authRequired, (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || orderId < 1) return res.status(400).json({ error: 'شناسه سفارش نامعتبر است.' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, req.user.id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  order.customer = JSON.parse(order.customer_json || '{}');
  order.status_label = statusLabel(order);
  order.statuses = buildStatusTimeline(order);
  res.json({ order });
});

// ============================================================
// لغو سفارش — با برگرداندن موجودی + بررسی وضعیت
// ============================================================
router.post('/orders/my/:id/cancel', authRequired, (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId || orderId < 1) return res.status(400).json({ error: 'شناسه سفارش نامعتبر است.' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, req.user.id);
  if (!order) return res.status(404).json({ error: 'سفارش یافت نشد.' });
  // تا پیش از ارسال، مشتری می‌تواند سفارش را لغو کند
  // (pending = در انتظار پرداخت/تایید، confirmed = تایید شده ولی هنوز ارسال نشده)
  if (!['pending', 'confirmed'].includes(order.status)) {
    return res.status(400).json({ error: 'این سفارش ارسال یا نهایی شده و قابل لغو نیست. برای پیگیری با پشتیبانی تماس بگیرید.' });
  }

  db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(order.id);
    // برگرداندن موجودی
    db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id)
      .forEach(oi => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(oi.quantity, oi.product_id));
    // آزاد کردن استفادهٔ کد تخفیف تا کاربر بتواند دوباره استفاده کند
    db.prepare('DELETE FROM coupon_usage WHERE order_id = ?').run(order.id);
    addOrderHistory(order.id, order.status, 'cancelled', req.user.id, 'لغو توسط مشتری');
  })();

  res.json({ ok: true, message: 'سفارش لغو شد.' });
});

// ============================================================
// انقضای خودکار سفارش‌های پرداخت‌نشده — آزادسازی موجودی
// سفارش‌های «آنلاین» که بعد از N ساعت هنوز پرداخت نشده‌اند،
// لغو و موجودی آن‌ها به انبار برمی‌گردد (جلوی قفل شدن انبار توسط
// سفارش‌های رهاشده را می‌گیرد). سفارش‌های COD دست فروشگاه هستند
// و خودکار منقضی نمی‌شوند.
// ============================================================
const ORDER_EXPIRY_HOURS = Math.max(1, Number(process.env.ORDER_EXPIRY_HOURS) || 12);

function expireStaleOrders() {
  try {
    const stale = db.prepare(`
      SELECT id, code FROM orders
      WHERE status = 'pending' AND payment_method = 'online' AND payment_status = 'unpaid'
        AND created_at < datetime('now', ?)
    `).all(`-${ORDER_EXPIRY_HOURS} hours`);

    for (const order of stale) {
      db.transaction(() => {
        // بررسی مجدد داخل transaction (idempotency)
        const cur = db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(order.id);
        if (!cur || cur.status !== 'pending' || cur.payment_status !== 'unpaid') return;

        db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(order.id);
        db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(order.id)
          .forEach(oi => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(oi.quantity, oi.product_id));
        addOrderHistory(order.id, 'pending', 'cancelled', null, 'انقضای خودکار سفارش پرداخت‌نشده');
      })();
    }

    if (stale.length) {
      console.log(`[Orders] ${stale.length} سفارش پرداخت‌نشده پس از ${ORDER_EXPIRY_HOURS} ساعت منقضی و موجودی آزاد شد.`);
    }
  } catch (err) {
    console.error('[Orders] Expiry job error:', err.message);
  }
}

module.exports = router;
module.exports.expireStaleOrders = expireStaleOrders;
