// routes/public.js — API عمومی فروشگاه (بدون نیاز به ورود)
const express = require('express');
const { db, getSetting } = require('../db');
const { authRequired } = require('../auth');
const { sanitizeHtml, sanitizeText } = require('../sanitize');
const { SAMAN_TERMINAL_ID } = require('../payment');

const router = express.Router();

// ---------- Rate Limiting ساده برای نظرات ----------
const reviewLimiter = new Map();
function checkReviewLimit(userId) {
  const entry = reviewLimiter.get(userId);
  if (!entry) return false;
  if (Date.now() - entry < 60000) return true; // ۱ نظر در دقیقه
  reviewLimiter.delete(userId);
  return false;
}

// ---------- جلوگیری از شمارش مضاعف بازدید ----------
// هر IP برای هر محصول حداکثر یک بازدید در ساعت ثبت می‌کند
const viewDedupe = new Map(); // key: ip:productId → timestamp
const VIEW_DEDUPE_TTL = 60 * 60 * 1000;

function shouldCountView(ip, productId) {
  const key = `${ip}:${productId}`;
  const now = Date.now();
  const last = viewDedupe.get(key) || 0;
  if (now - last < VIEW_DEDUPE_TTL) return false;

  // پاکسازی دوره‌ای entryهای منقضی (جلوی رشد بی‌حد حافظه)
  if (viewDedupe.size > 5000) {
    for (const [k, t] of viewDedupe) {
      if (now - t > VIEW_DEDUPE_TTL) viewDedupe.delete(k);
    }
    if (viewDedupe.size > 10000) viewDedupe.clear();
  }

  viewDedupe.set(key, now);
  return true;
}

// ---------- ابزار مشترک ----------
function productBaseQuery(withImages = false) {
  return `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name, b.slug AS brand_slug,
      COALESCE((SELECT image FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1),
        (SELECT MIN(image) FROM categories WHERE id = p.category_id), '/assets/img/placeholder.jpg') AS image,
      (SELECT ROUND(AVG(rating), 1) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS rating,
      (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS review_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.status = 'active'
  `;
}

function categoryTree() {
  const cats = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all();
  const counts = db.prepare(`
    SELECT c.id, COUNT(p.id) AS cnt FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.status = 'active'
    GROUP BY c.id
  `).all();
  const countMap = Object.fromEntries(counts.map(c => [c.id, c.cnt]));
  const byParent = {};
  cats.forEach(c => { (byParent[c.parent_id || 0] = byParent[c.parent_id || 0] || []).push({ ...c, count: countMap[c.id] || 0, children: [] }); });
  const tree = byParent[0] || [];
  const attach = list => list.forEach(c => { c.children = byParent[c.id] || []; attach(c.children); });
  attach(tree);
  return tree;
}

function getProductBySlug(slug) {
  return db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name, b.slug AS brand_slug,
      (SELECT ROUND(AVG(rating), 1) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS rating,
      (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS review_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.slug = ? AND p.status = 'active'
  `).get(slug);
}

function getProductsByIds(ids) {
  if (!ids.length) return [];
  const marks = ids.map(() => '?').join(',');
  return db.prepare(productBaseQuery() + ` AND p.id IN (${marks})`).all(...ids);
}

// ---------- داده‌های صفحه اصلی ----------
router.get('/home', (req, res) => {
  const home = getSetting('home_settings', {});
  const hero = db.prepare("SELECT * FROM banners WHERE position='hero' AND is_active = 1 ORDER BY sort_order ASC, id ASC").all();
  const promo = db.prepare("SELECT * FROM banners WHERE position='promo' AND is_active = 1 ORDER BY sort_order ASC, id ASC").all();
  const categories = categoryTree();
  const brands = db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY name ASC').all();

  const bestsellers = db.prepare(`
    SELECT oi.product_id AS id, SUM(oi.quantity) AS sold FROM order_items oi
    JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
    GROUP BY oi.product_id ORDER BY sold DESC LIMIT 8
  `).all();
  const bestIds = bestsellers.map(b => b.id);
  const newProducts = db.prepare(productBaseQuery() + ' ORDER BY p.created_at DESC, p.id DESC LIMIT 8').all();
  const sales = db.prepare(productBaseQuery() + ' AND p.sale_price IS NOT NULL AND p.sale_price < p.price ORDER BY (p.price - p.sale_price) DESC LIMIT 8').all();
  const special = db.prepare(productBaseQuery() + ' AND p.is_special = 1 ORDER BY p.id DESC LIMIT 8').all();
  const articles = db.prepare("SELECT id, title, slug, excerpt, image, category, created_at FROM articles WHERE status = 'active' ORDER BY created_at DESC LIMIT 3").all();
  const testimonials = db.prepare("SELECT * FROM testimonials WHERE is_active = 1 AND is_demo = 0 ORDER BY id DESC LIMIT 6").all();

  // ---------- آمار واقعی (فقط سفارش‌های غیرنمایشی) ----------
  const totalOrders = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE is_demo = 0").get().c;
  const totalCustomers = db.prepare("SELECT COUNT(DISTINCT user_id) AS c FROM orders WHERE is_demo = 0 AND user_id IS NOT NULL").get().c;
  const guestCustomers = db.prepare("SELECT COUNT(DISTINCT customer_json) AS c FROM orders WHERE is_demo = 0 AND user_id IS NULL").get().c;
  const uniqueCustomers = totalCustomers + guestCustomers;
  const totalProducts = db.prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'active'").get().c;
  const totalReviews = db.prepare("SELECT COUNT(*) AS c FROM product_reviews WHERE status = 'approved' AND is_demo = 0").get().c;
  const avgRating = db.prepare("SELECT ROUND(AVG(rating),1) AS avg FROM product_reviews WHERE status = 'approved' AND is_demo = 0").get().avg || 0;
  const satisfaction = totalReviews > 0 ? Math.round((avgRating / 5) * 100) : 0;

  // آمار اولیه (تنظیم شده توسط مدیر)
  const initialStats = getSetting('initial_stats', { years: 0, customers: 0, satisfaction: 0, founded_year: new Date().getFullYear() });

  // سال تجربه = آمار اولیه + سال‌های از اولین سفارش
  const firstOrder = db.prepare("SELECT MIN(created_at) AS first FROM orders WHERE is_demo = 0").get().first;
  let yearsFromOrders = 0;
  if (firstOrder) {
    const firstDate = new Date(firstOrder);
    const now = new Date();
    yearsFromOrders = Math.floor((now - firstDate) / (365.25 * 24 * 60 * 60 * 1000));
  }
  const totalYears = Math.max(initialStats.years, yearsFromOrders);

  // مشتریان = آمار اولیه + مشتریان واقعی
  const totalCustomersAll = initialStats.customers + uniqueCustomers;

  // رضایت = آمار اولیه یا واقعی
  const totalSatisfaction = initialStats.satisfaction > 0 ? initialStats.satisfaction : satisfaction;

  // آمار داینامیک about_teaser
  const aboutTeaser = getSetting('about_teaser', null);
  if (aboutTeaser && aboutTeaser.stats) {
    aboutTeaser.stats = [
      { value: totalYears > 0 ? `${totalYears.toLocaleString('fa-IR')}+` : '—', label: 'سال تجربه' },
      { value: totalCustomersAll > 0 ? `${totalCustomersAll.toLocaleString('fa-IR')}+` : '—', label: 'مشتری راضی' },
      { value: totalProducts > 0 ? `${totalProducts.toLocaleString('fa-IR')}+` : '—', label: 'محصول متنوع' },
      { value: totalSatisfaction > 0 ? `${String(totalSatisfaction).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])}٪` : '—', label: 'رضایت مشتری' },
    ];
  }

  res.json({
    hero,
    promo,
    categories,
    brands,
    bestsellers: getProductsByIds(bestIds),
    new: newProducts,
    sales,
    special,
    articles,
    testimonials,
    features: getSetting('features', []),
    about_teaser: aboutTeaser,
    home_settings: home,
  });
});

// ---------- تنظیمات عمومی (فوتر، تماس) ----------
router.get('/settings/public', (req, res) => {
  res.json({
    contact: getSetting('contact', {}),
    socials: getSetting('socials', {}),
    footer: getSetting('footer', {}),
    shipping: getSetting('shipping', { cost: 75000, free_over: 2000000 }),
    site: getSetting('site', { name: 'پت‌شاپ' }),
    payment: (() => {
      const pay = getSetting('payment', { online_enabled: true, cod_enabled: true });
      // اگر درگاه سامان تنظیم نشده، پرداخت آنلاین غیرفعال باشه
      if (!SAMAN_TERMINAL_ID) pay.online_enabled = false;
      return pay;
    })(),
  });
});

// ---------- دسته‌بندی‌ها ----------
router.get('/categories', (req, res) => {
  res.json({ categories: categoryTree() });
});

// ---------- برندها ----------
router.get('/brands', (req, res) => {
  res.json({ brands: db.prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY name ASC').all() });
});

// ---------- محصولات با فیلتر و مرتب‌سازی ----------
router.get('/products', (req, res) => {
  const { category, brand, q, min_price, max_price, in_stock, on_sale, sort, page = 1, per_page = 12, feature } = req.query;
  const where = ['p.status = \'active\''];
  const params = [];

  if (category) {
    // شامل زیردسته‌ها
    const cat = db.prepare('SELECT id FROM categories WHERE slug = ? OR id = ?').get(category, Number(category) || 0);
    if (cat) {
      const all = db.prepare('SELECT id, parent_id FROM categories').all();
      const children = new Set([cat.id]);
      let changed = true;
      while (changed) {
        changed = false;
        all.forEach(c => { if (children.has(c.parent_id) && !children.has(c.id)) { children.add(c.id); changed = true; } });
      }
      const ids = [...children];
      where.push(`p.category_id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids);
    }
  }
  if (brand) { where.push('p.brand_id = ?'); params.push(Number(brand)); }
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (min_price !== undefined && min_price !== '') { where.push('COALESCE(p.sale_price, p.price) >= ?'); params.push(Number(min_price)); }
  if (max_price !== undefined && max_price !== '') { where.push('COALESCE(p.sale_price, p.price) <= ?'); params.push(Number(max_price)); }
  if (in_stock === '1' || in_stock === 'true') where.push('p.stock > 0');
  if (on_sale === '1' || on_sale === 'true') where.push('p.sale_price IS NOT NULL AND p.sale_price < p.price');
  if (feature) { where.push('p.features LIKE ?'); params.push(`%"${feature}":%`); }

  const orderMap = {
    newest: 'p.created_at DESC, p.id DESC',
    price_asc: 'COALESCE(p.sale_price, p.price) ASC',
    price_desc: 'COALESCE(p.sale_price, p.price) DESC',
    discount: '(p.price - COALESCE(p.sale_price, p.price)) DESC',
    best: '(SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.status NOT IN (\'cancelled\') WHERE oi.product_id=p.id) DESC',
    popular: 'p.views DESC',
  };
  const order = orderMap[sort] || orderMap.newest;

  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(48, Math.max(1, Number(per_page) || 12));
  const total = db.prepare(`SELECT COUNT(*) AS c FROM products p WHERE ${where.join(' AND ')}`).get(...params).c;
  const rows = db.prepare(productBaseQuery() + ` AND ${where.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, size, (pageNum - 1) * size);

  // ویژگی‌های قابل فیلتر دسته
  let featureOptions = [];
  if (category) {
    const cat = db.prepare('SELECT id FROM categories WHERE slug = ? OR id = ?').get(category, Number(category) || 0);
    if (cat) {
      const feats = db.prepare('SELECT features FROM products WHERE category_id = ? AND status = \'active\' AND features != \'{}\'').all(cat.id);
      const seen = new Set();
      feats.forEach(f => {
        try { Object.entries(JSON.parse(f.features)).forEach(([k, v]) => { const key = k + '::' + v; if (!seen.has(key)) { seen.add(key); featureOptions.push({ k, v }); } }); } catch {}
      });
    }
  }

  res.json({ products: rows, total, page: pageNum, per_page: size, pages: Math.ceil(total / size), featureOptions });
});

// ---------- جزئیات محصول ----------
router.get('/products/:slug', (req, res) => {
  const product = getProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ error: 'محصول یافت نشد.' });
  if (shouldCountView(req.ip || '', product.id)) {
    db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(product.id);
  }
  product.features = (() => { try { return JSON.parse(product.features); } catch { return {}; } })();
  product.images = db.prepare('SELECT id, image FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC').all(product.id);
  if (!product.image) product.image = product.images?.[0]?.image || '/assets/img/placeholder.jpg';
  product.reviews = db.prepare(`
    SELECT r.*, u.name AS user_name FROM product_reviews r JOIN users u ON u.id = r.user_id
    WHERE r.product_id = ? AND r.status = 'approved' ORDER BY r.created_at DESC
  `).all(product.id);
  product.related = getProductsByIds(
    db.prepare('SELECT id FROM products WHERE status = \'active\' AND category_id = ? AND id != ? ORDER BY (views * 1.0) DESC, id DESC LIMIT 4').all(product.category_id, product.id).map(r => r.id)
  );
  product.category_info = db.prepare('SELECT * FROM categories WHERE id = ?').get(product.category_id);
  res.json({ product });
});

// ---------- جزئیات محصول بر اساس ID (برای علاقه‌مندی‌ها) ----------
// توجه: این مسیر باید قبل از `/products/:slug` تعریف شود تا روت‌های
// بدون پارامتر slug با ID اشتباه گرفته نشوند.
router.get('/products/by-id/:id', (req, res) => {
  const productId = Number(req.params.id);
  if (!productId || productId < 1) return res.status(400).json({ error: 'شناسه محصول نامعتبر است.' });
  const product = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name, b.slug AS brand_slug,
      (SELECT ROUND(AVG(rating), 1) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS rating,
      (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS review_count
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.id = ? AND p.status = 'active'
  `).get(productId);
  if (!product) return res.status(404).json({ error: 'محصول یافت نشد.' });
  product.features = (() => { try { return JSON.parse(product.features); } catch { return {}; } })();
  product.images = db.prepare('SELECT id, image FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC').all(product.id);
  if (!product.image) product.image = product.images?.[0]?.image || '/assets/img/placeholder.jpg';
  res.json({ product });
});

// ---------- ثبت نظر برای محصول ----------
router.post('/products/:id/review', authRequired, (req, res) => {
  try {
    const pid = Number(req.params.id);
    if (!pid || pid < 1) return res.status(400).json({ error: 'شناسه محصول نامعتبر است.' });
    // Rate limit
    if (checkReviewLimit(req.user.id)) {
      return res.status(429).json({ error: 'لطفاً بین نظرات فاصله بگذارید.' });
    }
    const p = db.prepare('SELECT id FROM products WHERE id = ?').get(pid);
    if (!p) return res.status(404).json({ error: 'محصول یافت نشد.' });
    // بررسی تکراری نبودن نظر
    const existing = db.prepare('SELECT id FROM product_reviews WHERE product_id = ? AND user_id = ? AND created_at > datetime(\'now\', \'-1 day\')').get(pid, req.user.id);
    if (existing) return res.status(429).json({ error: 'شما در ۲۴ ساعت اخیر برای این محصول نظر داده‌اید.' });
    const { rating, title, comment } = req.body || {};
    const r = Number(rating);
    if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'امتیاز باید بین ۱ تا ۵ باشد.' });
    if (!comment || String(comment).trim().length < 5) return res.status(400).json({ error: 'متن نظر حداقل ۵ کاراکتر باشد.' });
    if (String(comment).length > 2000) return res.status(400).json({ error: 'متن نظر حداکثر ۲۰۰۰ کاراکتر باشد.' });
    db.prepare('INSERT INTO product_reviews (product_id, user_id, rating, title, comment) VALUES (?,?,?,?,?)')
      .run(pid, req.user.id, r, sanitizeText(String(title || ''), 100), sanitizeText(String(comment), 2000));
    reviewLimiter.set(req.user.id, Date.now());
    res.json({ ok: true, message: 'نظر شما ثبت شد و پس از تایید مدیریت نمایش داده می‌شود.' });
  } catch (err) {
    console.error('[Review] Error:', err.message);
    res.status(500).json({ error: 'خطا در ثبت نظر.' });
  }
});

// ---------- مقالات ----------
router.get('/articles', (req, res) => {
  const rows = db.prepare("SELECT id, title, slug, excerpt, image, category, created_at FROM articles WHERE status = 'active' ORDER BY created_at DESC").all();
  res.json({ articles: rows });
});
router.get('/articles/:slug', (req, res) => {
  const article = db.prepare("SELECT * FROM articles WHERE slug = ? AND status = 'active'").get(req.params.slug);
  if (!article) return res.status(404).json({ error: 'مقاله یافت نشد.' });
  // پاکسازی محتوای HTML
  if (article.content) article.content = sanitizeHtml(article.content);
  if (article.excerpt) article.excerpt = sanitizeText(article.excerpt, 500);
  const related = db.prepare("SELECT id, title, slug, image FROM articles WHERE status = 'active' AND id != ? ORDER BY created_at DESC LIMIT 3").all(article.id);
  res.json({ article, related });
});

// ---------- صفحات محتوایی ----------
router.get('/pages/:key', (req, res) => {
  const key = req.params.key;
  const allowed = ['about_page', 'rules_page'];
  if (!allowed.includes(key)) return res.status(404).json({ error: 'صفحه یافت نشد.' });
  res.json({ page: getSetting(key, { title: '', content: '', image: '' }) });
});

// ---------- سوالات متداول ----------
router.get('/faqs', (req, res) => {
  res.json({ faqs: db.prepare('SELECT * FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all() });
});

// ---------- جستجوی سریع ----------
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ products: [], categories: [], articles: [] });
  const like = `%${q}%`;
  const products = db.prepare(productBaseQuery() + ' AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?) LIMIT 6').all(like, like, like);
  const categories = db.prepare("SELECT * FROM categories WHERE is_active = 1 AND name LIKE ? LIMIT 4").all(like);
  const articles = db.prepare("SELECT id, title, slug, image FROM articles WHERE status = 'active' AND (title LIKE ? OR excerpt LIKE ?) LIMIT 3").all(like, like);
  res.json({ products, categories, articles });
});

module.exports = router;
