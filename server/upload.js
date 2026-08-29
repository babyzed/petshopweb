// upload.js — کانفیگ آپلود تصویر (Multer)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(file.originalname);
  if (!ok) return cb(new Error('فرمت تصویر مجاز نیست (jpg, png, webp, gif)'));
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

module.exports = { upload };
