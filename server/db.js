// db.js — اتصال به SQLite و ساخت Schema (Production-Ready)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'petshop.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ============================================================
// Schema اصلی
// ============================================================
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  avatar TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  permissions TEXT DEFAULT '[]',
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  image TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sku TEXT DEFAULT '',
  category_id INTEGER,
  brand_id INTEGER,
  price INTEGER NOT NULL DEFAULT 0,
  sale_price INTEGER DEFAULT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  weight TEXT DEFAULT '',
  description TEXT DEFAULT '',
  short_description TEXT DEFAULT '',
  features TEXT DEFAULT '{}',
  seo_title TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  is_special INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  title TEXT DEFAULT '',
  comment TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  user_id INTEGER DEFAULT NULL,
  customer_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  subtotal INTEGER NOT NULL DEFAULT 0,
  discount INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  coupon_code TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'cod',
  payment_status TEXT DEFAULT 'unpaid',
  note TEXT DEFAULT '',
  is_demo INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT NOT NULL,
  image TEXT DEFAULT '',
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT DEFAULT '',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province TEXT DEFAULT '',
  city TEXT DEFAULT '',
  address TEXT NOT NULL,
  postal_code TEXT DEFAULT '',
  is_default INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'percent',
  value INTEGER NOT NULL DEFAULT 0,
  min_amount INTEGER DEFAULT 0,
  max_usage INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  expires_at TEXT DEFAULT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  image TEXT DEFAULT '',
  link TEXT DEFAULT '',
  position TEXT DEFAULT 'hero',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT DEFAULT '',
  content TEXT DEFAULT '',
  image TEXT DEFAULT '',
  category TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  text TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  is_active INTEGER DEFAULT 1,
  is_demo INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

-- ============================================================
-- جدول پرداخت‌ها (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER,
  amount INTEGER NOT NULL DEFAULT 0,
  gateway TEXT DEFAULT 'saman',
  authority TEXT DEFAULT '',
  transaction_id TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  raw_response TEXT DEFAULT '',
  verified_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- جدول تاریخچه وضعیت سفارش (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  old_status TEXT DEFAULT '',
  new_status TEXT NOT NULL,
  changed_by INTEGER,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================
-- لاگ امنیتی (Audit Log برای عملیات حساس)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id INTEGER DEFAULT NULL,
  metadata TEXT DEFAULT '{}',
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// ============================================================
// مایگریشن‌ها (اضافه کردن ستون‌های جدید بدون حذف داده)
// ============================================================
const migrations = [
  "ALTER TABLE orders ADD COLUMN is_demo INTEGER DEFAULT 0",
  "ALTER TABLE products ADD COLUMN is_demo INTEGER DEFAULT 0",
  "ALTER TABLE users ADD COLUMN is_demo INTEGER DEFAULT 0",
  "ALTER TABLE product_reviews ADD COLUMN is_demo INTEGER DEFAULT 0",
  "ALTER TABLE testimonials ADD COLUMN is_demo INTEGER DEFAULT 0",
  "ALTER TABLE products ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE products ADD COLUMN short_description TEXT DEFAULT ''",
  "ALTER TABLE products ADD COLUMN seo_title TEXT DEFAULT ''",
  "ALTER TABLE products ADD COLUMN seo_description TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
  "ALTER TABLE orders ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
];

migrations.forEach(sql => {
  try { db.exec(sql); } catch (e) { /* column already exists */ }
});

// ============================================================
// ایندکس‌ها برای عملکرد Production
// ============================================================
const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
  "CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id)",
  "CREATE INDEX IF NOT EXISTS idx_users_is_demo ON users(is_demo)",
  "CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)",
  "CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)",
  "CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id)",
  "CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)",
  "CREATE INDEX IF NOT EXISTS idx_products_is_demo ON products(is_demo)",
  "CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code)",
  "CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
  "CREATE INDEX IF NOT EXISTS idx_orders_is_demo ON orders(is_demo)",
  "CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)",
  "CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)",
  "CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id)",
  "CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON product_reviews(status)",
  "CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id)",
  "CREATE INDEX IF NOT EXISTS idx_payments_authority ON payments(authority)",
  "CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)",
  "CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id)",
  "CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)",
  "CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)",
  "CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id)",
  "CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position)",
  "CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)",
  "CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)",
];

indexes.forEach(sql => {
  try { db.exec(sql); } catch (e) { /* index creation failed */ }
});

// ============================================================
// Helper ها
// ============================================================
function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value_json); } catch { return fallback; }
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json')
    .run(key, JSON.stringify(value));
}

module.exports = { db, getSetting, setSetting };
