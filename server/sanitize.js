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

// الگوهای خطرناک (defense-in-depth در کنار وایت‌لیست تگ/اتریبیوت)
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

// مقادیر مجاز برای src/img (فقط تصویر، نه SVG/HTML)
const IMG_SRC_RE = /^(https?:)?\/\//i;              // http(s):// یا // (پروتکل نسبی)
const IMG_DATA_RE = /^data:image\/(png|jpe?g|gif|webp|avif);/i;
// مقادیر مجاز برای href (جلوگیری از javascript: و vbscript:)
const SAFE_HREF_RE = /^(https?:|mailto:|tel:|\/|#|\.{1,2}\/)/i;

/**
 * رمزگشایی entityهای HTML — برای اینکه حمله‌های رمزگذاری‌شده
 * (مثل jav&#x61;script:) قبل از بررسی الگوها خنثی شوند.
 */
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function isSafeSrc(value) {
  const v = String(value || '').trim();
  return IMG_SRC_RE.test(v) || IMG_DATA_RE.test(v) || (!/^[a-z][a-z0-9+.-]*:/i.test(v) && v.startsWith('/'));
}

function isSafeHref(value) {
  const v = String(value || '').trim();
  return SAFE_HREF_RE.test(v);
}

/**
 * پاکسازی HTML — فقط تگ‌ها و اتریبیوت‌های مجاز را نگه می‌دارد
 * @param {string} html - متن HTML ورودی
 * @returns {string} متن پاکسازی شده
 */
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';

  // رمزگشایی entityها (رفع بای‌پس jav&#x61;script:)
  let clean = decodeEntities(html);

  // حذف الگوهای خطرناک
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, '');
  }

  // بازسازی تگ‌ها فقط با اتریبیوت‌های مجاز
  clean = clean.replace(/<[^>]+>/g, (tag) => {
    // استخراج نام تگ
    const match = tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    if (!match) return '';
    const tagName = match[1].toLowerCase();

    // اگر تگ مجاز نیست، حذف شود
    if (!ALLOWED_TAGS.has(tagName)) return '';

    // تگ بسته‌شونده
    if (/^<\//.test(tag)) return `</${tagName}>`;

    const allowed = ALLOWED_ATTRS[tagName] || [];

    // استخراج اتریبیوت‌ها (با/بدون کوتیشن)
    const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
    let out = `<${tagName}`;
    let am;
    while ((am = attrRe.exec(tag)) !== null) {
      const name = am[1].toLowerCase();
      const rawValue = am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : am[5]);
      // حذف event handlers و اتریبیوت‌های غیرمجاز
      if (name.startsWith('on') || !allowed.includes(name)) continue;
      // اعتبارسنجی scheme برای src/href
      if (name === 'src' && !isSafeSrc(rawValue)) continue;
      if (name === 'href' && !isSafeHref(rawValue)) continue;
      out += ` ${name}="${String(rawValue).replace(/"/g, '&quot;')}"`;
    }

    return out + '>';
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
