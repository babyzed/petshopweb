// tests/scan-admin-ui.js — اسکن باگ‌های نمایشی پنل مدیریت (موبایل/تبلت/دسکتاپ)
// اجرا: سرور روی :3000 باشد، سپس  node tests/scan-admin-ui.js
// نیاز به Chromium (puppeteer) دارد.
//
// چه چیزی را بررسی می‌کند:
//   ۱) سرریز افقی صفحه (مهم‌ترین باگ موبایل پنل)
//   ۲) بیرون‌زدن بلوک‌ها از عرض viewport
//   ۳) تداخل عمودی کارت‌های داشبورد
//   ۴) متن سرریز در کارت آمار/جدول‌ها
//   ۵) تصویر شکسته و آیکون جایگزین‌شده با نقطه (●)
const puppeteer = require('puppeteer');

const BASE = process.env.TEST_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@petshop.ir';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin1234';

(async () => {
  // ورود مدیر و دریافت توکن (بدون مرورگر)
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  }).then(r => r.json());
  if (!login.token) { console.error('ورود مدیر ناموفق بود — سرور روی ' + BASE + ' در حال اجراست؟'); process.exit(1); }

  // یک سفارش در انتظار تایید برای دیدن کارت/بنر تایید
  const products = await fetch(`${BASE}/api/products?per_page=1&in_stock=1`).then(r => r.json());
  const created = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { full_name: 'اسکن UI', phone: '09120000099' },
      items: [{ product_id: products.products[0].id, quantity: 1 }],
      payment_method: 'cod',
    }),
  }).then(r => r.json());
  const orderId = created.order?.id;

  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  } catch (err) {
    console.error('Chromium در دسترس نیست — ابتدا `npm install` (شامل puppeteer) را اجرا کنید.');
    console.error(err.message);
    process.exit(1);
  }
  let totalIssues = 0;

  const scan = async (w, h, label) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 });
    await page.evaluateOnNewDocument((t, u) => {
      localStorage.setItem('ps_admin_token', t);
      localStorage.setItem('ps_admin_user', u);
    }, login.token, JSON.stringify(login.user));

    const routes = ['/admin/#/dashboard', '/admin/#/orders', orderId ? `/admin/#/orders/${orderId}` : null].filter(Boolean);
    for (const rt of routes) {
      await page.goto(BASE + rt, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 1000));
      const issues = await page.evaluate(() => {
        const out = [];
        const vw = document.documentElement.clientWidth;

        // ۱) سرریز افقی کل صفحه
        if (document.documentElement.scrollWidth > vw + 2) {
          out.push(`OVERFLOW-X صفحه ${document.documentElement.scrollWidth - vw}px عریض‌تر از viewport`);
        }

        // ۲) عنصری که از عرض viewport بیرون زده و داخل کانتینر اسکرول‌شونده نیست
        const inHScroll = (el) => {
          let p = el.parentElement;
          while (p) {
            const cs = getComputedStyle(p);
            if (p.scrollWidth > p.clientWidth + 10 && /auto|scroll/.test(cs.overflowX)) return true;
            p = p.parentElement;
          }
          return false;
        };
        document.querySelectorAll('#admin-view *, #admin-topbar *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && el.offsetParent !== null && !inHScroll(el)) {
            if (r.right > vw + 1) out.push(`OFFSCREEN-R: ${el.tagName}.${String(el.className).slice(0, 26)} right=${Math.round(r.right)} vw=${vw}`);
          }
        });

        // ۳) تداخل عمودی کارت‌های هم‌سطح داشبورد
        const cards = [...document.querySelectorAll('.stat-card, .dash-card, .waiting-card, .approval-banner')];
        for (let i = 0; i < cards.length - 1; i++) {
          const a = cards[i], b = cards[i + 1];
          if (a.parentElement !== b.parentElement || a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          if (ra.bottom > rb.top + 6 && rb.top > ra.top) {
            out.push(`OVERLAP: ${String(a.className).slice(0, 24)} × ${String(b.className).slice(0, 24)} → ${Math.round(ra.bottom - rb.top)}px`);
          }
        }

        // ۴) متن سرریز در کارت آمار، عنوان کارت‌ها و سلول‌های جدول
        document.querySelectorAll('.stat-v, .stat-l, .dash-card h3, .wi-code, .wi-name, .sf-label, .hist-body b').forEach(el => {
          if (el.offsetParent !== null && el.scrollWidth > el.clientWidth + 6) {
            out.push(`TEXT-OVF: ${String(el.className).slice(0, 20)} "${el.textContent.trim().slice(0, 24)}"`);
          }
        });

        // ۵) تصویر شکسته + آیکون تعریف‌نشده (نقطهٔ ●)
        document.querySelectorAll('img').forEach(im => {
          if (im.complete && im.naturalWidth === 0) out.push(`BROKEN-IMG: ${im.src.slice(-60)}`);
        });
        if (document.querySelector('#admin-view').textContent.includes('●')) out.push('MISSING-ICON: آیکون تعریف‌نشده به‌صورت ● رندر شده');

        return out.slice(0, 20);
      });
      if (issues.length) {
        totalIssues += issues.length;
        console.log(`\n[${label} ${w}x${h}] ${rt}`);
        issues.forEach(i => console.log('  ' + i));
      } else {
        console.log(`✅ [${label} ${w}x${h}] ${rt} — بدون باگ نمایشی`);
      }
    }
    await page.close();
  };

  await scan(360, 780, 'موبایل کوچک');
  await scan(390, 844, 'موبایل');
  await scan(768, 1024, 'تبلت');
  await scan(1440, 900, 'دسکتاپ');
  await browser.close();

  console.log(totalIssues ? `\n❌ ${totalIssues} مورد پیدا شد` : '\n✅ پنل مدیریت در همهٔ عرض‌ها تمیز است');
  process.exit(totalIssues ? 1 : 0);
})();
