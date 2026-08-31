// meta.js — مدیریت متاتگ‌های SEO صفحات (title, description, og, twitter, canonical)
const SITE = 'پت‌شاپ';

function ensureMeta(name, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  return el;
}

function ensureCanonical() {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  return el;
}

/**
 * به‌روزرسانی متاتگ‌های صفحه
 * @param {object} o
 * @param {string} [o.title]      عنوان صفحه (بدون نام سایت)
 * @param {string} [o.description] توضیحات
 * @param {string} [o.image]      تصویر مطلق برای og:image / twitter:image
 * @param {string} [o.path]       مسیر نسبی (مثلاً '/#/product/slug') برای canonical
 */
export function setMeta({ title, description, image, path } = {}) {
  const base = (window.location.origin || '');
  const fullTitle = title ? `${title} | ${SITE}` : document.title;

  document.title = fullTitle;

  if (description) {
    ensureMeta('description').setAttribute('content', description);
    ensureMeta('og:description', 'property').setAttribute('content', description);
    ensureMeta('twitter:description').setAttribute('content', description);
  }
  if (title) {
    ensureMeta('og:title', 'property').setAttribute('content', fullTitle);
    ensureMeta('twitter:title').setAttribute('content', fullTitle);
  }
  if (image) {
    const abs = /^https?:\/\//i.test(image) ? image : base + image;
    ensureMeta('og:image', 'property').setAttribute('content', abs);
    ensureMeta('twitter:image').setAttribute('content', abs);
  }
  if (path) {
    ensureCanonical().setAttribute('href', base + path);
  }
}

/** بازنشانی به متاتگ‌های پیش‌فرض سایت (برای صفحه اصلی) */
export function resetMeta() {
  setMeta({
    title: 'فروشگاه اینترنتی محصولات حیوانات خانگی',
    description: '',
    path: '/',
  });
}
