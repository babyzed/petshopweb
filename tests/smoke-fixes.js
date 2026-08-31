// tests/smoke-fixes.js — تست دود سریع بعد از فیکس‌ها (سرور باید روی :3001 باشد)
const BASE = process.env.BASE || 'http://localhost:3001';

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

(async () => {
  let ok = 0, fail = 0;
  const check = (name, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✅ ${name} ${extra}`); }
    else { fail++; console.log(`  ❌ ${name} ${extra}`); }
  };

  // 1) محصول نمونه
  const list = await req('GET', '/api/products?per_page=1');
  const p = list.data.products[0];
  console.log(`محصول نمونه: id=${p.id} stock=${p.stock}`);

  // 2) ثبت سفارش COD مهمان — مسیر userId اصلاح‌شده
  const order = await req('POST', '/api/orders', {
    customer: { full_name: 'تست دود', phone: '09120000000' },
    items: [{ product_id: p.id, quantity: 1 }],
    payment_method: 'cod',
  });
  check('ثبت سفارش COD', order.status === 200 && order.data.ok, `code=${order.data.order?.code}`);
  const orderCode = order.data.order?.code;

  // 3) موجودی باید ۱ کم شده باشد
  const after = await req('GET', `/api/products/${p.slug}`);
  check('کسر موجودی', after.data.product.stock === p.stock - 1, `stock: ${p.stock} → ${after.data.product.stock}`);

  // 4) ورود ادمین و لغو سفارش (برگشت موجودی)
  const login = await req('POST', '/api/auth/login', { email: 'admin@petshop.ir', password: 'admin1234' });
  check('ورود ادمین (admin1234)', login.status === 200 && !!login.data.token);
  const token = login.data.token;

  const orders = await req('GET', '/api/admin/orders?per_page=100', null, token);
  const target = orders.data.orders.find(o => o.code === orderCode);
  check('سفارش در پنل ادمین', !!target);

  if (target) {
    const cancel = await req('PUT', `/api/admin/orders/${target.id}/status`, { status: 'cancelled' }, token);
    check('لغو سفارش توسط ادمین', cancel.status === 200);
    const restored = await req('GET', `/api/products/${p.slug}`);
    check('برگشت موجودی پس از لغو', restored.data.product.stock === p.stock, `stock: ${restored.data.product.stock}`);
  }

  // 5) شمارش سفارش‌های موجود (برای تصمیم cleanup)
  const total = orders.data.total;
  console.log(`مجموع سفارش‌های دیتابیس: ${total}`);

  console.log(`\nنتیجه: ${ok} موفق، ${fail} ناموفق`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('خطا:', e.message); process.exit(1); });
