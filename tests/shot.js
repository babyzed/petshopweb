const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://localhost:3001/#/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  // Analyze header region bands (y 0..130) for photo-like (high variance) content
  const bands = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    await new Promise(res => {
      // capture via html2canvas is heavy; instead sample getBoundingClientRect + computed bg of header elems
    });
    // Simpler: report each element's rect + bg color in header
    const out = [];
    const header = document.getElementById('site-header');
    header.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10 && r.top < 135) {
        out.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 34),
          pos: cs.position,
          bg: (cs.backgroundImage||'').slice(0, 45),
          bgc: cs.backgroundColor,
          rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          overflow: cs.overflow
        });
      }
    });
    return out;
  });
  console.log(JSON.stringify(bands, null, 2));
  await browser.close();
})();
