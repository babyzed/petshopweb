// index.js — نقطه ورود سرور پت‌شاپ
const express = require('express');
const path = require('path');
const { db } = require('./db');
const { seed } = require('./seed');
const { getSetting } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Seed در اولین اجرا ----------
seed();

app.use(express.json({ limit: '2mb' }));

// ---------- فایل‌های استاتیک ----------
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d' }));

// ---------- مسیرهای API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// ---------- sitemap و robots ----------
app.get('/sitemap.xml', (req, res) => {
  const base = (req.protocol + '://' + req.get('host'));
  const products = db.prepare("SELECT slug FROM products WHERE status='active'").all();
  const cats = db.prepare("SELECT slug FROM categories WHERE is_active=1").all();
  const arts = db.prepare("SELECT slug FROM articles WHERE status='active'").all();
  let xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  xml += `<url><loc>${base}/#/</loc></url><url><loc>${base}/#/shop</loc></url><url><loc>${base}/#/blog</loc></url>`;
  products.forEach(p => xml += `<url><loc>${base}/#/product/${p.slug}</loc></url>`);
  cats.forEach(c => xml += `<url><loc>${base}/#/category/${c.slug}</loc></url>`);
  arts.forEach(a => xml += `<url><loc>${base}/#/blog/${a.slug}</loc></url>`);
  xml += '</urlset>';
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});
app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`);
});

// ---------- اپلیکیشن‌ها ----------
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
// HTML/JS/CSS بدون کش (تا به‌روزرسانی‌ها فوراً دیده شوند)؛ تصاویر با کش بلند
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (/\.(html?|js|css|json)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// ---------- خطاها ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'مسیر یافت نشد.' }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: err.message || 'خطای داخلی سرور' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🐾 پت‌شاپ روی پورت ${PORT} در حال اجراست`);
  console.log(`   فروشگاه: http://localhost:${PORT}/`);
  console.log(`   پنل مدیریت: http://localhost:${PORT}/admin/`);
  console.log('   ورود مدیر: admin@petshop.ir / admin123');
});
