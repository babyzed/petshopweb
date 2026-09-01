// upload.js — آپلود امن تصویر (Production-Ready) — خروجی همیشه WebP
// Security: MIME type check, Sharp processing, secure filenames, size limits
// نکته: هر تصویری که آپلود شود به WebP تبدیل و فایل اصلی حذف می‌شود؛
//       بنابراین در کل سایت فقط تصاویر با فرمت .webp نگهداری می‌شوند.
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// فرمت‌های ورودی مجاز (خروجی همیشه WebP خواهد بود)
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|webp|avif|gif|bmp|tif|tiff)$/i;

// حداکثر حجم فایل: 5MB (برای تصاویر بهینه)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// تنظیمات پیش‌فرض تبدیل به WebP
const WEBP_DEFAULTS = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 82,
};

// ---------- Storage امن ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // تولید نام تصادفی امن (هیچ نام اصلی از کاربر استفاده نمی‌شود)
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = crypto.randomBytes(16).toString('hex') + '-' + Date.now() + ext;
    cb(null, safeName);
  },
});

// ---------- فیلتر فایل (MIME + Extension) ----------
const fileFilter = (req, file, cb) => {
  // بررسی MIME type
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new Error('فرمت تصویر مجاز نیست. تصویر را با فرمت JPG، PNG، WebP یا AVIF ارسال کنید (خروجی به WebP تبدیل می‌شود).'));
  }
  // بررسی Extension
  if (!ALLOWED_EXTENSIONS.test(path.extname(file.originalname))) {
    return cb(new Error('پسوند فایل نامعتبر است.'));
  }
  cb(null, true);
};

// ---------- Multer Config ----------
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // حداکثر ۱۰ فایل در هر درخواست
  },
});

// ---------- تبدیل به WebP ----------
// تصویر ورودی را بهینه و به WebP تبدیل می‌کند و فایل اصلی را حذف می‌کند.
// خروجی: مسیر فایل نهایی (.webp)
async function processImage(inputPath, options = {}) {
  const sharp = require('sharp');
  const {
    maxWidth = WEBP_DEFAULTS.maxWidth,
    maxHeight = WEBP_DEFAULTS.maxHeight,
    quality = WEBP_DEFAULTS.quality,
  } = options;

  const ext = path.extname(inputPath);
  const base = ext ? inputPath.slice(0, -ext.length) : inputPath;
  let outputPath = base + '.webp';

  // اگر ورودی خودش webp است، روی فایل موقت بنویس و جایگزین کن
  const sameFile = path.resolve(outputPath) === path.resolve(inputPath);
  const tmpPath = sameFile ? base + '.tmp.webp' : outputPath;

  await sharp(inputPath, { animated: true })
    .rotate() // اصلاح چرخش بر اساس EXIF
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toFile(tmpPath);

  if (sameFile) {
    fs.renameSync(tmpPath, outputPath);
  } else {
    // حذف فایل اصلی با فرمت غیر WebP
    try { fs.unlinkSync(inputPath); } catch {}
  }

  return outputPath;
}

// ---------- Middleware: تبدیل فایل‌های آپلودشده به WebP ----------
// بعد از upload.single/upload.array استفاده می‌شود و req.file/req.files را
// به فایل webp نهایی به‌روزرسانی می‌کند.
function toWebp(options = {}) {
  return async function (req, res, next) {
    const files = [];
    if (req.file) files.push(req.file);
    if (Array.isArray(req.files)) files.push(...req.files);
    else if (req.files && typeof req.files === 'object') {
      Object.values(req.files).forEach(list => Array.isArray(list) && files.push(...list));
    }
    if (!files.length) return next();

    try {
      for (const f of files) {
        const outPath = await processImage(f.path, options);
        f.path = outPath;
        f.filename = path.basename(outPath);
        f.mimetype = 'image/webp';
        try { f.size = fs.statSync(outPath).size; } catch {}
      }
      next();
    } catch (err) {
      console.error('[Upload] WebP conversion failed:', err.message);
      // فایل‌های ناقص را پاک کن تا فرمت غیر webp روی سرور نماند
      files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
      res.status(400).json({ error: 'تبدیل تصویر به WebP ناموفق بود. فایل دیگری را امتحان کنید.' });
    }
  };
}

// ---------- پاکسازی فایل‌های خالی ----------
function cleanupFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) fs.unlinkSync(filePath);
    }
  } catch {}
}

module.exports = { upload, processImage, toWebp, cleanupFile, uploadDir, WEBP_DEFAULTS };
