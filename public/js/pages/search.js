// pages/search.js — صفحه نتایج جستجو
import { API, price, faNum, currentPrice } from '../api.js';
import { productCard, productCardH } from '../components.js';

export function title(params) { return 'جستجو: ' + params.q + ' | پت‌شاپ'; }

export async function render(params, query) {
  const q = decodeURIComponent(params.q || '');
  const [searchRes, listRes] = await Promise.all([
    API.get('/search?q=' + encodeURIComponent(q)),
    API.get('/products?q=' + encodeURIComponent(q) + '&per_page=24'),
  ]);
  const isMobile = window.innerWidth <= 560;
  const card = (p) => isMobile ? productCardH(p) : productCard(p);

  return `
  <div class="container">
    <nav class="breadcrumb"><a href="#/">خانه</a><span class="sep">/</span><span>نتایج جستجو</span></nav>
    <div class="page-hero">
      <div>
        <h1>🔍 نتایج جستجو برای «${q}»</h1>
        <p>${faNum(listRes.total)} محصول پیدا شد</p>
      </div>
      <div class="ph-ic">🔎</div>
    </div>

    ${searchRes.categories.length ? `
    <section class="section" style="padding-top:16px">
      <div class="section-head"><h2 class="section-title"><span class="emoji">🗂️</span>دسته‌های مرتبط</h2></div>
      <div class="cat-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
        ${searchRes.categories.map(c => `
          <a class="cat-card" href="#/category/${c.slug}">
            <span class="cat-emoji">${c.icon || '🐾'}</span>
            <span class="cat-name">${c.name}</span>
            <span class="cat-count">${faNum(c.count)} محصول</span>
          </a>`).join('')}
      </div>
    </section>` : ''}

    ${searchRes.articles.length ? `
    <section class="section">
      <div class="section-head"><h2 class="section-title"><span class="emoji">📰</span>مقالات مرتبط</h2></div>
      <div class="blog-grid">
        ${searchRes.articles.map(a => `
          <a class="article-card" href="#/blog/${a.slug}">
            <div class="a-media">${a.image ? `<img src="${a.image}" alt="" loading="lazy">` : ''}<span class="a-cat">پت‌شاپ</span></div>
            <div class="a-body"><h3 class="a-title">${a.title}</h3></div>
          </a>`).join('')}
      </div>
    </section>` : ''}

    ${listRes.products.length ? `
    <section class="section">
      <div class="section-head"><h2 class="section-title"><span class="emoji">🛍️</span>محصولات</h2></div>
      <div class="p-grid">${listRes.products.map(card).join('')}</div>
    </section>` : `
    <div class="empty-state" style="background:var(--card);border:1px solid var(--line);border-radius:24px;margin-top:20px">
      <div class="es-ic">😿</div>
      <h3>نتیجه‌ای برای «${q}» پیدا نشد</h3>
      <p>املای کلمه را بررسی کنید یا عبارت دیگری امتحان کنید.</p>
      <a class="btn btn-primary" href="#/shop" style="margin-top:14px">مشاهده همه محصولات</a>
    </div>`}
  </div>`;
}
