// pages/pages.js — صفحات محتوایی: درباره ما، تماس، FAQ، قوانین
import { API } from '../api.js';
import { Settings } from '../store.js';

export function title(params) {
  const t = { about: 'درباره ما', contact: 'تماس با ما', faq: 'سوالات متداول', rules: 'قوانین و مقررات' }[params.key] || 'صفحه';
  return t + ' | پت‌شاپ';
}

export async function render(params, query) {
  const key = params.key;

  if (key === 'faq') {
    const { faqs } = await API.get('/faqs');
    return `
    <div class="container">
      <nav class="breadcrumb"><a href="#/">خانه</a><span class="sep">/</span><span>سوالات متداول</span></nav>
      <div class="page-hero">
        <div><h1>❓ سوالات متداول</h1><p>پاسخ سوالات پرتکرار شما درباره خرید از پت‌شاپ</p></div>
        <div class="ph-ic">🐱</div>
      </div>
      <div class="faq-list" style="margin-top:24px">
        ${faqs.map((f, i) => `
          <div class="faq-item" data-faq>
            <button class="faq-q"><span>${f.question}</span><span class="fq-ic">+</span></button>
            <div class="faq-a"><div class="faq-a-inner">${f.answer}</div></div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  if (key === 'contact') {
    const s = await Settings.get();
    const c = s.contact || {};
    const soc = s.socials || {};
    return `
    <div class="container">
      <nav class="breadcrumb"><a href="#/">خانه</a><span class="sep">/</span><span>تماس با ما</span></nav>
      <div class="page-hero">
        <div><h1>📞 تماس با ما</h1><p>همیشه در کنار شما و پت‌های عزیزتان هستیم</p></div>
        <div class="ph-ic">🐶</div>
      </div>
      <div class="contact-grid">
        <div class="contact-card">
          <h3>🏢 اطلاعات فروشگاه</h3>
          <div class="c-info-row"><span class="ci-ic">📍</span><div><span class="ci-l">آدرس</span><span class="ci-v">${c.address || ''}</span></div></div>
          <div class="c-info-row"><span class="ci-ic">📞</span><div><span class="ci-l">تلفن ثابت</span><span class="ci-v" dir="ltr">${c.phone || ''}</span></div></div>
          <div class="c-info-row"><span class="ci-ic">📱</span><div><span class="ci-l">موبایل / واتساپ</span><span class="ci-v" dir="ltr">${c.mobile || ''}</span></div></div>
          <div class="c-info-row"><span class="ci-ic">✉️</span><div><span class="ci-l">ایمیل</span><span class="ci-v" dir="ltr">${c.email || ''}</span></div></div>
          <div class="c-info-row"><span class="ci-ic">🕘</span><div><span class="ci-l">ساعات کاری</span><span class="ci-v">${c.work_hours || ''}</span></div></div>
        </div>
        <div class="contact-card">
          <h3>💬 شبکه‌های اجتماعی</h3>
          <p style="font-size:13px;color:var(--muted);margin-bottom:14px">سریع‌ترین راه ارتباطی ما؛ سوال‌تان را در پیام‌رسان‌ها بپرسید!</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${soc.instagram ? `<a class="btn btn-outline" href="https://instagram.com/${soc.instagram}" target="_blank" rel="noopener">📷 اینستاگرام</a>` : ''}
            ${soc.telegram ? `<a class="btn btn-outline" href="https://t.me/${soc.telegram}" target="_blank" rel="noopener">✈️ تلگرام</a>` : ''}
            ${soc.whatsapp ? `<a class="btn btn-outline" href="https://wa.me/${soc.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener">💬 واتساپ</a>` : ''}
          </div>
          <div class="auth-note" style="margin-top:20px">
            <span class="an-ic">🐾</span>
            <span>تیم پشتیبانی پت‌شاپ همه‌روزه از ۹ صبح تا ۹ شب پاسخگوی شماست.</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  // about / rules
  const { page } = await API.get('/pages/' + (key === 'about' ? 'about_page' : 'rules_page'));
  return `
  <div class="container">
    <nav class="breadcrumb"><a href="#/">خانه</a><span class="sep">/</span><span>${page.title || ''}</span></nav>
    <div class="page-hero">
      <div><h1>${key === 'about' ? '🐾 ' : '📜 '}${page.title || ''}</h1><p>${key === 'about' ? 'داستان پت‌شاپ و عشق ما به حیوانات' : 'قوانین خرید از پت‌شاپ'}</p></div>
      <div class="ph-ic">${key === 'about' ? '🐰' : '📋'}</div>
    </div>
    <article class="article-single" style="margin-top:26px">
      ${page.image ? `<div class="as-img"><img src="${page.image}" alt="${page.title}"></div>` : ''}
      <div class="as-content">${page.content || '<p>محتوای این صفحه به‌زودی منتشر می‌شود.</p>'}</div>
    </article>
  </div>`;
}

export function mount(el) {
  // آکاردئون FAQ
  el.querySelectorAll('[data-faq]').forEach(item => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      el.querySelectorAll('[data-faq].open').forEach(x => {
        x.classList.remove('open');
        x.querySelector('.faq-a').style.maxHeight = '0';
      });
      if (!open) {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });
}
