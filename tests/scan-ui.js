// اسکن کامل باگ‌های نمایشی: تداخل بلوک‌ها، سرریز، متن، عناصر خالی
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  const scan = async (w, h, label) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 });
    const routes = ['/#/', '/#/shop', '/#/product/adult-cat-food-chicken', '/#/checkout', '/#/blog', '/#/page/about', '/#/auth'];
    for (const rt of routes) {
      await page.goto('http://localhost:3000' + rt, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 1100));
      const issues = await page.evaluate(() => {
        const out = [];
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;

        // 1) سرریز افقی صفحه
        if (document.documentElement.scrollWidth > vw + 2) out.push(`OVERFLOW-X ${document.documentElement.scrollWidth - vw}px`);

        // 2) تداخل عمودی بلوک‌های سکشن (sibling ها)
        const blocks = [...document.querySelectorAll('section, .hero-slider, .mobile-hero, .promo-grid, .featured-card, .cat-grid, .p-grid, .about-teaser, .newsletter, .page-hero, .checkout-layout, .pd-layout, .shop-layout, .blog-grid, .testi-grid, .acct-panel, .footer-top, .auth-card, .cart-drawer .cd-panel')]
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.height > 10 && r.width > 50 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
          });
        for (let i = 0; i < blocks.length - 1; i++) {
          const a = blocks[i], b = blocks[i + 1];
          if (!a.contains(b) && !b.contains(a) && a.parentElement === b.parentElement) {
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            if (ra.bottom > rb.top + 6 && rb.top > ra.top) {
              out.push(`OVERLAP: ${String(a.className).slice(0, 30)} (bottom ${Math.round(ra.bottom)}) × ${String(b.className).slice(0, 30)} (top ${Math.round(rb.top)}) → ${Math.round(ra.bottom - rb.top)}px`);
            }
          }
        }

        // 3) عناصر بیرون‌افتاده از viewport (افقاً)
        // اسکرول افقی: ریل‌ها را کنار می‌گذاریم (اسکرول عمدی = false positive)
        const inHScroll = (el) => {
          let p = el.parentElement;
          while (p) {
            const cs = getComputedStyle(p);
            if (p.scrollWidth > p.clientWidth + 10 && /auto|scroll/.test(cs.overflowX)) return true;
            p = p.parentElement;
          }
          return false;
        };
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && el.offsetParent !== null) {
            const cs = getComputedStyle(el);
            if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky') {
              if (inHScroll(el)) return;
              if (r.right > vw + 1 && r.left > 0) out.push(`OFFSCREEN-R: ${el.tagName}.${String(el.className).slice(0, 28)} right=${Math.round(r.right)} vw=${vw}`);
              if (r.left < -1) out.push(`OFFSCREEN-L: ${el.tagName}.${String(el.className).slice(0, 28)} left=${Math.round(r.left)}`);
            }
          }
        });

        // 4) متن‌های سرریز
        document.querySelectorAll('h1,h2,h3,h4,.p-name,.pd-title,.promo-title,.mh-title,.fc-name,.at-title,.nl-title,.os-name,.rev-title,.f-t').forEach(el => {
          if (el.scrollWidth > el.clientWidth + 6 && el.offsetParent !== null) {
            out.push(`TEXT-OVF: ${el.tagName}.${String(el.className).slice(0, 22)} "${el.textContent.trim().slice(0, 26)}"`);
          }
        });

        // 5) تصاویر شکسته
        document.querySelectorAll('img').forEach(im => {
          if (im.complete && im.naturalWidth === 0) out.push(`BROKEN-IMG: ${im.src.slice(0, 70)}`);
        });

        // 6) دکمه/آیکون با اندازه خیلی کوچک
        document.querySelectorAll('button,a.btn').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && el.offsetParent !== null && !el.closest('.p-wish') && !el.closest('.cd-qty')) {
            if (r.height < 30 && r.width < 30 && getComputedStyle(el).position !== 'absolute') {
              // فقط دکمه‌های تعاملی اصلی
              if (el.closest('header, .bottom-nav, .shop-toolbar')) out.push(`SMALL-TAP: ${el.tagName}.${String(el.className).slice(0, 26)} ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          }
        });
        return out.slice(0, 25);
      });
      if (issues.length) {
        console.log(`\n[${label}] ${rt}`);
        issues.forEach(i => console.log('  ' + i));
      }
    }
    await page.close();
  };

  await scan(1440, 900, 'دسکتاپ');
  await scan(390, 844, 'موبایل');
  await scan(768, 1024, 'تبلت');
  await browser.close();
  console.log('\nاسکن کامل شد');
})();
