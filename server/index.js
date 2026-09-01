// index.js — نقطه ورود سرور پت‌شاپ (Production-Ready)
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { db } = require('./db');
const { seed } = require('./seed');
const { getSetting } = require('./db');
const { initTransporter } = require('./email');

// راه‌اندازی ایمیل اگر SMTP تنظیم شده باشد
initTransporter();

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ============================================================
// SEO — متاتگ‌ها، کلمات کلیدی، لینک canonical و گوگل آنالیتیکس
// این مقادیر از «تنظیمات → سئو» در پنل مدیریت خوانده می‌شوند
// ============================================================
const SEO_DEFAULTS = {
  title: 'پت‌شاپ | فروشگاه اینترنتی محصولات حیوانات خانگی — غذا، اسباب‌بازی، لوازم بهداشتی',
  description: 'پت‌شاپ؛ مرجع تخصصی محصولات حیوانات خانگی. خرید آنلاین غذای سگ و گربه، اسباب‌بازی، لوازم بهداشتی، قلاده، جای خواب و مکمل با ضمانت اصالت و ارسال سریع به سراسر کشور.',
  keywords: 'فروشگاه حیوانات خانگی, غذای سگ, غذای گربه, پت شاپ, خرید غذای خشک سگ, خرید غذای گربه, اسباب بازی سگ, قلاده سگ, جای خواب گربه, مکمل حیوانات, بهداشت سگ و گربه, pet shop, dog food, cat food',
  og_image: '/assets/img/og-cover.webp',
  canonical_url: '',
  site_name: 'پت‌شاپ',
};

function getSeoSettings() {
  const seo = getSetting('seo', {}) || {};
  const out = { ...SEO_DEFAULTS };
  // فقط مقادیر غیرخالی جایگزین پیش‌فرض شوند
  for (const k of Object.keys(out)) {
    if (seo[k] && String(seo[k]).trim()) out[k] = String(seo[k]).trim();
  }
  return out;
}

function getGaId() {
  const seo = getSetting('seo', {}) || {};
  return (seo.ga_measurement_id || process.env.GA_MEASUREMENT_ID || '').trim();
}

function escAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildGaSnippet(gaId) {
  if (!gaId || !gaId.startsWith('G-')) return '';
  const safe = gaId.replace(/[^A-Z0-9-]/gi, '');
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${safe}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${safe}');</script>`;
}

// اگر پشت reverse-proxy (مثل nginx) اجرا می‌شود TRUST_PROXY=1 قرار دهید
// تا IP واقعی کاربر برای rate limit و لاگ استفاده شود
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// ============================================================
// Request ID (برای لاگ و ردیابی)
// ============================================================
app.use((req, res, next) => {
  req.requestId = crypto.randomBytes(8).toString('hex');
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// ============================================================
// Structured Logging
// ============================================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip || req.connection?.remoteAddress || '',
    };
    // لاگ فقط برای API و خطاهات — نه فایل‌های استاتیک
    if (req.originalUrl.startsWith('/api') || res.statusCode >= 400) {
      if (log.level === 'error') {
        console.error('[REQ]', JSON.stringify(log));
      } else if (log.level === 'warn') {
        console.warn('[REQ]', JSON.stringify(log));
      } else if (duration > 1000) {
        // فقط درخواست‌های کند لاگ شوند
        console.log('[REQ]', JSON.stringify(log));
      }
    }
  });
  next();
});

// ---------- Seed در اولین اجرا ----------
seed();

app.use(express.json({ limit: '2mb' }));

// ============================================================
// Security Headers (Production-Grade)
// ============================================================
app.use((req, res, next) => {
  // حفاظت XSS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=(self)',
  ].join(', '));

  // HSTS (فقط در HTTPS فعال)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // CSP — Production-Grade
  // Note: unsafe-inline برای style مورد نیاز است (SPA inline styles)
  // unsafe-eval حذف شد — کد باید بدون eval کار کند
  const csp = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // اضافه کردن GA اگر فعال باشد — directiveها باید یکتا باشند؛
  // تکرار script-src/connect-src طبق مشخصات CSP نادیده گرفته می‌شود
  const scriptSrc = ["'self'"];
  const connectSrc = ["'self'"];
  const imgSrc = ["'self'", 'data:', 'blob:'];
  // شناسه GA از تنظیمات پنل (دیتابیس) یا متغیر محیطی
  const gaId = getGaId();
  if (gaId && gaId.startsWith('G-')) {
    scriptSrc.push('https://www.googletagmanager.com', 'https://www.google-analytics.com');
    connectSrc.push('https://www.google-analytics.com', 'https://analytics.google.com', 'https://region1.google-analytics.com');
    imgSrc.push('https://www.google-analytics.com', 'https://region1.google-analytics.com');
  }
  csp.splice(1, 0, `script-src ${scriptSrc.join(' ')}`);
  csp.push(`img-src ${imgSrc.join(' ')}`);
  csp.push(`connect-src ${connectSrc.join(' ')}`);

  res.setHeader('Content-Security-Policy', csp.join('; '));

  next();
});

// ============================================================
// Rate Limiting (Production-Grade — In-Memory)
// ============================================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // ۱ دقیقه

// Rate limits مختلف برای مسیرهای مختلف
const RATE_LIMITS = {
  '/api/auth/login': { max: 10, window: 15 * 60 * 1000 },   // ۱۰ تلاش ورود در ۱۵ دقیقه
  '/api/auth/register': { max: 10, window: 60 * 60 * 1000 }, // ۱۰ ثبت‌نام در ۱ ساعت
  '/api/auth/forgot': { max: 5, window: 15 * 60 * 1000 },   // ۵ بازیابی در ۱۵ دقیقه
  '/api/auth/reset': { max: 5, window: 15 * 60 * 1000 },    // ۵ ریست در ۱۵ دقیقه
  '/api/orders': { max: 30, window: 60 * 1000 },             // ۳۰ سفارش در دقیقه
  '/api/payments': { max: 20, window: 60 * 1000 },           // ۲۰ پرداخت در دقیقه
  '/api/reviews': { max: 20, window: 60 * 1000 },            // ۲۰ نظر در دقیقه
  '/api/coupons': { max: 20, window: 60 * 1000 },            // ۲۰ اعتبارسنجی کد تخفیف در دقیقه
  '/api/search': { max: 60, window: 60 * 1000 },             // ۶۰ جستجو در دقیقه
  '/api/products': { max: 120, window: 60 * 1000 },          // ۱۲۰ درخواست محصول در دقیقه
  'default': { max: 200, window: 60 * 1000 },                // ۲۰۰ درخواست در دقیقه
};

function findRateLimit(path) {
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern !== 'default' && path.startsWith(pattern)) return config;
  }
  return RATE_LIMITS.default;
}

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  // داخل middleware نصب‌شده با app.use، req.path نسبت به نقطه نصب است؛
  // مسیر کامل با baseUrl ساخته می‌شود تا الگوهای RATE_LIMITS درست match شوند
  const fullPath = (req.baseUrl || '') + req.path;
  const config = findRateLimit(fullPath);
  const key = `${ip}:${fullPath}`;
  const now = Date.now();

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, start: now });
    return next();
  }

  const entry = rateLimitStore.get(key);
  if (now - entry.start > config.window) {
    entry.count = 1;
    entry.start = now;
    return next();
  }

  entry.count++;
  if (entry.count > config.max) {
    const retryAfter = Math.ceil((entry.start + config.window - now) / 1000);
    const retryMin = Math.ceil(retryAfter / 60);
    const retryText = retryMin > 1 ? `${retryMin} دقیقه` : `${retryAfter} ثانیه`;
    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', 0);
    return res.status(429).json({
      error: `تعداد درخواست‌ها بیش از حد مجاز است. ${retryText} دیگر تلاش کنید.`,
      retryAfter,
    });
  }

  res.setHeader('X-RateLimit-Limit', config.max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - entry.count));
  res.setHeader('X-RateLimit-Reset', new Date(entry.start + config.window).toISOString());

  next();
}

// پاکسازی دوره‌ای store
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 3) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// اعمال rate limit به مسیرهای حساس
app.use('/api/auth', rateLimit);
app.use('/api/orders', rateLimit);
app.use('/api/payments', rateLimit);
app.use('/api/reviews', rateLimit);
app.use('/api/coupons', rateLimit);
app.use('/api/search', rateLimit);
app.use('/api/products', rateLimit);

// ---------- فایل‌های استاتیک ----------
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets'), { maxAge: '30d' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '30d', immutable: true }));

// ---------- مسیرهای API ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/public'));
const orderRoutes = require('./routes/orders');
app.use('/api', orderRoutes);
app.use('/api/admin', require('./routes/admin'));

// ---------- انقضای خودکار سفارش‌های پرداخت‌نشده ----------
// بلافاصله بعد از استارت + هر ۱۰ دقیقه
const { expireStaleOrders } = orderRoutes;
expireStaleOrders();
setInterval(expireStaleOrders, 10 * 60 * 1000);

// ---------- فید ترب ----------
const { generateTorobFeed, generateTorobJsonFeed } = require('./torob');
app.get('/api/torob/feed.xml', (req, res) => {
  const torob = getSetting('torob', { enabled: true }) || {};
  if (torob.enabled === false) return res.status(404).json({ error: 'فید ترب غیرفعال است.' });
  const base = (req.protocol + '://' + req.get('host'));
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(generateTorobFeed(base, torob));
});
app.get('/api/torob/feed.json', (req, res) => {
  const torob = getSetting('torob', { enabled: true }) || {};
  if (torob.enabled === false) return res.status(404).json({ error: 'فید ترب غیرفعال است.' });
  const base = (req.protocol + '://' + req.get('host'));
  res.json(generateTorobJsonFeed(base, torob));
});

// ============================================================
// Health Check Endpoint
// ============================================================
app.get('/api/health', (req, res) => {
  try {
    // بررسی دیتابیس
    db.prepare('SELECT 1').get();
    const dbOk = true;

    // بررسی disk space
    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', 'data');
    let diskOk = true;
    try { fs.accessSync(dataDir, fs.constants.W_OK); } catch { diskOk = false; }

    const status = dbOk && diskOk ? 'healthy' : 'degraded';
    res.json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbOk ? 'ok' : 'error',
      disk: diskOk ? 'ok' : 'error',
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      },
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

// ---------- صفحه اصلی با متاتگ‌های سئو و GA (تزریق سمت سرور) ----------
app.get('/', (req, res) => {
  const seo = getSeoSettings();
  const base = (req.protocol + '://' + req.get('host'));
  const canonical = seo.canonical_url || base + '/';
  const ogImage = /^https?:\/\//i.test(seo.og_image)
    ? seo.og_image
    : base + (seo.og_image || '/assets/img/og-cover.webp');

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')
    .replaceAll('{{SEO_TITLE}}', escAttr(seo.title))
    .replaceAll('{{SEO_DESCRIPTION}}', escAttr(seo.description))
    .replaceAll('{{SEO_KEYWORDS}}', escAttr(seo.keywords))
    .replaceAll('{{SITE_NAME}}', escAttr(seo.site_name))
    .replaceAll('{{CANONICAL_URL}}', escAttr(canonical))
    .replaceAll('{{OG_IMAGE}}', escAttr(ogImage))
    .replaceAll('{{GA_SNIPPET}}', buildGaSnippet(getGaId()));

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ---------- sitemap و robots ----------
app.get('/sitemap.xml', (req, res) => {
  const base = (req.protocol + '://' + req.get('host'));
  const now = new Date().toISOString();
  const products = db.prepare("SELECT p.slug, p.created_at, (SELECT image FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1) AS image FROM products p WHERE p.status='active' AND p.is_demo = 0 ORDER BY p.id DESC").all();
  const cats = db.prepare("SELECT slug FROM categories WHERE is_active=1").all();
  const arts = db.prepare("SELECT slug, created_at FROM articles WHERE status='active' ORDER BY created_at DESC").all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // صفحات اصلی
  xml += `  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
  xml += `  <url><loc>${base}/#/shop</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
  xml += `  <url><loc>${base}/#/blog</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  xml += `  <url><loc>${base}/#/about</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
  xml += `  <url><loc>${base}/#/rules</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>\n`;
  xml += `  <url><loc>${base}/#/contact</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;

  products.forEach(p => {
    const lastmod = p.created_at || now;
    const img = p.image ? `<image:image><image:loc>${base}${p.image}</image:loc></image:image>` : '';
    xml += `  <url><loc>${base}/#/product/${p.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority>${img}</url>\n`;
  });

  cats.forEach(c => {
    xml += `  <url><loc>${base}/#/category/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
  });

  arts.forEach(a => {
    xml += `  <url><loc>${base}/#/blog/${a.slug}</loc><lastmod>${a.created_at || now}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  });

  xml += '</urlset>';
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: ${req.protocol}://${req.get('host')}/sitemap.xml
`);
});

// ---------- اپلیکیشن‌ها ----------
app.use('/admin', express.static(path.join(__dirname, '..', 'admin'), {
  setHeaders: (res, filePath) => {
    if (/\.(html?|js|css|json)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    if (/\.(html?|js|css|json)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(jpg|jpeg|png|webp|avif|gif|svg|ico|woff2?)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  },
}));

// ---------- خطاها ----------
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'مسیر یافت نشد.' } }));

app.use((err, req, res, next) => {
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ ok: false, error: { code: 'FILE_TOO_LARGE', message: 'حجم فایل بیش از حد مجاز است.' } });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ ok: false, error: { code: 'TOO_MANY_FILES', message: 'تعداد فایل‌ها بیش از حد مجاز است.' } });
  }
  if (err.message && err.message.includes('فرمت تصویر')) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_FILE_TYPE', message: err.message } });
  }

  console.error('[Error]', err.message);
  // در Production جزئیات حساس نمایش داده نشود
  const message = IS_PROD ? 'خطای داخلی سرور' : err.message;
  res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message } });
});

// ============================================================
// Graceful Shutdown
// ============================================================
function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

  // بستن سرور HTTP
  server.close(() => {
    console.log('[Server] HTTP server closed.');

    // بستن اتصال دیتابیس
    try {
      db.close();
      console.log('[Server] Database connection closed.');
    } catch (e) {
      console.error('[Server] Error closing database:', e.message);
    }

    console.log('[Server] Graceful shutdown complete.');
    process.exit(0);
  });

  // اگر بعد از ۱۰ ثانیه بسته نشد، اجباری خاموش شود
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

// ============================================================
// راه‌اندازی سرور
// ============================================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🐾 ═══════════════════════════════════════════`);
  console.log(`   پت‌شاپ — پنل فروشگاه حیوانات خانگی`);
  console.log(`   ═══════════════════════════════════════════`);
  console.log(`   🌐 فروشگاه:    http://localhost:${PORT}/`);
  console.log(`   🛠️  پنل مدیریت:  http://localhost:${PORT}/admin/`);
  console.log(`   🔧 Health:      http://localhost:${PORT}/api/health`);
  console.log(`   📊 Mode:        ${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`   ═══════════════════════════════════════════\n`);
  if (!IS_PROD) {
    console.log(`   📧 مدیر: admin@petshop.ir / admin1234`);
    console.log(`   ⚠️  Mock Payment: فعال (فقط توسعه)\n`);
  }
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err.message);
  gracefulShutdown('uncaughtException');
});
