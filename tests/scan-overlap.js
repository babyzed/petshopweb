// اسکن تداخل واقعی: حذف اوورلی‌های طراحانه (متن روی تصویر، نشان روی کارت و...)
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const scan = async (w, h, label) => {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 });
    const routes = ['/#/', '/#/shop', '/#/product/adult-cat-food-chicken', '/#/checkout', '/#/blog', '/#/page/about', '/#/page/contact', '/#/auth', '/#/account', '/#/order/PS-310281', '/#/search/غذای'];
    for (const rt of routes) {
      await page.goto('http://localhost:3000' + rt, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 1000));
      const issues = await page.evaluate(() => {
        const out = [];
        const vw = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > vw + 2) out.push(`OVERFLOW-X ${document.documentElement.scrollWidth - vw}px`);

        const isInScroll = (el) => {
          let p = el.parentElement;
          while (p) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') return true; p = p.parentElement; }
          return false;
        };
        const isOverlay = (small, big) => {
          // کوچک مطلق/فیکس است و داخل یک اجداد دارای position (همان big یا جد بزرگ‌تر) قرار دارد
          const cs = getComputedStyle(small);
          if (cs.position !== 'absolute' && cs.position !== 'fixed') return false;
          let p = small.parentElement;
          while (p && p !== big) {
            const ps = getComputedStyle(p).position;
            if (ps !== 'static') return true; // داخل یک لایه بالاتر از big → اوورلی طراحانه
            p = p.parentElement;
          }
          return false;
        };

        const els = [...document.querySelectorAll('body *')].filter(el => {
          const r = el.getBoundingClientRect();
          if (r.width < 6 || r.height < 6) return false;
          if (el.offsetParent === null) return false;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
          if (isInScroll(el)) return false;
          // شیت‌ها و دراپرهای بسته (translate شده) را حذف کن
          if (cs.transform && cs.transform !== 'none' && !cs.transform.includes('matrix(1, 0, 0, 1, 0, 0)') && el.closest('.filter-sheet, .drawer-menu, .cart-drawer, .modal-backdrop')) return false;
          return true;
        });

        for (let i = 0; i < els.length; i++) {
          const a = els[i];
          const ra = a.getBoundingClientRect();
          for (let j = i + 1; j < els.length; j++) {
            const b = els[j];
            if (a.contains(b) || b.contains(a)) continue;
            if (isOverlay(a, b) || isOverlay(b, a)) continue;
            const rb = b.getBoundingClientRect();
            // عناصر فیکس/استیکی لایه‌ی رویی هستند (ناوبری پایین، تول‌بار و...)
            // پوشاندن محتوای اسکرول‌شونده توسط آن‌ها طراحی است، نه تداخل
            const inFixed = (el) => {
              let p = el;
              while (p) {
                const pos = getComputedStyle(p).position;
                if (pos === 'fixed' || pos === 'sticky') return true;
                p = p.parentElement;
              }
              return false;
            };
            if (inFixed(a) || inFixed(b)) continue;
            // هر دو باید داخل viewport باشند
            if (ra.right < 0 || ra.left > vw || rb.right < 0 || rb.left > vw) continue;
            if (ra.bottom < 0 || ra.top > window.innerHeight || rb.bottom < 0 || rb.top > window.innerHeight) continue;
            const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
            const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
            if (ix > 40 && iy > 16) {
              const inter = ix * iy;
              const areaA = ra.width * ra.height, areaB = rb.width * rb.height;
              // اگر المان بالایی در نقطه‌ی برخورد داخل لایه‌ی absolute/fixed باشد،
              // پوشاندنِ طراحانه است (متن روی تصویر، نشان روی کارت و...) نه تداخل
              const cx = Math.max(ra.left, rb.left) + ix / 2;
              const cy = Math.max(ra.top, rb.top) + iy / 2;
              const topEl = document.elementFromPoint(cx, cy);
              if (topEl) {
                let p = topEl;
                let layered = false;
                while (p) {
                  const pos = getComputedStyle(p).position;
                  if (pos === 'absolute' || pos === 'fixed') { layered = true; break; }
                  p = p.parentElement;
                }
                if (layered) continue;
              }
              if (inter > 0.3 * Math.min(areaA, areaB) && inter > 1000) {
                const csa = String(a.className).slice(0, 30) || a.tagName;
                const csb = String(b.className).slice(0, 30) || b.tagName;
                const key = csa + '×' + csb;
                if (!out.some(x => x.includes(key))) out.push(`OVERLAP: ${key} [${Math.round(ra.top)}-${Math.round(ra.bottom)}]×[${Math.round(rb.top)}-${Math.round(rb.bottom)}] ${Math.round(ix)}x${Math.round(iy)}`);
              }
            }
          }
        }

        // متن سرریز
        document.querySelectorAll('h1,h2,h3,h4,.p-name,.pd-title,.promo-title,.mh-title,.fc-name,.at-title,.nl-title,.os-name,.rev-title,.f-t,.section-title,.btn').forEach(el => {
          if (el.scrollWidth > el.clientWidth + 6 && el.offsetParent !== null) {
            out.push(`TEXT-OVF: ${el.tagName}.${String(el.className).slice(0, 20)} "${el.textContent.trim().slice(0, 24)}" ${Math.round(el.clientWidth)}<${Math.round(el.scrollWidth)}`);
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
