// /tmp/e2e.js — تست جامع End-to-End با Puppeteer
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
let errors = [];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=fa-IR'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text().slice(0, 300)); });
  page.on('response', (r) => { if (r.status() === 404) errors.push('[404@' + page.url().slice(0, 50) + '] ' + r.url().slice(0, 140)); });
  page.on('pageerror', (err) => errors.push('[pageerror] ' + String(err).slice(0, 300)));
  page.on('requestfailed', (req) => { if (!req.url().includes('fonts')) errors.push('[reqfail] ' + req.url().slice(0, 120)); });

  const log = (name, ok, extra = '') => console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
  const clickEl = async (sel) => {
    await page.$eval(sel, el => el.click());
  };
  const typeEl = async (sel, text) => {
    await page.$eval(sel, (el, t) => {
      el.focus();
      el.value = t;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
  };

  // ---------- صفحه اصلی دسکتاپ ----------
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(500);
  log("صفحه اصلی لود شد", (await page.title()).includes("پت‌شاپ"));
  const heroCount = await page.$$eval('.hero-slide', els => els.length);
  log('اسلایدر Hero', heroCount >= 1, `اسلاید: ${heroCount}`);
  const secCount = await page.$$eval('section[data-sec]', els => els.length);
  log('بخش‌های صفحه اصلی', secCount >= 9, `${secCount} بخش`);
  const prodCards = await page.$$eval('.p-card', els => els.length);
  log('کارت‌های محصول', prodCards >= 10, `${prodCards} کارت`);
  const catCards = await page.$$eval('.cat-card', els => els.length);
  log('دسته‌بندی‌ها', catCards >= 8, `${catCards} دسته`);
  const imgs = await page.$$eval('.p-card img', els => els.map(i => i.src));
  const broken = imgs.filter(s => !s || s.includes('placeholder'));
  log('تصاویر محصولات', imgs.length > 0 && broken.length === 0, `بارگذاری ${imgs.length} تصویر`);

  // ---------- صفحه فروشگاه ----------
  await page.goto(BASE + '/#/shop', { waitUntil: 'networkidle0' });
  await sleep(300);
  const shopCount = await page.$eval('.shop-count b', el => el.textContent);
  log('فروشگاه با فیلتر', shopCount.trim() !== '۰', `تعداد: ${shopCount}`);
  // فیلتر دسته
  await page.click('[data-cat="dog-food"]');
  await sleep(700);
  const filtered = await page.$eval('.shop-count b', el => el.textContent);
  log('فیلتر دسته غذای سگ', filtered.trim() === '۳', `نتایج: ${filtered}`);

  // ---------- صفحه محصول ----------
  await page.goto(BASE + '/#/product/adult-cat-food-chicken', { waitUntil: 'networkidle0' });
  await sleep(300);
  log('صفحه محصول', await page.$('.pd-title') !== null, await page.$eval('.pd-title', el => el.textContent.slice(0, 40)));
  const hasGallery = await page.$$eval('.pd-thumb', els => els.length);
  log('گالری تصاویر', hasGallery >= 2, `${hasGallery} تصویر`);
  const hasReviews = await page.$$eval('.rev-item', els => els.length);
  log('نظرات کاربران', hasReviews >= 1, `${hasReviews} نظر`);
  // افزودن به سبد
  await page.click('[data-add-cart]');
  await sleep(600);
  const cartBadge = await page.$eval('[data-cart-count]', el => el.textContent);
  log('افزودن به سبد', cartBadge.trim() === '۱', `سبد: ${cartBadge}`);
  // باز کردن سبد
  await page.click('[data-open-cart]');
  await sleep(400);
  log('دراپر سبد', await page.$('.cd-panel') !== null && await page.$eval('.cd-panel .cd-item', () => true).catch(() => false));

  // ---------- ورود کاربر ----------
  await page.goto(BASE + '/#/auth', { waitUntil: 'networkidle0' });
  await sleep(300);
  log('صفحه ورود (تخصصی)', await page.$('.auth-card') !== null);
  await page.type('input[name="email"]', 'sara@gmail.com');
  await page.type('input[name="password"]', '123456');
  await page.click('[data-submit]');
  await sleep(2500);
  const loggedIn = await page.url().includes('account');
  log('ورود کاربر', loggedIn, `رفتن به: ${page.url()}`);

  // ---------- صفحه محصول + نظر ----------
  await page.goto(BASE + '/#/product/adult-cat-food-chicken', { waitUntil: 'networkidle0' });
  await sleep(400);
  await typeEl('[data-review-form] input[name="title"]', 'نظر تستی');
  await typeEl('[data-review-form] textarea[name="comment"]', 'این یک نظر تستی از تست خودکار است.');
  await clickEl('[data-review-form] button[type="submit"]');
  await sleep(1600);
  const revMsg = await page.$$eval('#toast-root .toast', els => els.map(e => e.textContent).join(' | ')).catch(() => '');
  log('ثبت نظر', revMsg.includes('ثبت شد'), revMsg.slice(0, 80));

  // ---------- چک‌اوت ----------
  await page.goto(BASE + '/#/checkout', { waitUntil: 'networkidle0' });
  await sleep(300);
  await typeEl('[data-c-phone]', '09121111111');
  await typeEl('[data-a-address]', 'تهران، خیابان تست، پلاک ۱');
  await typeEl('[data-coupon-input]', 'WELCOME10');
  await clickEl('[data-coupon-apply]');
  await sleep(600);
  const disc = await page.$eval('[data-sum-discount]', el => el.textContent);
  const cpToasts = await page.$$eval('#toast-root .toast', els => els.map(e => e.textContent).join(' | ')).catch(() => '');
  log('کد تخفیف اعمال شد', disc.includes('−'), disc + ' | toasts: ' + cpToasts.slice(0, 80));
  const totalBefore = await page.$eval('[data-sum-total]', el => el.textContent);
  await clickEl('[data-submit-order]');
  await sleep(1500);
  const success = await page.$('.success-box') !== null;
  const odToasts = await page.$$eval('#toast-root .toast', els => els.map(e => e.textContent).join(' | ')).catch(() => '');
  log('ثبت سفارش', success, `مبلغ: ${totalBefore} | toasts: ${odToasts.slice(0, 100)}`);
  const orderCode = await page.$eval('.success-code', el => el.textContent).catch(() => '');
  log('کد پیگیری صادر شد', orderCode.includes('PS-'), orderCode);

  // ---------- پنل مدیریت ----------
  const admin = await browser.newPage();
  admin.on('console', (msg) => { if (msg.type() === 'error') errors.push('[admin-console] ' + msg.text().slice(0, 300)); });
  admin.on('pageerror', (err) => errors.push('[admin-pageerror] ' + String(err).slice(0, 300)));
  await admin.setViewport({ width: 1440, height: 900 });
  await admin.goto(BASE + '/admin/', { waitUntil: 'networkidle0' });
  await sleep(300);
  log('پنل → صفحه ورود', await admin.$('[data-login-form]') !== null);
  await admin.type('input[name="email"]', 'admin@petshop.ir');
  await admin.type('input[name="password"]', 'admin123');
  await admin.click('[data-login-form] button[type=submit]');
  await sleep(1500);
  log('ورود به پنل', admin.url().includes('dashboard'), admin.url());
  await sleep(800);
  const statCards = await admin.$$eval('.stat-card', els => els.length);
  log('داشبورد آماری', statCards >= 4, `${statCards} کارت آماری`);
  const chart = await admin.$('.dash-card svg') !== null;
  log('نمودار فروش', chart);

  // محصولات
  await admin.goto(BASE + '/admin/#/products', { waitUntil: 'networkidle0' });
  await sleep(800);
  const prodRows = await admin.$$eval('.data-table tbody tr', els => els.length);
  log('لیست محصولات پنل', prodRows >= 5, `${prodRows} ردیف`);
  await admin.click('a[href="#/products/new"]');
  await sleep(600);
  log('فرم محصول جدید', await admin.$('[data-f-name]') !== null);

  // سفارش‌ها
  await admin.goto(BASE + '/admin/#/orders', { waitUntil: 'networkidle0' });
  await sleep(800);
  const orderRows = await admin.$$eval('.data-table tbody tr', els => els.length);
  log('لیست سفارش‌ها', orderRows >= 3, `${orderRows} سفارش`);
  await admin.click('.data-table tbody tr');
  await sleep(800);
  log('جزئیات سفارش', await admin.$('[data-set-status]') !== null);
  await admin.click('[data-set-status="shipped"]');
  await sleep(700);
  log('تغییر وضعیت سفارش', admin.url().includes('/orders/'));

  // کاربران — ساخت ادمین دلخواه توسط مدیر کل
  await admin.goto(BASE + '/admin/#/users', { waitUntil: 'networkidle0' });
  await sleep(800);
  const hasNewBtn = await admin.$('[data-new-user]') !== null;
  let created = false;
  if (hasNewBtn) {
    const uniqEmail = 'testadmin' + Date.now() + '@gmail.com';
    await admin.$eval('[data-new-user]', el => el.click());
    await sleep(500);
    await admin.$eval('[data-n-name]', (el, t) => { el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, 'ادمین تستی');
    await admin.$eval('[data-n-email]', (el, t) => { el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, uniqEmail);
    await admin.$eval('[data-n-pass]', (el, t) => { el.value = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, 'admin123');
    await admin.$eval('[data-n-role]', el => { el.value = el.options[1].value; });
    await admin.$eval('[data-save]', el => el.click());
    await sleep(1600); // صبر برای ساخت + reload
    created = await admin.evaluate(async (q) => {
      const t = localStorage.getItem('ps_admin_token');
      const r = await fetch('/api/admin/users?q=' + q + '&page=1', { headers: { Authorization: 'Bearer ' + t } });
      const d = await r.json();
      return (d.users || []).some(u => u.email === q && u.name === 'ادمین تستی');
    }, uniqEmail);
  }
  log('ساخت ادمین دلخواه', hasNewBtn && created, created ? 'کاربر ساخته و در لیست است' : 'در لیست نیست');

  // نقش‌ها
  await admin.goto(BASE + '/admin/#/roles', { waitUntil: 'networkidle0' });
  await sleep(800);
  log('مدیریت نقش‌ها', await admin.$('[data-new]') !== null);

  // تنظیمات
  await admin.goto(BASE + '/admin/#/settings', { waitUntil: 'networkidle0' });
  await sleep(600);
  log('تنظیمات', await admin.$('[data-phone]') !== null);

  // ویرایشگر خانه
  await admin.goto(BASE + '/admin/#/home', { waitUntil: 'networkidle0' });
  await sleep(600);
  const secToggles = await admin.$$eval('[data-sec-toggle]', els => els.length);
  log('ویرایشگر صفحه اصلی', secToggles >= 10, `${secToggles} کلید بخش`);

  // ---------- موبایل ----------
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle0' });
  await sleep(600);
  log('موبایل: ناوبری پایین', await page.$('#bottom-nav') !== null);
  const mHero = await page.$('.mobile-hero .mh-slide.active') !== null;
  log('موبایل: هیرو اختصاصی', mHero);
  const hzCards = await page.$$eval('.p-card.hz', els => els.length);
  log('موبایل: کارت‌های افقی', hzCards >= 5, `${hzCards} کارت`);

  // صفحه محصول موبایل: نوار خرید چسبان
  await page.goto(BASE + '/#/product/adult-cat-food-chicken', { waitUntil: 'networkidle0' });
  await sleep(400);
  log('موبایل: نوار خرید چسبان', await page.$('[data-mobile-buybar]') !== null);

  // گزارش
  console.log('\n========== گزارش خطاها ==========');
  if (errors.length === 0) console.log('🎉 هیچ خطایی ثبت نشد!');
  else { console.log(errors.slice(0, 15).join('\n')); console.log(`کل خطاها: ${errors.length}`); }

  // اسکرین‌شات
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle0' });
  await sleep(800);
  await page.screenshot({ path: '/home/user/petshop/docs/screenshot-desktop.png', fullPage: false });
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle0' });
  await sleep(800);
  await page.screenshot({ path: '/home/user/petshop/docs/screenshot-mobile.png', fullPage: false });
  await admin.screenshot({ path: '/home/user/petshop/docs/screenshot-admin.png', fullPage: false });

  await browser.close();
  console.log('\n🏁 تست کامل شد');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
