// sanitize.js — پاکسازی HTML محتوای کاربران (XSS Protection)
// ساده و امن — بدون وابستگی اضافی

// تگ‌های مجاز
const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'blockquote', 'pre', 'code',
  'div', 'span',
]);

// Attribute‌های مجاز برای هر تگ
const ALLOWED_ATTRS = {
  'a': ['href', 'title'],
  'img': ['src', 'alt', 'title', 'width', 'height'],
  'div': ['class', 'dir'],
  'span': ['class', 'dir'],
  'td': ['colspan', 'rowspan'],
  'th': ['colspan', 'rowspan'],
};

// الگوهای خطرناک
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /<\/script>/i,
  /javascript:/i,
  /on\w+\s*=/i,           // onclick, onerror, onload, etc.
  /data:text\/html/i,
  /vbscript:/i,
  /expression\(/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /<form[\s>]/i,
  /<input[\s>]/i,
  /<textarea[\s>]/i,
  /<style[\s>]/i,
  /<link[\s>]/i,
  /<meta[\s>]/i,
];

/**
 * پاکسازی HTML — فقط تگ‌های مجاز را نگه می‌دارد
 * @param {string} html - متن HTML ورودی
 * @returns {string} متن پاکسازی شده
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // حذف الگوهای خطرناک
  let clean = html;
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, '');
  }

  // حذف تمام تگ‌ها و فقط نگه‌داشتن متن
  // این approach ساده‌تر و امن‌تر از parse کردن HTML است
  clean = clean.replace(/<[^>]+>/g, (tag) => {
    // استخراج نام تگ
    const match = tag.match(/^<\/?(\w+)/);
    if (!match) return '';
    const tagName = match[1].toLowerCase();

    // اگر تگ مجاز نیست، حذف شود
    if (!ALLOWED_TAGS.has(tagName)) return '';

    // بررسی attribute‌های خطرناک
    const attrs = tag.match(/\s+(\w+)=/g) || [];
    for (const attr of attrs) {
      const attrName = attr.trim().split('=')[0].toLowerCase();
      // حذف event handlers
      if (attrName.startsWith('on')) return '';
    }

    return tag;
  });

  return clean;
}

/**
 * حذف تمام تگ‌های HTML — فقط متن ساده
 * @param {string} text
 * @returns {string}
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * پاکسازی متن ساده (برای فیلدهای متنی)
 * @param {string} text
 * @param {number} maxLen - حداکثر طول
 * @returns {string}
 */
function sanitizeText(text, maxLen = 1000) {
  if (!text || typeof text !== 'string') return '';
  return text.trim().slice(0, maxLen);
}

module.exports = { sanitizeHtml, stripHtml, sanitizeText };
