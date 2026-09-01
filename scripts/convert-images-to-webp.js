#!/usr/bin/env node
// scripts/convert-images-to-webp.js
// ------------------------------------------------------------
// همهٔ تصاویر سایت را به WebP تبدیل می‌کند، فایل‌های با فرمت دیگر
// (jpg/jpeg/png/avif/gif/bmp/tiff) را حذف می‌کند و آدرس تصاویر را در
// دیتابیس (محصولات، دسته‌ها، برندها، بنرها، مقالات و تنظیمات) اصلاح می‌کند.
//
// اجرا:
//   npm run images:webp          # تبدیل + حذف فایل‌های قدیمی + به‌روزرسانی دیتابیس
//   npm run images:webp -- --dry # فقط گزارش، بدون تغییر
// ------------------------------------------------------------
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

const TARGET_DIRS = [
  path.join(ROOT, 'uploads'),
  path.join(ROOT, 'public', 'assets', 'img'),
];

const CONVERTIBLE = /\.(jpg|jpeg|png|avif|gif|bmp|tif|tiff)$/i;

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('❌ پکیج sharp نصب نیست. ابتدا `npm install` را اجرا کنید.');
  process.exit(1);
}

// ---------- پیمایش پوشه‌ها ----------
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && CONVERTIBLE.test(entry.name)) out.push(full);
  }
  return out;
}

// ---------- تبدیل یک فایل ----------
async function convert(file) {
  const ext = path.extname(file);
  const outPath = file.slice(0, -ext.length) + '.webp';

  if (fs.existsSync(outPath)) {
    // نسخهٔ webp از قبل وجود دارد → فقط فایل قدیمی حذف شود
    if (!DRY) fs.unlinkSync(file);
    return { file, outPath, skipped: true };
  }

  if (!DRY) {
    await sharp(file, { animated: true })
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outPath);
    fs.unlinkSync(file);
  }
  return { file, outPath, skipped: false };
}

// ---------- به‌روزرسانی مسیر تصاویر در دیتابیس ----------
function webpUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(CONVERTIBLE, '.webp');
}

function deepReplace(value) {
  if (typeof value === 'string') return webpUrl(value);
  if (Array.isArray(value)) return value.map(deepReplace);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepReplace(v);
    return out;
  }
  return value;
}

function updateDatabase() {
  let db;
  try {
    ({ db } = require(path.join(ROOT, 'server', 'db.js')));
  } catch (err) {
    console.warn('⚠️  دیتابیس باز نشد؛ فقط فایل‌ها تبدیل شدند.', err.message);
    return 0;
  }

  const tableCols = [
    ['product_images', 'image'],
    ['categories', 'image'],
    ['brands', 'logo'],
    ['banners', 'image'],
    ['articles', 'image'],
  ];

  let changed = 0;
  for (const [table, col] of tableCols) {
    let rows = [];
    try {
      rows = db.prepare(`SELECT id, ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != ''`).all();
    } catch { continue; }
    for (const r of rows) {
      const next = webpUrl(r.v);
      if (next !== r.v) {
        if (!DRY) db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`).run(next, r.id);
        changed++;
      }
    }
  }

  // تنظیمات (JSON) — بنرها/صفحات/سئو و ...
  let settings = [];
  try { settings = db.prepare('SELECT key, value_json FROM settings').all(); } catch { settings = []; }
  for (const s of settings) {
    let parsed;
    try { parsed = JSON.parse(s.value_json); } catch { continue; }
    const next = JSON.stringify(deepReplace(parsed));
    if (next !== s.value_json) {
      if (!DRY) db.prepare('UPDATE settings SET value_json = ? WHERE key = ?').run(next, s.key);
      changed++;
    }
  }

  return changed;
}

// ---------- اجرا ----------
(async () => {
  console.log(`🖼️  تبدیل تصاویر به WebP${DRY ? ' (حالت آزمایشی — بدون تغییر)' : ''}\n`);

  const files = TARGET_DIRS.flatMap(d => walk(d));
  if (!files.length) console.log('✅ هیچ تصویر غیر WebP پیدا نشد.');

  let converted = 0, removed = 0, failed = 0;
  for (const f of files) {
    try {
      const r = await convert(f);
      if (r.skipped) { removed++; console.log(`♻️  حذف تکراری: ${path.relative(ROOT, f)}`); }
      else { converted++; console.log(`✅ ${path.relative(ROOT, f)} → ${path.basename(r.outPath)}`); }
    } catch (err) {
      failed++;
      console.error(`❌ خطا در ${path.relative(ROOT, f)}: ${err.message}`);
    }
  }

  const dbChanges = updateDatabase();

  console.log('\n────────────── گزارش ──────────────');
  console.log(`تبدیل‌شده: ${converted}`);
  console.log(`حذف فایل تکراری: ${removed}`);
  console.log(`ناموفق: ${failed}`);
  console.log(`رکوردهای اصلاح‌شده در دیتابیس: ${dbChanges}`);
  console.log('───────────────────────────────────');
  process.exit(failed ? 1 : 0);
})();
