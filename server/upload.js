// upload.js — آپلود امن تصویر (Production-Ready)
// Security: MIME type check, Sharp processing, secure filenames, size limits
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// فرمت‌های مجاز
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|webp|avif)$/i;

// حداکثر حجم فایل: 5MB (برای تصاویر بهینه)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
    return cb(new Error('فرمت تصویر مجاز نیست. فقط JPG، PNG، WebP و AVIF پذیرفته می‌شود.'));
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

// ---------- Sharp Processing (بعد از آپلود) ----------
// این تابع تصویر آپلود شده را بهینه‌سازی و WebP تبدیل می‌کند
async function processImage(inputPath, options = {}) {
  try {
    // Sharp فقط در صورت نصب بودن کار می‌کند
    const sharp = require('sharp');

    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 80,
      format = 'webp',
    } = options;

    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(ext, `.${format}`);

    await sharp(inputPath)
      .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
      .toFormat(format, { quality })
      .toFile(outputPath);

    // حذف فایل اصلی اگر فرمت متفاوت است
    if (outputPath !== inputPath) {
      try { fs.unlinkSync(inputPath); } catch {}
    }

    return outputPath;
  } catch (err) {
    console.error('[Upload] Sharp processing failed:', err.message);
    // اگر Sharp کار نکرد، فایل اصلی باقی می‌ماند
    return inputPath;
  }
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

module.exports = { upload, processImage, cleanupFile };
