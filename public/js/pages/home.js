// pages/home.js — صفحه اصلی (همه بخش‌ها داینامیک از /api/home)
import { API, price, faNum, currentPrice, discountPct, dateFa } from '../api.js';
import { Cart, Settings } from '../store.js';
import { productCard, productCardH, stars } from '../components.js';
import { ic } from '../icons.js';

let data = null;
let heroTimer = null;
let heroIndex = 0;

export async function render() {
  data = await API.get('/home');
  const hs = data.home_settings || {};
  const sec = (k) => hs.sections?.[k]?.enabled !== false;
  const secTitle = (k, fallback) => hs.sections?.[k]?.title || fallback;

  // انتخاب کارت محصول بر اساس عرض
  const isMobile = window.innerWidth <= 900;
  const card = (p) => isMobile ? productCardH(p) : productCard(p);
  const grid = (products) => products.length ? `<div class="p-grid ${isMobile ? 'rail' : ''}">${products.map(card).join('')}</div>` : '';

  const heroSlides = (data.hero || []).filter(b => b.image);
  const heroHtml = heroSlides.length ? `
    <div class="hero-slider" data-hero>
      ${heroSlides.map((s, i) => `
        <div class="hero-slide ${i === 0 ? 'active' : ''}" data-slide="${i}">
          <img src="${s.image}" alt="${s.title}" loading="${i === 0 ? 'eager' : 'lazy'}">
          <div class="hero-content">
            <span class="hero-tag">${ic('paw', 15)} پت‌شاپ؛ همراه وفادار شما</span>
            <h2 class="hero-title">${s.title}</h2>
            <p class="hero-subtitle">${s.subtitle || ''}</p>
            <div class="hero-cta">
              <a class="btn btn-primary" href="${s.link || '#/shop'}">خرید کنید</a>
              <a class="btn btn-dark" href="#/category/dog-food">دسته‌بندی‌ها</a>
            </div>
          </div>
        </div>`).join('')}
      <div class="hero-dots">${heroSlides.map((_, i) => `<button class="${i === 0 ? 'active' : ''}" data-dot="${i}"></button>`).join('')}</div>
      ${heroSlides.length > 1 ? `<div class="hero-arrows"><button data-hero-next>←</button></div>` : ''}
    </div>
    <div class="mobile-hero" data-mhero>
      ${heroSlides.map((s, i) => `
        <div class="mh-slide ${i === 0 ? 'active' : ''}" data-mslide="${i}">
          <img src="${s.image}" alt="${s.title}" loading="lazy">
          <div class="mh-body">
            <span class="hero-tag">${ic('paw', 14)} پت‌شاپ</span>
            <h2 class="mh-title">${s.title}</h2>
            <p class="mh-sub">${s.subtitle || ''}</p>
            <a class="btn btn-primary mh-cta" href="${s.link || '#/shop'}">مشاهده</a>
          </div>
        </div>`).join('')}
      <div class="mh-dots" style="position:absolute;bottom:14px;inset-inline-start:50%;transform:translateX(50%)">
        ${heroSlides.map((_, i) => `<button class="${i === 0 ? 'active' : ''}" data-mdot="${i}"></button>`).join('')}
      </div>
    </div>` : '';

  const promoHtml = (data.promo || []).filter(b => b.image).length ? `
    <section class="section" style="padding-top:0">
      <div class="container promo-grid">
        ${data.promo.filter(b => b.image).map(b => `
          <a class="promo-card" href="${b.link || '#/shop'}">
            <img src="${b.image}" alt="${b.title}" loading="lazy">
            <div class="promo-body">
              <h3 class="promo-title">${b.title}</h3>
              <p class="promo-sub">${b.subtitle || ''}</p>
              <span class="promo-cta">مشاهده ←</span>
            </div>
          </a>`).join('')}
      </div>
    </section>` : '';

  const catHtml = data.categories.length ? `
    <section class="section" data-sec="categories">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title"><span class="st-ic">${ic('grid', 22)}</span>${secTitle('categories', 'دسته‌بندی محصولات')}</h2>
          <a class="section-link" href="#/shop">همه محصولات ←</a>
        </div>
        <div class="cat-grid">
          ${data.categories.map(c => `
            <a class="cat-card" href="#/category/${c.slug}">
              <span class="cat-emoji">${c.icon || ic('paw', 30)}</span>
              ${c.image ? `<img class="cat-img" src="${c.image}" alt="${c.name}" loading="lazy">` : '<span style="font-size:44px">${ic(\'paw\', 40)}</span>'}
              <span class="cat-name">${c.name}</span>
              <span class="cat-count">${faNum(c.count)} محصول</span>
            </a>`).join('')}
        </div>
      </div>
    </section>` : '';

  const sectionBlock = (key, title, iconName, products, link) => sec(key) && products.length ? `
    <section class="section" data-sec="${key}">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title"><span class="st-ic">${ic(iconName, 22)}</span>${title}</h2>
          ${link ? `<a class="section-link" href="${link}">مشاهده همه ←</a>` : ''}
        </div>
        ${grid(products)}
      </div>
    </section>` : '';

  // کارت قهرمان دسکتاپ: اولین محصول سکشن پرفروش‌ها با نمایش بزرگ
  const heroCard = (p) => isMobile ? '' : `
    <a class="featured-card" href="#/product/${p.slug}">
      <div class="fc-media"><img src="${p.image || '/assets/img/placeholder.jpg'}" alt="${p.name}" loading="lazy" onerror="this.src='/assets/img/placeholder.jpg'"></div>
      <div class="fc-body">
        <span class="fc-badge">${ic('star', 13)} پرفروش هفته</span>
        <h3 class="fc-name">${p.name}</h3>
        <div class="fc-price">${price(currentPrice(p))} <span class="unit">تومان</span></div>
        <span class="btn btn-primary fc-cta">خرید این محصول ←</span>
      </div>
    </a>`;
  const bestsellersHtml = sec('bestsellers') && data.bestsellers.length ? `
    <section class="section" data-sec="bestsellers">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title"><span class="st-ic">${ic('flame', 22)}</span>${secTitle('bestsellers', 'پرفروش‌ترین‌ها')}</h2>
          <a class="section-link" href="#/shop?sort=best">مشاهده همه ←</a>
        </div>
        ${isMobile ? grid(data.bestsellers) : `
        <div class="bs-wrap">
          ${heroCard(data.bestsellers[0])}
          <div class="p-grid cols-5">${data.bestsellers.slice(1, 6).map(productCard).join('')}</div>
        </div>`}
      </div>
    </section>` : '';

  const brandsHtml = sec('brands') && data.brands.length ? `
    <section class="section" data-sec="brands">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title"><span class="st-ic">${ic('tag', 22)}</span>${secTitle('brands', 'برندهای معتبر')}</h2>
        </div>
        <div class="brands-row">
          ${data.brands.map(b => `<a class="brand-chip" href="#/shop?brand=${b.id}">${b.logo ? `<img src="${b.logo}" style="height:26px">` : ''}${b.name}</a>`).join('')}
        </div>
      </div>
    </section>` : '';

  const aboutHtml = sec('about') && data.about_teaser ? `
    <section class="section" data-sec="about">
      <div class="container">
        <div class="about-teaser">
          <div>
            <span class="at-badge">${ic('star', 13)} ${data.about_teaser.badge || ''}</span>
            <h2 class="at-title">${data.about_teaser.title || ''}</h2>
            <p class="at-text">${data.about_teaser.text || ''}</p>
            ${data.about_teaser.stats?.length ? `
            <div class="at-stats">
              ${data.about_teaser.stats.map(s => `<div class="at-stat"><div class="v">${s.value}</div><div class="l">${s.label}</div></div>`).join('')}
            </div>` : ''}
            <a class="btn btn-primary" style="margin-top:22px" href="#/page/about">بیشتر بدانید</a>
          </div>
          <div class="at-media">
            ${data.about_teaser.image ? `<img src="${data.about_teaser.image}" alt="درباره پت‌شاپ" loading="lazy">` : ''}
            <div class="at-float"><span class="af-ic">${ic('paw', 22)}</span><span>مورد اعتماد بیش از ۱۵ هزار خانواده</span></div>
          </div>
        </div>
      </div>
    </section>` : '';

  const featuresHtml = sec('features') && data.features?.length ? `
    <section class="section" style="padding-top:0" data-sec="features">
      <div class="container">
        <div class="features-grid">
          ${data.features.map(f => `
            <div class="feature-item">
              <div class="f-ic">${f.icon}</div>
              <div class="f-t">${f.title}</div>
              <div class="f-x">${f.text}</div>
            </div>`).join('')}
        </div>
      </div>
    </section>` : '';

  const blogHtml = sec('blog') && data.articles.length ? `
    <section class="section" data-sec="blog">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title"><span class="st-ic">${ic('book', 22)}</span>${secTitle('blog', 'مجله پت')}</h2>
          <a class="section-link" href="#/blog">همه مقالات ←</a>
        </div>
        <div class="blog-grid">
          ${data.articles.map(a => `
            <a class="article-card" href="#/blog/${a.slug}">
              <div class="a-media">
                ${a.image ? `<img src="${a.image}" alt="${a.title}" loading="lazy">` : ''}
                <span class="a-cat">${a.category || 'پت‌شاپ'}</span>
              </div>
              <div class="a-body">
                <h3 class="a-title">${a.title}</h3>
                <p class="a-excerpt">${a.excerpt || ''}</p>
                <div class="a-meta"><span>${ic('calendar', 13)} ${dateFa(a.created_at)}</span><span>${ic('eye', 13)} ${faNum(3 + a.id % 20)} بازدید</span></div>
              </div>
            </a>`).join('')}
        </div>
      </div>
    </section>` : '';

  const testiHtml = sec('testimonials') && data.testimonials.length ? `
    <section class="section" data-sec="testimonials">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title"><span class="st-ic">${ic('chat', 22)}</span>${secTitle('testimonials', 'نظر مشتریان')}</h2>
        </div>
        <div class="testi-grid">
          ${data.testimonials.map(t => `
            <div class="testi-card">
              <span class="t-quote">"</span>
              <p class="testi-text">${t.text}</p>
              <div class="testi-foot">
                <span class="testi-avatar">${t.name.trim()[0]}</span>
                <div>
                  <div class="testi-name">${t.name}</div>
                  <div class="testi-role">${t.role || ''}</div>
                </div>
                <div style="margin-inline-start:auto">${stars(t.rating)}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </section>` : '';

  const newsHtml = sec('newsletter') ? `
    <section class="section" style="padding-top:0" data-sec="newsletter">
      <div class="container">
        <div class="newsletter">
          <div>
            <h2 class="nl-title">${ic('paw', 18)} عضویت در خبرنامه پت‌شاپ</h2>
            <p class="nl-text">از تخفیف‌های ویژه و نکات تخصصی مراقبت از پت‌ها باخبر شوید.</p>
          </div>
          <form class="nl-form" data-newsletter>
            <input type="email" placeholder="ایمیل شما..." required aria-label="ایمیل">
            <button class="btn btn-primary" type="submit">عضویت</button>
          </form>
        </div>
      </div>
    </section>` : '';

  return `
    <div class="container" style="padding-top:0">
      ${heroHtml}
      ${promoHtml}
    </div>
    ${catHtml}
    <div class="container">
      ${bestsellersHtml}
      ${sectionBlock('new', secTitle('new', 'جدیدترین محصولات'), 'sparkles', data.new, '#/shop?sort=newest')}
    </div>
    <div class="container">
      ${sectionBlock('sales', secTitle('sales', 'تخفیف‌های ویژه'), 'percent', data.sales, '#/shop?on_sale=1')}
    </div>
    ${sec('sales') ? `<div class="container" style="padding-top:0">${bannerWide(data.promo)}</div>` : ''}
    <div class="container">
      ${sectionBlock('special', secTitle('special', 'پیشنهاد پت‌شاپ'), 'star', data.special, '#/shop?sort=popular')}
    </div>
    ${brandsHtml}
    ${aboutHtml}
    ${featuresHtml}
    <div class="container">
      ${blogHtml}
      ${testiHtml}
      ${newsHtml}
    </div>`;
}

function bannerWide(promos) {
  const b = (promos || []).find(x => x.image && x.position === 'promo');
  if (!b) return '';
  return `
    <section class="section" style="padding-top:0">
      <a class="promo-card" href="${b.link || '#/shop'}" style="min-height:160px;display:block">
        <img src="${b.image}" alt="${b.title}" loading="lazy">
        <div class="promo-body"><h3 class="promo-title">${b.title}</h3><p class="promo-sub">${b.subtitle || ''}</p></div>
      </a>
    </section>`;
}

export function mount(el) {
  // رویدادهای hero
  const slides = el.querySelectorAll('.hero-slide');
  const mslides = el.querySelectorAll('.mh-slide');
  const dots = el.querySelectorAll('[data-dot]');
  const mdots = el.querySelectorAll('[data-mdot]');
  const go = (i) => {
    if (!slides.length) return;
    heroIndex = (i + slides.length) % slides.length;
    slides.forEach((s, j) => s.classList.toggle('active', j === heroIndex));
    dots.forEach((d, j) => d.classList.toggle('active', j === heroIndex));
    mslides.forEach((s, j) => s.classList.toggle('active', j === heroIndex));
    mdots.forEach((d, j) => d.classList.toggle('active', j === heroIndex));
  };
  if (slides.length > 1) {
    heroTimer = setInterval(() => go(heroIndex + 1), 6000);
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    mdots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    const next = el.querySelector('[data-hero-next]');
    if (next) next.addEventListener('click', () => go(heroIndex + 1));
  }
  // خبرنامه
  const nl = el.querySelector('[data-newsletter]');
  if (nl) {
    nl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = nl.querySelector('input').value;
      nl.innerHTML = '<p style="color:#fff;font-weight:700">عضویت شما با موفقیت ثبت شد! به خانواده پت‌شاپ خوش آمدید.</p>';
    });
  }
}

export function cleanup() {
  if (heroTimer) clearInterval(heroTimer);
}
