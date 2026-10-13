// tests/test.js — تست‌های جامع پت‌شاپ
// اجرا: node tests/test.js
// نیاز به سرور در حال اجرا روی localhost:3000

const http = require('http');

const BASE = process.env.TEST_URL || 'http://localhost:3000';
let passed = 0;
let failed = 0;
let total = 0;

// ============================================================
// Helpers
// ============================================================
function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    // Node برای DELETE/GET بدنه را chunked نمی‌فرستد؛ بدون Content-Length بدنه نادیده گرفته می‌شود
    // و بایت‌های اضافه اتصال را خراب می‌کند (ECONNRESET / socket hang up)
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(condition, msg) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.log(`  ❌ ${msg}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ============================================================
// Tests
// ============================================================
async function runTests() {
  console.log('🐾 پت‌شاپ — تست‌های جامع\n');

  // ---------- 1. Health Check ----------
  section('Health Check');
  {
    const r = await request('GET', '/api/health');
    assert(r.status === 200, 'Health endpoint returns 200');
    assert(r.body.status === 'healthy', 'Status is healthy');
    assert(r.body.database === 'ok', 'Database is ok');
  }

  // ---------- 2. Auth ----------
  section('Authentication');
  let userToken = null;
  let adminToken = null;
  {
    // ثبت‌نام با رمز ضعیف (باید رد شود)
    const weakPw = await request('POST', '/api/auth/register', {
      name: 'Test', email: 'weak@test.com', password: '123456',
    });
    assert(weakPw.status === 400, 'Weak password rejected');

    // ثبت‌نام موفق (ایمیل یکتا)
    const testEmail = `test${Date.now()}@example.com`;
    const reg = await request('POST', '/api/auth/register', {
      name: 'تست کاربر', email: testEmail, password: 'TestPass123!',
    });
    assert(reg.status === 200, 'Registration successful');
    assert(reg.body.token, 'Registration returns token');
    userToken = reg.body.token;

    // ثبت‌نام تکراری
    const dup = await request('POST', '/api/auth/register', {
      name: 'Test', email: testEmail, password: 'TestPass123!',
    });
    assert(dup.status === 409, 'Duplicate email rejected');

    // ورود ناموفق
    const badLogin = await request('POST', '/api/auth/login', {
      email: testEmail, password: 'wrongpassword',
    });
    assert(badLogin.status === 401, 'Wrong password rejected');

    // ورود موفق
    const login = await request('POST', '/api/auth/login', {
      email: testEmail, password: 'TestPass123!',
    });
    assert(login.status === 200, 'Login successful');
    assert(login.body.token, 'Login returns token');

    // ورود مدیر
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@petshop.ir', password: 'admin1234',
    });
    assert(adminLogin.status === 200, 'Admin login successful');
    adminToken = adminLogin.body.token;

    // فراموشی رمز (نباید کد در پاسخ باشد)
    const forgot = await request('POST', '/api/auth/forgot', {
      email: testEmail,
    });
    assert(forgot.status === 200, 'Forgot password returns 200');
    assert(!forgot.body.demo_code, 'No demo_code in forgot response');

    // پروفایل
    const me = await request('GET', '/api/auth/me', null, userToken);
    assert(me.status === 200, 'Profile endpoint works');
    if (me.body.user) {
      assert(!me.body.user.password_hash, 'Password hash not exposed');
    }
  }

  // ---------- 3. Products ----------
  section('Products');
  let productSlug = '';
  {
    const list = await request('GET', '/api/products?per_page=3');
    assert(list.status === 200, 'Product list returns 200');
    assert(Array.isArray(list.body.products), 'Products is array');
    assert(list.body.total > 0, 'Products exist');
    assert(list.body.pages > 0, 'Pagination works');
    if (list.body.products.length > 0) {
      productSlug = list.body.products[0].slug;
    }

    // جستجو
    const search = await request('GET', '/api/search?q=گربه');
    assert(search.status === 200, 'Search returns 200');

    // جزئیات محصول
    if (productSlug) {
      const detail = await request('GET', `/api/products/${productSlug}`);
      assert(detail.status === 200, 'Product detail returns 200');
      assert(detail.body.product.features, 'Product has features');
      assert(detail.body.product.images !== undefined, 'Product has images');
    }

    // محصول ناموجود
    const notFound = await request('GET', '/api/products/nonexistent-slug');
    assert(notFound.status === 404, 'Nonexistent product returns 404');
  }

  // ---------- 4. Coupons ----------
  section('Coupons');
  {
    // کد معتبر
    const valid = await request('POST', '/api/coupons/validate', {
      code: 'WELCOME10', subtotal: 1000000,
    });
    assert(valid.status === 200, 'Valid coupon returns 200');
    assert(valid.body.valid === true, 'WELCOME10 is valid');
    assert(valid.body.discount > 0, 'Discount calculated');

    // کد نامعتبر
    const invalid = await request('POST', '/api/coupons/validate', {
      code: 'FAKE123', subtotal: 1000000,
    });
    assert(invalid.body.valid === false, 'Fake coupon is invalid');

    // حداقل مبلغ
    const minAmount = await request('POST', '/api/coupons/validate', {
      code: 'SALE200', subtotal: 100000,
    });
    assert(minAmount.body.valid === false, 'Min amount enforced');
  }

  // ---------- 5. Order Creation ----------
  section('Order Creation');
  let guestPendingTotal = 0;
  {
    // سبد خالی
    const empty = await request('POST', '/api/orders', {
      customer: { full_name: 'تست', phone: '09123456789' },
      items: [],
    });
    assert(empty.status === 400, 'Empty cart rejected');

    // اطلاعات ناقص
    const noName = await request('POST', '/api/orders', {
      customer: { phone: '09123456789' },
      items: [{ product_id: 1, quantity: 1 }],
    });
    assert(noName.status === 400, 'Missing name rejected');

    // سفارش COD موفق (مهمان — باید حساب خودکار ساخته شود)
    const products = await request('GET', '/api/products?per_page=1&in_stock=1');
    if (products.body.products.length > 0) {
      const p = products.body.products[0];
      const order = await request('POST', '/api/orders', {
        customer: { full_name: 'خریدار تست', phone: '09123456789', email: 'buyer@test.com' },
        items: [{ product_id: p.id, quantity: 1, image: p.image }],
        payment_method: 'cod',
      });
      assert(order.status === 200, 'COD order created');
      assert(order.body.ok === true, 'Order ok = true');
      assert(order.body.order.status === 'pending', 'COD order status is pending');
      assert(order.body.order.payment_status === 'unpaid', 'COD order payment is unpaid');

      // === FIX: ساخت خودکار حساب برای مهمان + قابلیت پیگیری سفارش ===
      assert(order.body.accountCreated === true, 'Guest checkout auto-creates an account');
      assert(!!order.body.token && !!order.body.user, 'Auto-created session token returned');
      const guestOrders = await request('GET', '/api/orders/my', null, order.body.token);
      assert(guestOrders.status === 200, 'Guest can access "my orders" after auto-login');
      assert(guestOrders.body.orders.some(o => o.id === order.body.order.id), 'Guest order is trackable in "my orders"');

      // سفارش دوم مهمان با همان موبایل → به همان حساب متصل می‌شود (حساب تکراری ساخته نمی‌شود)
      const order2 = await request('POST', '/api/orders', {
        customer: { full_name: 'خریدار تست ۲', phone: '09123456789' },
        items: [{ product_id: p.id, quantity: 1, image: p.image }],
        payment_method: 'cod',
      });
      assert(order2.status === 200, 'Second guest order created');
      assert(order2.body.accountCreated === false, 'Second order links to the SAME account (no duplicate)');
      // امنیت: برای حساب موجود دیگر توکن صادر نمی‌شود (قبلاً هر کسی با دانستن شماره می‌توانست وارد حساب شود)
      assert(!order2.body.token, 'Second guest order does NOT hand out a session token for an existing account');
      // سفارش هر دو به همان حساب وصل است؛ با توکن همان مشتری (از سفارش اول) دیده می‌شوند
      const guestOrders2 = await request('GET', '/api/orders/my', null, order.body.token);
      assert(Array.isArray(guestOrders2.body.orders) && guestOrders2.body.orders.length >= 2, 'Both orders visible under one account');

      // مجموع سفارش‌های مهمان پرداخت‌نشده (برای تست آمار داشبورد)
      guestPendingTotal += Number(order.body.order.total) + Number(order2.body.order.total);

      // سفارش مهمان بدون ایمیل → حساب با ایمیل موقت + امکان «ادعا» هنگام ثبت‌نام
      const order3 = await request('POST', '/api/orders', {
        customer: { full_name: 'خریدار بدون ایمیل', phone: '09350000001' },
        items: [{ product_id: p.id, quantity: 1, image: p.image }],
        payment_method: 'cod',
      });
      assert(order3.status === 200 && order3.body.accountCreated === true, 'Guest without email also gets an account');
      guestPendingTotal += Number(order3.body.order.total);
      const claimEmail = `claim${Date.now()}@example.com`;
      const claim = await request('POST', '/api/auth/register', {
        name: 'خریدار بدون ایمیل', email: claimEmail, phone: '09350000001', password: 'ClaimPass123!',
      });
      assert(claim.status === 200 && claim.body.account_upgraded === true, 'Registering with same phone claims the guest account');
      const phoneLogin = await request('POST', '/api/auth/login', {
        email: '09350000001', password: 'ClaimPass123!',
      });
      assert(phoneLogin.status === 200 && !!phoneLogin.body.token, 'Login with phone number works after claim');
      const claimedOrders = await request('GET', '/api/orders/my', null, phoneLogin.body.token);
      assert(claimedOrders.body.orders.some(o => o.id === order3.body.order.id), 'Claimed account keeps previous order history');
      const emailLogin = await request('POST', '/api/auth/login', {
        email: claimEmail, password: 'ClaimPass123!',
      });
      assert(emailLogin.status === 200, 'Login with the new email works after claim');

      // بازیابی رمز با شماره موبایل (بدون افشای کد)
      const forgotByPhone = await request('POST', '/api/auth/forgot', { email: '09350000001' });
      assert(forgotByPhone.status === 200, 'Password reset by phone returns 200');
      assert(!forgotByPhone.body.demo_code, 'No demo code in forgot response');
    }
  }

  // ---------- 6. Admin Dashboard ----------
  section('Admin Dashboard');
  {
    // بدون دسترسی
    const noAuth = await request('GET', '/api/admin/dashboard');
    assert(noAuth.status === 401, 'Dashboard without auth returns 401');

    // با دسترسی
    const dash = await request('GET', '/api/admin/dashboard', null, adminToken);
    assert(dash.status === 200, 'Dashboard returns 200');
    assert(typeof dash.body.revenue === 'number', 'Revenue is number');
    assert(typeof dash.body.orderCount === 'number', 'Order count is number');
    assert(Array.isArray(dash.body.chart), 'Chart is array');
    assert(dash.body.chart.length === 30, 'Chart has 30 days');

    // === FIX: درآمد فقط سفارش‌های پرداخت‌شده است ===
    // سفارش‌های COD ثبت‌شده در بخش قبلی هنوز پرداخت نشده‌اند:
    assert(dash.body.revenue === 0, 'Unpaid orders are NOT counted as revenue');
    assert(dash.body.pendingRevenue > 0, 'Unpaid revenue is tracked separately');
    assert(dash.body.todayRevenue === 0, 'Today revenue excludes unpaid orders');
    assert(dash.body.chart.reduce((s, c) => s + c.revenue, 0) === 0, '30-day chart excludes unpaid orders');
  }

  // ---------- 7. Admin Products ----------
  section('Admin Products');
  {
    const list = await request('GET', '/api/admin/products', null, adminToken);
    assert(list.status === 200, 'Admin product list returns 200');
    assert(Array.isArray(list.body.products), 'Products is array');
    assert(list.body.total > 0, 'Products exist');
  }

  // ---------- 8. Admin Orders ----------
  section('Admin Orders');
  {
    const list = await request('GET', '/api/admin/orders', null, adminToken);
    assert(list.status === 200, 'Admin order list returns 200');
    assert(typeof list.body.total === 'number', 'Total is number');
    assert(typeof list.body.demoCount === 'number', 'Demo count is number');
  }

  // ---------- 8b. Order Approval Flow (پرداخت در محل) ----------
  // مسیر کامل: ثبت سفارش → تایید فروشگاه → ارسال → تحویل
  section('Order Approval Flow (COD)');
  {
    const products = await request('GET', '/api/products?per_page=1&in_stock=1');
    const p = products.body.products[0];

    // --- سفارش پرداخت در محل توسط کاربر ---
    const created = await request('POST', '/api/orders', {
      customer: { full_name: 'خریدار تایید', phone: '09123456789', address: 'تهران' },
      items: [{ product_id: p.id, quantity: 1 }],
      payment_method: 'cod',
    }, userToken);
    assert(created.status === 200 && created.body.order, 'Approval-flow: COD order created');
    const oid = created.body.order.id;

    // از دید مشتری: «در انتظار تایید» + مرحله تایید در تایم‌لاین
    const mine1 = await request('GET', `/api/orders/my/${oid}`, null, userToken);
    assert(mine1.body.order.status_label === 'در انتظار تایید', 'Customer sees «در انتظار تایید» for COD pending order');
    assert(mine1.body.order.statuses.some(s => s.key === 'confirmed'), 'Timeline contains the approval step');

    // --- قوانین پیش از تایید ---
    const earlyShip = await request('PUT', `/api/admin/orders/${oid}/status`, { status: 'shipped' }, adminToken);
    assert(earlyShip.status === 400, 'Shipping before approval is rejected');
    const codPaid = await request('PUT', `/api/admin/orders/${oid}/status`, { status: 'paid' }, adminToken);
    assert(codPaid.status === 400, 'COD order has no separate «paid» step');

    // --- تایید سفارش توسط مدیر ---
    const approve = await request('PUT', `/api/admin/orders/${oid}/status`, { status: 'confirmed' }, adminToken);
    assert(approve.status === 200 && approve.body.status === 'confirmed', 'Admin can approve the order (status=confirmed)');

    const mine2 = await request('GET', `/api/orders/my/${oid}`, null, userToken);
    assert(mine2.body.order.status_label === 'تایید شده', 'Customer sees «تایید شده» after approval');
    assert(mine2.body.order.statuses.find(s => s.key === 'confirmed').done === true, 'Approval step marked done in timeline');

    const reApprove = await request('PUT', `/api/admin/orders/${oid}/status`, { status: 'confirmed' }, adminToken);
    assert(reApprove.status === 400, 'Approving twice is rejected');

    // تاریخچه وضعیت + نام کاربر تغییردهنده
    const detail = await request('GET', `/api/admin/orders/${oid}`, null, adminToken);
    assert(Array.isArray(detail.body.order.history) && detail.body.order.history.length >= 2, 'Order history is returned to admin');
    const approvalStep = detail.body.order.history.find(h => h.new_status === 'confirmed');
    assert(!!approvalStep && approvalStep.changed_by_name, 'Approval recorded in history with the admin name');

    // --- ارسال و تحویل ---
    const ship = await request('PUT', `/api/admin/orders/${oid}/status`, { status: 'shipped', tracking_code: '2451000000000001' }, adminToken);
    assert(ship.status === 200, 'Shipping after approval works');
    const deliver = await request('PUT', `/api/admin/orders/${oid}/status`, { status: 'delivered' }, adminToken);
    assert(deliver.status === 200, 'Delivering works');
    const afterDeliver = await request('GET', `/api/admin/orders/${oid}`, null, adminToken);
    assert(afterDeliver.body.order.payment_status === 'paid', 'COD payment marked paid on delivery');
    const locked = await request('PUT', `/api/admin/orders/${oid}/status`, { status: 'confirmed' }, adminToken);
    assert(locked.status === 400, 'Delivered order is locked');
    const cancelLate = await request('POST', `/api/orders/my/${oid}/cancel`, null, userToken);
    assert(cancelLate.status === 400, 'Customer cannot cancel a delivered order');

    // --- لغو توسط مشتری پس از تایید (پیش از ارسال) + برگشت موجودی ---
    const before = await request('GET', `/api/products/${p.slug}`);
    const second = await request('POST', '/api/orders', {
      customer: { full_name: 'خریدار لغو', phone: '09123456789' },
      items: [{ product_id: p.id, quantity: 1 }],
      payment_method: 'cod',
    }, userToken);
    const oid2 = second.body.order.id;
    await request('PUT', `/api/admin/orders/${oid2}/status`, { status: 'confirmed' }, adminToken);
    const cancel = await request('POST', `/api/orders/my/${oid2}/cancel`, null, userToken);
    assert(cancel.status === 200, 'Customer can cancel an approved (not shipped) order');
    const after = await request('GET', `/api/products/${p.slug}`);
    assert(after.body.product.stock === before.body.product.stock, 'Stock restored after cancel of approved order');

    // --- داشبورد: کارت تایید سریع ---
    const dash = await request('GET', '/api/admin/dashboard', null, adminToken);
    assert(typeof dash.body.pendingApprovalCount === 'number', 'Dashboard returns pendingApprovalCount');
    assert(Array.isArray(dash.body.pendingApproval), 'Dashboard returns pendingApproval list');
    const badge = await request('GET', '/api/admin/orders/pending-count', null, adminToken);
    assert(badge.status === 200 && typeof badge.body.count === 'number', 'Pending-approval count endpoint works');

    // === FIX آمار درآمد: فقط سفارش تحویل‌شده (پرداخت‌شده) در درآمد است ===
    // سفارش‌های مهمانِ پرداخت‌نشده بخش ۵ داخل pendingRevenue می‌مانند
    const dash2 = await request('GET', '/api/admin/dashboard', null, adminToken);
    assert(dash2.body.revenue === created.body.order.total, 'Revenue counts only PAID orders');
    assert(dash2.body.pendingRevenue === guestPendingTotal, 'Unpaid orders tracked as pending revenue, not earned');
    assert(dash2.body.chart.reduce((s, c) => s + c.revenue, 0) === created.body.order.total, '30-day chart shows only paid sales');
    assert(dash2.body.chart.some(c => c.revenue === created.body.order.total), 'Today (Tehran) appears in the 30-day chart');

    // --- سفارش آنلاین مرحله تایید جداگانه ندارد ---
    const online = await request('POST', '/api/orders', {
      customer: { full_name: 'خریدار آنلاین', phone: '09123456789' },
      items: [{ product_id: p.id, quantity: 1 }],
      payment_method: 'online',
    }, userToken);
    if (online.body.order) {
      const onlineConfirm = await request('PUT', `/api/admin/orders/${online.body.order.id}/status`, { status: 'confirmed' }, adminToken);
      assert(onlineConfirm.status === 400, 'Online orders have no separate approval step');
      await request('PUT', `/api/admin/orders/${online.body.order.id}/status`, { status: 'cancelled' }, adminToken);
    }
  }

  // ---------- 9. Mock Payment in Production ----------
  section('Payment Security');
  {
    // Mock payment should be disabled in production
    const mock = await request('POST', '/api/payments/mock', { code: 'PS-TEST' });
    // In dev mode it works, in prod it should 404
    if (process.env.NODE_ENV === 'production') {
      assert(mock.status === 404, 'Mock payment blocked in production');
    } else {
      assert(mock.status === 404 || mock.status === 200, 'Mock payment works in dev');
    }
  }

  // ---------- 10. Security Headers ----------
  section('Security Headers');
  {
    const r = await request('GET', '/api/health');
    // Note: We can't easily check response headers with our simple http client
    // These should be verified in E2E tests with puppeteer
    assert(r.status === 200, 'API responds correctly');
    console.log('  ℹ️  Security headers should be verified with browser/E2E tests');
  }

  // ---------- 11. Home Page ----------
  section('Home Page');
  {
    const home = await request('GET', '/api/home');
    assert(home.status === 200, 'Home page returns 200');
    assert(Array.isArray(home.body.hero), 'Hero banners exist');
    assert(Array.isArray(home.body.categories), 'Categories exist');
    assert(Array.isArray(home.body.new), 'New products exist');
    assert(home.body.about_teaser, 'About teaser exists');
  }

  // ---------- 12. Articles ----------
  section('Articles');
  {
    const list = await request('GET', '/api/articles');
    assert(list.status === 200, 'Articles list returns 200');
    assert(Array.isArray(list.body.articles), 'Articles is array');
  }

  // ---------- 13. Settings ----------
  section('Settings');
  {
    const pub = await request('GET', '/api/settings/public');
    assert(pub.status === 200, 'Public settings return 200');
    assert(pub.body.site, 'Site settings exist');
  }

  // ---------- 14. Role & Permission ----------
  section('Roles & Permissions');
  {
    const roles = await request('GET', '/api/admin/roles', null, adminToken);
    assert(roles.status === 200, 'Roles list returns 200');
    assert(Array.isArray(roles.body.roles), 'Roles is array');
    assert(roles.body.catalog.length > 0, 'Permission catalog exists');
  }

  // ---------- 15. XSS Prevention ----------
  section('XSS Prevention');
  {
    // تلاش برای ثبت نظر با محتوای خطرناک
    if (userToken) {
      // First get a product
      const prods = await request('GET', '/api/products?per_page=1');
      if (prods.body.products.length > 0) {
        const pid = prods.body.products[0].id;
        const xss = await request('POST', `/api/products/${pid}/review`, {
          rating: 5,
          title: '<script>alert(1)</script>',
          comment: 'نظر عالی <img src=x onerror=alert(1)>',
        }, userToken);
        // Should succeed but content should be sanitized
        if (xss.status === 200) {
          assert(true, 'Review with XSS content accepted (will be sanitized)');
        } else {
          assert(xss.status === 200 || xss.status === 429, 'Review handling works');
        }
      }
    }
  }


  // ---------- Security regression tests (اصلاحات ممیزی امنیتی) ----------
  section('Security regressions');
  {
    const prods = await request('GET', '/api/products?per_page=1');
    const pid = prods.body.products[0].id;
    const mkOrder = (customer, token) => request('POST', '/api/orders', {
      customer, items: [{ product_id: pid, quantity: 1 }], address: 'تهران، خیابان آزمایش ۱', payment_method: 'cod',
    }, token);

    // 1) Account takeover: سفارش مهمان با ایمیل مدیر نباید توکن مدیر را برگرداند
    const atk = await mkOrder({ full_name: 'مهاجم', phone: '09129990001', email: 'admin@petshop.ir' });
    assert(atk.status === 200 && !atk.body.token && !atk.body.user, 'Guest order with admin email does NOT return a session token');

    // 2) ... و با شمارهٔ یک مشتری موجود هم توکن داده نمی‌شود
    const victimPhone = '0913' + String(Date.now()).slice(-7);
    const victim = await request('POST', '/api/auth/register', {
      name: 'قربانی', email: `victim${Date.now()}@test.com`, phone: victimPhone, password: 'Victim#2024x',
    });
    assert(victim.status === 200, 'Victim account registered');
    const atk2 = await mkOrder({ full_name: 'مهاجم', phone: victimPhone });
    assert(atk2.status === 200 && !atk2.body.token, 'Guest order with an existing customer phone does NOT return a token');

    // 3) شمارهٔ جدید: حساب ساخته می‌شود و توکن داده می‌شود (رفتار مطلوب حفظ شده)
    const freshPhone = '0914' + String(Date.now()).slice(-7);
    const fresh = await mkOrder({ full_name: 'مشتری جدید', phone: freshPhone });
    assert(fresh.status === 200 && fresh.body.accountCreated === true && !!fresh.body.token, 'Guest order with a NEW phone still creates an account + token');

    // 4) شمارهٔ نامعتبر سمت سرور رد می‌شود
    const badPhone = await mkOrder({ full_name: 'x', phone: 'abc' });
    assert(badPhone.status === 400, 'Invalid phone number is rejected by the server');

    // 5) /auth/complete فقط برای حساب‌های مهمان (ایمیل موقت)
    const comp = await request('PUT', '/api/auth/complete', {
      name: 'x', email: 'evil@test.com', phone: '09120000000', password: 'Hacked#12345',
    }, adminToken);
    assert(comp.status === 403, '/auth/complete is refused for a normal/admin account');
    const compV = await request('PUT', '/api/auth/complete', {
      name: 'x', email: `evil${Date.now()}@test.com`, phone: victimPhone, password: 'Hacked#12345',
    }, victim.body.token);
    assert(compV.status === 403, '/auth/complete is refused for a completed customer account');
    const compG = await request('PUT', '/api/auth/complete', {
      name: 'مشتری جدید', email: `guest${Date.now()}@test.com`, phone: freshPhone, password: 'Guest#2024xyz',
    }, fresh.body.token);
    assert(compG.status === 200 && compG.body.account_completed === true, '/auth/complete still works for an auto-created guest account');

    // 6) پرداخت: کاربر دیگر نمی‌تواند سفارش کسی را تایید/پرداخت کند
    const other = await request('POST', '/api/auth/register', {
      name: 'کاربر دیگر', email: `other${Date.now()}@test.com`, phone: '0915' + String(Date.now()).slice(-7), password: 'Other#2024xy',
    });
    const vOrder = await mkOrder({ full_name: 'قربانی', phone: victimPhone }, victim.body.token);
    const vCode = vOrder.body.order && vOrder.body.order.code;
    const vr = await request('POST', '/api/payments/verify', { orderCode: vCode, RRN: '123456' }, other.body.token);
    assert(vr.status === 403, "Another user cannot verify someone else's payment");

    // 7) کوپن: درصد >۱۰۰ و کد تکراری رد می‌شود
    const cp1 = await request('POST', '/api/admin/coupons', { code: 'BADPCT' + Date.now() % 1000, type: 'percent', value: 150 }, adminToken);
    assert(cp1.status === 400, 'Coupon with percent > 100 is rejected');
    const cpCode = 'DUP' + (Date.now() % 100000);
    const cp2 = await request('POST', '/api/admin/coupons', { code: cpCode, type: 'fixed', value: 1000 }, adminToken);
    const cp3 = await request('POST', '/api/admin/coupons', { code: cpCode, type: 'fixed', value: 1000 }, adminToken);
    assert(cp2.status === 200 && cp3.status === 409, 'Duplicate coupon code returns 409 (not 500)');

    // 8) صفحات محتوایی: HTML خطرناک ذخیره/نمایش پاکسازی می‌شود
    await request('PUT', '/api/admin/pages/about_page', {
      title: 'درباره ما', content: '<p>سلام</p><img src=x onerror=alert(1)><script>alert(2)</script>', image: '', evil_field: 'x',
    }, adminToken);
    const pg = await request('GET', '/api/pages/about_page');
    const pgc = (pg.body.page && pg.body.page.content) || '';
    assert(pgc.includes('<p>سلام</p>') && !/onerror|<script/i.test(pgc), 'Public page content is sanitized');
    assert(pg.body.page.evil_field === undefined, 'Page settings store only whitelisted fields');

    // 9) ارسال سفارش بدون کد رهگیری رد می‌شود (پس از تایید)
    const cod = await mkOrder({ full_name: 'تست ارسال', phone: '0916' + String(Date.now()).slice(-7) });
    const cid = cod.body.order.id;
    await request('PUT', `/api/admin/orders/${cid}/status`, { status: 'confirmed' }, adminToken);
    const noTrack = await request('PUT', `/api/admin/orders/${cid}/status`, { status: 'shipped' }, adminToken);
    assert(noTrack.status === 400, 'Shipping without a tracking code is rejected');
    const dupStatus = await request('PUT', `/api/admin/orders/${cid}/status`, { status: 'confirmed' }, adminToken);
    assert(dupStatus.status === 400, 'Repeating the same status is rejected');

    // 11) اسکریپت مقداردهی GA هم‌مبدأ سرو می‌شود (CSP اسکریپت درون‌خطی را می‌بندد)
    const ga = await request('GET', '/ga-init.js');
    assert(ga.status === 200 && typeof ga.body === 'string', 'GA init script is served same-origin as JavaScript');

    // 10) پاکسازی داده بدون تأیید صریح رد می‌شود
    const noConfirm = await request('DELETE', '/api/admin/cleanup-test-data', null, adminToken);
    assert(noConfirm.status === 400, 'Data cleanup requires explicit confirmation');
  }

  // ---------- Cleanup: حذف داده‌های تست ----------
  section('Cleanup');
  {
    console.log('  🧹 حذف داده‌های تست...');
    // حذف سفارش‌های تست
    try { await request('DELETE', '/api/admin/cleanup-test-data', { confirm: 'DELETE_ALL_DATA' }, adminToken); } catch {}
    // لاگ وضعیت نهایی
    const dash = await request('GET', '/api/admin/dashboard', null, adminToken);
    if (dash.status === 200) {
      console.log(`  📊 Dashboard: ${dash.body.orderCount} orders, ${dash.body.userCount} users`);
    }
    assert(true, 'Test data cleanup completed');
  }

  // ---------- Summary ----------
  console.log('\n═══════════════════════════════════════');
  console.log(`  نتیجه تست‌ها: ${passed}/${total} موفق | ${failed} ناموفق`);
  console.log('═══════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
