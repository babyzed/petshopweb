// components.js — کامپوننت‌های مشترک فروشگاه
import { API, price, discountPct, currentPrice, faNum } from './api.js';
import { ic, catIcon, emojiIcon } from './icons.js';
import { Cart, Session } from './store.js';

// ---------- ستاره‌ها ----------
export function stars(rating, size = 13) {
  const r = Math.round(rating || 0);
  let s = '<span class="stars" style="font-size:' + size + 'px">';
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= r ? 'on' : ''}">${ic('star', 13)}</span>`;
  return s + '</span>';
}

// ---------- کارت محصول (Grid دسکتاپ) ----------
export function productCard(p, opts = {}) {
  const off = discountPct(p);
  const inStock = p.stock > 0;
  const wished = Session.isWished(p.id) ? 'active' : '';
  const special = p.is_special ? `<span class="p-badge sp">${ic('sparkles', 12)} ویژه</span>` : '';
  return `
  <article class="p-card" data-slug="${p.slug}">
    <div class="p-media">
      <a href="#/product/${p.slug}">
        <img src="${p.image || '/assets/img/placeholder.webp'}" alt="${p.name}" loading="lazy">
      </a>
      <div class="p-badges">
        ${off ? `<span class="p-badge off">٪${faNum(off)} تخفیف</span>` : ''}
        ${special}
      </div>
      <button class="p-wish ${wished}" data-wish="${p.id}" aria-label="علاقه‌مندی">
        <span class="${wished ? 'heart-fill' : ''}">${ic('heart', 17)}</span>
      </button>
    </div>
    <div class="p-body">
      <div class="p-brand">${p.brand_name || ''}</div>
      <a class="p-name" href="#/product/${p.slug}">${p.name}</a>
      <div class="p-rating">${stars(p.rating)} <span>${p.rating ? faNum(p.rating) : 'جدید'}</span>${p.review_count ? `<span>(${faNum(p.review_count)} نظر)</span>` : ''}</div>
      <div class="p-price-row">
        <div>
          <div class="p-price">${price(currentPrice(p))} <span class="unit">تومان</span></div>
          ${off ? `<div class="p-price-old">${price(p.price)}</div>` : ''}
        </div>
        <div class="p-actions">
          ${inStock
            ? `<button class="p-add" data-add="${p.id}" aria-label="افزودن به سبد"><span class="pa-ic">${ic('plus', 16)}</span><span class="pa-txt">افزودن</span></button>`
            : `<span class="p-stock out">ناموجود</span>`}
        </div>
      </div>
    </div>
  </article>`;
}

// ---------- کارت محصول افقی (موبایل) ----------
export function productCardH(p) {
  const off = discountPct(p);
  const inStock = p.stock > 0;
  const wished = Session.isWished(p.id) ? 'active' : '';
  return `
  <article class="p-card hz" data-slug="${p.slug}">
    <div class="p-media">
      <a href="#/product/${p.slug}"><img src="${p.image || '/assets/img/placeholder.webp'}" alt="${p.name}" loading="lazy"></a>
      ${off ? `<span class="p-badge off">٪${faNum(off)}</span>` : ''}
      <button class="p-wish ${wished}" data-wish="${p.id}" aria-label="علاقه‌مندی"><span class="${wished ? 'heart-fill' : ''}">${ic('heart', 15)}</span></button>
    </div>
    <div class="p-body">
      <div class="p-brand">${p.brand_name || ''}</div>
      <a class="p-name" href="#/product/${p.slug}">${p.name}</a>
      <div class="p-rating">${stars(p.rating)}</div>
      <div class="p-price-row">
        <div>
          <div class="p-price">${price(currentPrice(p))} <span class="unit">تومان</span></div>
          ${off ? `<div class="p-price-old">${price(p.price)}</div>` : ''}
        </div>
        ${inStock
          ? `<button class="p-add" data-add="${p.id}" aria-label="افزودن به سبد"><span class="pa-ic">${ic('plus', 16)}</span></button>`
          : `<span class="p-stock out">ناموجود</span>`}
      </div>
    </div>
  </article>`;
}

// ---------- سبد: آیکون‌ها ----------
const cartIcon = (withBadge = true) => `
  <button class="icon-btn" data-open-cart aria-label="سبد خرید" style="background:linear-gradient(135deg,var(--brand),#FB923C);color:#fff">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.6"/><circle cx="19" cy="21" r="1.6"/><path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H6"/></svg>
    ${withBadge ? '<span class="badge" data-cart-count></span>' : ''}
  </button>`;

const wishIcon = `
  <button class="icon-btn" data-goto-wish aria-label="علاقه‌مندی‌ها" style="background:var(--bg)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>
  </button>`;

const userIcon = `
  <button class="icon-btn" data-goto-account aria-label="حساب کاربری" style="background:var(--bg)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  </button>`;

// ---------- هدر دسکتاپ ----------
export async function renderHeader() {
  const el = document.getElementById('site-header');
  const [categoriesRes, settings] = await Promise.all([API.get('/categories').catch(() => ({ categories: [] })), import('./store.js').then(m => m.Settings.get())]);
  const cats = categoriesRes.categories;
  const contact = settings.contact || {};
  const socials = settings.socials || {};

  // ساخت منوی دسته با مگامنو (همه دسته‌های ریشه در ستون‌ها)
  const megaItems = cats.map(c => `
    <div>
      <a href="#/category/${c.slug}" class="mega-sub">${catIcon(c, 14)} ${c.name}</a>
      ${c.children.map(ch => `<a href="#/category/${ch.slug}"><span class="mi">${catIcon(ch, 12)}</span>${ch.name}</a>`).join('')}
    </div>`).join('');

  el.innerHTML = `
  <div class="top-bar">
    <div class="container">
      <div style="display:flex;gap:18px;align-items:center">
        <span>${ic('phone', 14)} ${contact.phone || ''}</span>
        <span>${ic('clock', 14)} ${contact.work_hours || ''}</span>
      </div>
      <div class="socials">
        ${socials.instagram ? `<a href="https://instagram.com/${socials.instagram}" target="_blank" rel="noopener">${ic('instagram', 15)} اینستاگرام</a>` : ''}
        ${socials.telegram ? `<a href="https://t.me/${socials.telegram}" target="_blank" rel="noopener">${ic('telegram', 15)} تلگرام</a>` : ''}
        ${socials.whatsapp ? `<a href="https://wa.me/${socials.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener">${ic('whatsapp', 15)} واتساپ</a>` : ''}
      </div>
    </div>
  </div>
  <div class="main-header" id="main-header">
    <div class="container header-main">
      <a class="logo" href="#/">
        <span class="logo-icon">${ic('paw', 21)}</span>
        <span class="logo-text">پت‌شاپ<small>دنیای شادی برای پت شما</small></span>
      </a>
      <div class="search-box">
        <input type="search" placeholder="جستجو در محصولات، دسته‌ها و مقالات..." aria-label="جستجو" data-search-input>
        <button class="search-submit" data-search-open aria-label="جستجو"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></button>
      </div>
      <div class="header-actions">
        ${wishIcon}
        ${userIcon}
        ${cartIcon(true)}
      </div>
    </div>
    <nav class="nav-bar" aria-label="ناوبری اصلی">
      <div class="container">
        <ul class="main-nav">
          <li>
            <a href="#" class="nav-cat-btn" data-mega-toggle>${ic('menu', 17)} دسته‌بندی محصولات</a>
            <div class="mega-panel" data-mega-panel>${megaItems}</div>
          </li>
          <li><a href="#/">خانه</a></li>
          <li><a href="#/shop">فروشگاه</a></li>
          <li><a href="#/shop?on_sale=1">تخفیف‌دارها</a></li>
          <li><a href="#/blog">مجله پت</a></li>
          <li><a href="#/page/about">درباره ما</a></li>
          <li><a href="#/page/contact">تماس با ما</a></li>
          <li><a href="#/page/faq">سوالات متداول</a></li>
        </ul>
      </div>
    </nav>
  </div>`;

  // رویداد مگامنو
  const toggleBtn = el.querySelector('[data-mega-toggle]');
  const panel = el.querySelector('[data-mega-panel]');
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const open = panel.classList.toggle('open');
    toggleBtn.closest('li').classList.toggle('has-open', open);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.main-nav > li:first-child')) {
      panel.classList.remove('open');
      toggleBtn.closest('li').classList.remove('has-open');
    }
  });

  el.querySelector('[data-search-open]').addEventListener('click', openSearch);
  el.querySelector('[data-search-input]').addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = '#/search/' + encodeURIComponent(e.target.value); });
  el.querySelector('[data-open-cart]').addEventListener('click', openCart);
  el.querySelector('[data-goto-wish]').addEventListener('click', () => location.hash = Session.isLoggedIn ? '#/account?tab=wishlist' : '#/auth');
  el.querySelector('[data-goto-account]').addEventListener('click', () => location.hash = Session.isLoggedIn ? '#/account' : '#/auth');

  window.addEventListener('scroll', () => {
    document.getElementById('main-header').classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

// ---------- هدر موبایل ----------
export function renderMobileHeader() {
  const el = document.getElementById('mobile-header');
  if (!el) {
    const h = document.createElement('div');
    h.id = 'mobile-header';
    h.className = 'mobile-header';
    document.getElementById('app').insertBefore(h, document.getElementById('view'));
  }
  const mh = document.getElementById('mobile-header');
  mh.innerHTML = `
  <div class="mob-bar">
    <div class="mob-left">
      <button class="icon-btn" data-mob-menu aria-label="منو" style="background:var(--bg)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <a class="logo" href="#/">
        <span class="logo-icon">${ic('paw', 21)}</span>
        <span class="logo-text">پت‌شاپ</span>
      </a>
    </div>
    <div class="mob-right">
      <button class="icon-btn" data-search-open aria-label="جستجو" style="background:var(--bg)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      </button>
      ${cartIcon(true)}
    </div>
  </div>
  <div id="mob-drawer"></div>`;
  mh.querySelector('[data-mob-menu]').addEventListener('click', async () => {
    const { categories } = await API.get('/categories').catch(() => ({ categories: [] }));
    openDrawer(categories);
  });
  mh.querySelector('[data-search-open]').addEventListener('click', openSearch);
  mh.querySelector('[data-open-cart]').addEventListener('click', () => openCart(true));
}

// ---------- منوی کشویی موبایل ----------
function openDrawer(categories) {
  const wrap = document.createElement('div');
  wrap.className = 'drawer-menu open';
  wrap.innerHTML = `
    <div class="dm-backdrop"></div>
    <div class="dm-panel">
      <div class="dm-head">
        <span class="logo-text">پت‌شاپ</span>
        <button style="color:#fff;font-size:18px" data-dm-close>✕</button>
      </div>
      <div class="dm-list">
        ${categories.map(c => `
          <div>
            <a class="dm-cat" href="#/category/${c.slug}" data-dm-close>
              <span class="mi">${catIcon(c, 15)}</span> ${c.name}
              <span class="cnt">${faNum(c.count)}</span>
              ${c.children.length ? '<span class="chev">◀</span>' : ''}
            </a>
            ${c.children.length ? `<div class="dm-sub">${c.children.map(ch => `<a href="#/category/${ch.slug}" data-dm-close>${catIcon(ch, 13)} ${ch.name}</a>`).join('')}</div>` : ''}
          </div>`).join('')}
      </div>
      <div class="dm-links">
        <a href="#/shop" data-dm-close>${ic('bag', 16)} فروشگاه</a>
        <a href="#/blog" data-dm-close>${ic('newspaper', 16)} مجله پت</a>
        <a href="#/page/about" data-dm-close>${ic('file', 16)} درباره ما</a>
        <a href="#/page/contact" data-dm-close>${ic('phone', 16)} تماس با ما</a>
        <a href="#/page/faq" data-dm-close>${ic('chat', 16)} سوالات متداول</a>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 380); };
  wrap.querySelector('.dm-backdrop').addEventListener('click', close);
  wrap.querySelectorAll('[data-dm-close]').forEach(el => el.addEventListener('click', close));
}

// ---------- ناوبری پایین موبایل ----------
export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  el.innerHTML = `
  <div class="bn-grid">
    <a class="bn-item" href="#/" data-route="" data-match="/"><span class="bn-ic">${ic('home', 20)}</span>خانه</a>
    <a class="bn-item" href="#/shop" data-route="shop" data-match="shop"><span class="bn-ic">${ic('bag', 20)}</span>فروشگاه</a>
    <button class="bn-fab" data-open-cart aria-label="سبد خرید">${ic('cart', 22)}<span class="badge" data-cart-count></span></button>
    <a class="bn-item" href="#/account" data-route="account" data-match="account"><span class="bn-ic">${ic('user', 20)}</span>حساب من</a>
    <a class="bn-item" href="#/blog" data-route="blog" data-match="blog"><span class="bn-ic">${ic('newspaper', 20)}</span>مجله پت</a>
  </div>`;
  el.querySelector('[data-open-cart]').addEventListener('click', () => openCart(true));
}

// ---------- سبد خرید (Drawer دسکتاپ / صفحه موبایل) ----------
export function openCart(mobileFull = false) {
  const drawer = document.getElementById('cart-drawer');
  const isMobile = window.innerWidth <= 900;
  const render = () => {
    const items = Cart.items;
    const subtotal = Cart.subtotal();
    const count = Cart.count();
    drawer.innerHTML = `
      <div class="cd-backdrop" data-cart-close></div>
      <div class="cd-panel">
        <div class="cd-head">
          <h3>${ic('cart', 18)} سبد خرید <span style="color:var(--muted);font-size:12px;font-weight:500">(${faNum(count)} کالا)</span></h3>
          <button class="cd-close" data-cart-close>✕</button>
        </div>
        <div class="cd-items">
          ${items.length === 0 ? `
            <div class="cd-empty">
              <div class="ce-ic">${ic('cart', 30)}</div>
              <p>سبد خرید شما خالی است!<br>بیایید برای پت‌تون چیزی خوشحال‌کننده پیدا کنیم.</p>
              <a class="btn btn-primary" href="#/shop" data-cart-close>مشاهده فروشگاه</a>
            </div>` : items.map(it => `
            <div class="cd-item">
              <img src="${it.image}" alt="${it.name}" loading="lazy">
              <div class="cd-info">
                <div class="cd-name">${it.name}</div>
                <div class="cd-price">${price(it.price)} تومان</div>
                <div class="cd-qty">
                  <button data-qty="-1" data-id="${it.product_id}">−</button>
                  <span>${faNum(it.quantity)}</span>
                  <button data-qty="1" data-id="${it.product_id}">+</button>
                </div>
              </div>
              <button class="cd-remove" data-remove="${it.product_id}" aria-label="حذف">${ic('trash', 16)}</button>
            </div>`).join('')}
        </div>
        ${items.length ? `
        <div class="cd-foot">
          <div class="cd-sum"><span>جمع کالاها</span><span>${price(subtotal)} تومان</span></div>
          <div class="cd-sum total"><span>مبلغ قابل پرداخت</span><span>${price(subtotal)} تومان</span></div>
          <a class="btn btn-primary btn-block btn-lg" href="#/checkout" data-cart-close>ادامه فرآیند خرید ←</a>
        </div>` : ''}
      </div>`;
    drawer.querySelectorAll('[data-cart-close]').forEach(b => b.addEventListener('click', closeCart));
    drawer.querySelectorAll('[data-qty]').forEach(b => b.addEventListener('click', () => { const id = Number(b.dataset.id); const item = Cart.find(id); if (item) Cart.setQty(id, item.quantity + Number(b.dataset.qty)); render(); }));
    drawer.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { Cart.remove(Number(b.dataset.remove)); render(); }));
  };
  drawer.hidden = false;
  drawer.classList.add('open');
  render();
}

export function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  drawer.classList.remove('open');
  setTimeout(() => { drawer.hidden = true; }, 320);
}

// ---------- جستجوی سریع (Overlay) ----------
export function openSearch() {
  const ov = document.getElementById('search-overlay');
  ov.hidden = false;
  ov.innerHTML = `
    <div class="so-head">
      <div class="so-input">
        <input type="search" placeholder="جستجو... (مثلاً: غذای گربه)" autofocus data-so-input>
      </div>
      <button class="btn btn-ghost" data-so-close>بستن</button>
    </div>
    <div class="so-body" data-so-body></div>`;
  const input = ov.querySelector('[data-so-input]');
  const body = ov.querySelector('[data-so-body]');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      if (!q) { body.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">چیزی تایپ کنید...</p>'; return; }
      try {
        const r = await API.get('/search?q=' + encodeURIComponent(q));
        body.innerHTML = `
          ${r.products.length ? `<div class="so-group"><h4>${ic('bag', 15)} محصولات</h4>${r.products.map(p => `
            <a class="so-item" href="#/product/${p.slug}" data-so-close>
              <img src="${p.image}" alt="" loading="lazy">
              <div style="flex:1"><div class="so-name">${p.name}</div><div class="so-price">${price(currentPrice(p))} تومان</div></div>
            </a>`).join('')}</div>` : ''}
          ${r.categories.length ? `<div class="so-group"><h4>${ic('grid', 15)} دسته‌ها</h4>${r.categories.map(c => `
            <a class="so-item" href="#/category/${c.slug}" data-so-close><span style="font-size:24px">${catIcon(c, 22)}</span><div class="so-name">${c.name}</div></a>`).join('')}</div>` : ''}
          ${r.articles.length ? `<div class="so-group"><h4>${ic('book', 15)} مقالات</h4>${r.articles.map(a => `
            <a class="so-item" href="#/blog/${a.slug}" data-so-close><span style="font-size:20px">${ic('file', 18)}</span><div class="so-name">${a.title}</div></a>`).join('')}</div>` : ''}
          ${!r.products.length && !r.categories.length && !r.articles.length ? '<p style="color:var(--muted);text-align:center;padding:30px;font-size:13.5px">نتیجه‌ای پیدا نشد</p>' : ''}`;
        ov.querySelectorAll('[data-so-close]').forEach(b => b.addEventListener('click', closeSearch));
      } catch (e) { body.innerHTML = '<p style="color:var(--danger);text-align:center;padding:20px">خطا در جستجو</p>'; }
    }, 280);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) { location.hash = '#/search/' + encodeURIComponent(input.value.trim()); closeSearch(); } });
  ov.querySelectorAll('[data-so-close]').forEach(b => b.addEventListener('click', closeSearch));
  input.focus();
}
function closeSearch() {
  const ov = document.getElementById('search-overlay');
  ov.hidden = true;
  ov.innerHTML = '';
}

// ---------- Toast ----------
export function toast(message, type = 'ok') {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'err' ? 'err' : type === 'info' ? '' : 'ok');
  t.innerHTML = `${type === 'err' ? ic('alert', 15) : type === 'info' ? ic('info', 15) : ic('check', 15)} ${message}`;
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2600);
}

// ---------- Modal ----------
export function openModal(html, opts = {}) {
  const root = document.getElementById('modal-root');
  const m = document.createElement('div');
  m.className = 'modal-backdrop';
  m.innerHTML = `<div class="modal-box">${html}</div>`;
  root.appendChild(m);
  const close = () => { m.remove(); };
  if (!opts.static) m.addEventListener('click', (e) => { if (e.target === m) close(); });
  return { el: m, close, body: m.querySelector('.modal-box') };
}

// ---------- فوتر ----------
export async function renderFooter() {
  const el = document.getElementById('site-footer');
  const settings = (await import('./store.js')).Settings;
  const s = await settings.get();
  const contact = s.contact || {};
  const socials = s.socials || {};
  const footer = s.footer || {};
  el.innerHTML = `
  <div class="site-footer">
    <div class="container">
      <div class="f-grid">
        <div>
          <div class="f-logo">
            <span class="logo-icon">${ic('paw', 21)}</span>
            <span class="logo-text" style="color:#fff">پت‌شاپ</span>
          </div>
          <p class="f-desc">${footer.description || 'پت‌شاپ؛ مرجع تخصصی محصولات حیوانات خانگی.'}</p>
          ${footer.badges?.length ? `<div class="f-badges">${footer.badges.map(b => `<span class="f-badge">${emojiIcon(b.icon, 16, 'shield')} ${b.title}</span>`).join('')}</div>` : ''}
        </div>
        <div class="f-col">
          <h4>دسترسی سریع</h4>
          <a href="#/">خانه</a>
          <a href="#/shop">فروشگاه</a>
          <a href="#/blog">مجله پت</a>
          <a href="#/page/about">درباره ما</a>
          <a href="#/page/contact">تماس با ما</a>
          <a href="#/page/faq">سوالات متداول</a>
        </div>
        <div class="f-col">
          <h4>دسته‌های محبوب</h4>
          <a href="#/category/dog-food">غذای سگ</a>
          <a href="#/category/cat-food">غذای گربه</a>
          <a href="#/category/treats">تشویقی</a>
          <a href="#/category/toys">اسباب‌بازی</a>
          <a href="#/category/bedding">جای خواب</a>
          <a href="#/category/supplements">مکمل‌ها</a>
        </div>
        <div class="f-col">
          <h4>اطلاعات تماس</h4>
          <ul class="f-contact">
            <li><span class="fc-ic">${ic('pin', 15)}</span><span>${contact.address || ''}</span></li>
            <li><span class="fc-ic">${ic('phone', 15)}</span><span dir="ltr">${contact.phone || ''}</span></li>
            <li><span class="fc-ic">${ic('phone', 15)}</span><span dir="ltr">${contact.mobile || ''}</span></li>
            <li><span class="fc-ic">${ic('mail', 15)}</span><span dir="ltr">${contact.email || ''}</span></li>
            <li><span class="fc-ic">${ic('clock', 15)}</span><span>${contact.work_hours || ''}</span></li>
          </ul>
          <div class="f-socials">
            ${socials.instagram ? `<a class="f-social" href="https://instagram.com/${socials.instagram}" target="_blank" rel="noopener" aria-label="اینستاگرام">${ic('instagram', 17)}</a>` : ''}
            ${socials.telegram ? `<a class="f-social" href="https://t.me/${socials.telegram}" target="_blank" rel="noopener" aria-label="تلگرام">${ic('telegram', 17)}</a>` : ''}
            ${socials.whatsapp ? `<a class="f-social" href="https://wa.me/${socials.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener" aria-label="واتساپ">${ic('whatsapp', 17)}</a>` : ''}
          </div>
        </div>
      </div>
      <div class="f-bottom">
        <span>© ۱۴۰۵ پت‌شاپ — تمامی حقوق محفوظ است.</span>
        <a class="f-made" href="https://zenoxweb.ir" target="_blank" rel="noopener" title="zenoxweb.ir">ساخته شده با ${ic('heart', 12)} برای دوست‌های کوچک شما</a>
      </div>
    </div>
  </div>`;
}

// ---------- شمارنده سبد + انیمیشن ----------
let prevCount = 0;
export function updateCartBadges() {
  const count = Cart.count();
  document.querySelectorAll('[data-cart-count]').forEach(b => {
    b.textContent = faNum(count);
    b.style.display = count ? 'flex' : 'none';
  });
  // انیمیشن bounce روی FAB ناوبری پایین هنگام اضافه شدن آیتم
  if (count > prevCount && window.innerWidth <= 900) {
    const fab = document.querySelector('.bn-fab');
    if (fab) {
      fab.classList.remove('bounce');
      void fab.offsetWidth; // force reflow
      fab.classList.add('bounce');
      fab.addEventListener('animationend', () => fab.classList.remove('bounce'), { once: true });
    }
  }
  prevCount = count;
}

// ---------- Scroll-based hide/show ناوبری پایین ----------
let lastScrollY = 0;
let scrollTimer = null;
let bnHidden = false;
function setupBottomNavScroll() {
  if (window.innerWidth > 900) return;
  const bn = document.getElementById('bottom-nav');
  if (!bn) return;
  const show = () => {
    if (!bnHidden) return;
    bnHidden = false;
    bn.style.transform = 'translateY(0)';
    bn.style.opacity = '1';
  };
  const hide = () => {
    if (bnHidden) return;
    bnHidden = true;
    bn.style.transform = 'translateY(calc(100% + 20px)) scale(.92)';
    bn.style.opacity = '0';
  };
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const diff = y - lastScrollY;
    if (diff > 25) {
      hide();
    } else if (diff < -12) {
      show();
    }
    lastScrollY = y;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(show, 2500);
  }, { passive: true });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBottomNavScroll);
} else {
  setupBottomNavScroll();
}

// ---------- واگذاری رویدادهای سراسری کارت محصول ----------
export function bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      const id = Number(addBtn.dataset.add);
      const card = addBtn.closest('.p-card');
      const slug = card?.dataset.slug;
      if (slug) {
        fetch('/api/products/' + slug).then(r => r.json()).then(({ product }) => {
          if (product) { Cart.add(product, 1); updateCartBadges(); toast('به سبد خرید اضافه شد'); }
        });
      }
      return;
    }
    const wish = e.target.closest('[data-wish]');
    if (wish) {
      if (!Session.isLoggedIn) { toast('برای علاقه‌مندی ابتدا وارد شوید', 'info'); location.hash = '#/auth'; return; }
      Session.toggleWish(Number(wish.dataset.wish));
      wish.classList.toggle('active');
      const ws = wish.querySelector('span');
      if (ws) ws.classList.toggle('heart-fill', Session.isWished(Number(wish.dataset.wish)));
      return;
    }
    const heart = e.target.closest('[data-wish-page]');
    if (heart) {
      if (!Session.isLoggedIn) { location.hash = '#/auth'; return; }
      const id = Number(heart.dataset.wishPage);
      Session.toggleWish(id);
      heart.classList.toggle('active');
      const hf = heart.querySelector('.heart-fill, .pd-wish-ic');
      if (hf) hf.classList.toggle('heart-fill', Session.isWished(id));
      const hl = heart.querySelector('.pd-wish-label');
      if (hl) hl.textContent = Session.isWished(id) ? 'در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها';
    }
  });
}

// ---------- آواتار ----------
export function initials(name) {
  const parts = String(name || '؟').trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}
