// pages/product.js — جزئیات محصول: گالری، ویژگی‌ها، نظرات، مرتبط‌ها
import { API, price, faNum, currentPrice, discountPct, dateFa } from '../api.js';
import { Cart, Session } from '../store.js';
import { productCard, productCardH, stars, toast, initials } from '../components.js';
import { ic } from '../icons.js';

let slug = null;

export function title(params) {
  return 'محصول | پت‌شاپ';
}

export async function render(params) {
  slug = params.slug;
  const { product } = await API.get('/products/' + params.slug);
  const off = discountPct(product);
  const inStock = product.stock > 0;
  const isMobile = window.innerWidth <= 900;
  const wished = Session.isWished(product.id);
  const features = Object.entries(product.features || {});
  const mainImage = product.images?.[0]?.image || product.image || '/assets/img/placeholder.jpg';

  const relatedHtml = product.related?.length ? `
    <section class="section">
      <div class="section-head">
        <h2 class="section-title"><span class="st-ic">${ic('link', 22)}</span>محصولات مرتبط</h2>
      </div>
      <div class="p-grid ${isMobile ? 'rail' : ''}">${product.related.map(p => isMobile ? productCardH(p) : productCard(p)).join('')}</div>
    </section>` : '';

  const reviewForm = Session.isLoggedIn ? `
    <div class="rev-form">
      <h4>${ic('pen', 16)} ثبت نظر شما</h4>
      <form data-review-form>
        <div class="rating-input" data-rating-input>
          ${[1,2,3,4,5].map(i => `<button type="button" data-rate="${i}">${ic('star', 22)}</button>`).join('')}
        </div>
        <div class="form-grid">
          <div class="field"><label>عنوان نظر</label><input type="text" name="title" placeholder="مثلاً: کیفیت عالی" maxlength="60"></div>
          <div class="field"><label>متن نظر *</label><textarea name="comment" rows="3" required minlength="5" placeholder="تجربه خود را بنویسید..."></textarea></div>
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:12px">ثبت نظر</button>
      </form>
    </div>` : `<p style="font-size:13px;color:var(--muted);margin-top:14px">برای ثبت نظر، ابتدا <a href="#/auth" style="color:var(--brand-dark);font-weight:700">وارد حساب</a> شوید.</p>`;

  return `
  <div class="container pd-page">
    <nav class="breadcrumb">
      <a href="#/">خانه</a><span class="sep">/</span>
      <a href="#/shop">فروشگاه</a>
      <span class="sep">/</span>
      <a href="#/category/${product.category_slug || ''}">${product.category_name || ''}</a>
      <span class="sep">/</span>
      <span style="color:var(--text);font-weight:600">${product.name}</span>
    </nav>

    <div class="pd-layout">
      <div class="pd-gallery">
        <div class="pd-main-img">
          <img src="${mainImage}" alt="${product.name}" id="pd-main-img">
        </div>
        ${product.images?.length > 1 ? `
        <div class="pd-thumbs">
          ${product.images.map((im, i) => `<button class="pd-thumb ${i === 0 ? 'active' : ''}" data-thumb="${im.image}" data-idx="${i}"><img src="${im.image}" alt="" loading="lazy"></button>`).join('')}
        </div>` : ''}
      </div>

      <div class="pd-info">
        <div class="pd-cats">
          <a href="#/shop">فروشگاه</a> ← <a href="#/category/${product.category_slug || ''}">${product.category_name || ''}</a>
          ${product.brand_name ? `← <a href="#/shop?brand=${product.brand_id}">${product.brand_name}</a>` : ''}
        </div>
        <h1 class="pd-title">${product.name}</h1>
        <div class="pd-meta">
          <span>${stars(product.rating)} ${product.rating ? faNum(product.rating) : ''} (${faNum(product.review_count || 0)} نظر)</span>
          <span class="sep"></span>
          <span>کد کالا: <b dir="ltr">${product.sku || '—'}</b></span>
          <span class="sep"></span>
          <span>وزن/حجم: ${product.weight || '—'}</span>
        </div>

        <div class="pd-price-box">
          <div>
            <div class="pd-price-now">${price(currentPrice(product))} <span class="unit">تومان</span></div>
            ${off ? `<div class="pd-price-old">${price(product.price)} تومان</div>` : ''}
          </div>
          ${off ? `<span class="pd-off-badge">٪${faNum(off)} تخفیف</span>` : ''}
          <span class="pd-stock-line ${inStock ? 'in' : 'out'}">${inStock ? `✔ موجود در انبار (${faNum(product.stock)} عدد)` : '✖ ناموجود'}</span>
        </div>

        <p class="pd-desc">${product.description || ''}</p>

        <div class="pd-buy-row">
          ${inStock ? `
          <div class="qty-stepper">
            <button data-qty="-1">−</button>
            <span id="pd-qty">1</span>
            <button data-qty="1">+</button>
          </div>
          <button class="btn btn-primary btn-lg pd-buy-btn" data-add-cart>${ic('cart', 18)} افزودن به سبد</button>
          <button class="btn btn-dark btn-lg" data-buy-now>خرید فوری</button>` : `
          <button class="btn btn-ghost btn-lg pd-buy-btn" disabled>موجود نیست</button>`}
        </div>
        <div class="pd-extra">
          <button class="btn btn-outline pd-wish ${wished ? 'active' : ''}" data-wish-page="${product.id}"><span class="pd-wish-ic ${wished ? 'heart-fill' : ''}">${ic('heart', 17)}</span><span class="pd-wish-label">${wished ? 'در علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}</span></button>
          <button class="btn btn-ghost" data-share>${ic('link', 15)} اشتراک‌گذاری</button>
        </div>
      </div>
    </div>

    ${features.length ? `
    <div class="pd-features">
      <h3>${ic('list', 17)} ویژگی‌های محصول</h3>
      ${features.map(([k, v]) => `<div class="pd-feat-row"><span class="k">${k}</span><span>${v}</span></div>`).join('')}
    </div>` : ''}

    <div class="reviews-section">
      <div class="rev-head">
        <h3>${ic('chat', 17)} نظرات کاربران (${faNum(product.review_count || 0)})</h3>
        <div class="rev-summary"><span class="rev-big">${product.rating ? faNum(product.rating) : '—'}</span>${stars(product.rating)}</div>
      </div>
      ${product.reviews?.length ? product.reviews.map(r => `
        <div class="rev-item">
          <div class="rev-user">
            <span class="rev-avatar">${initials(r.user_name)}</span>
            <div>
              <div class="rev-name">${r.user_name}</div>
              <div class="rev-date">${dateFa(r.created_at)}</div>
            </div>
            <div style="margin-inline-start:auto">${stars(r.rating)}</div>
          </div>
          ${r.title ? `<div class="rev-title">${r.title}</div>` : ''}
          <p class="rev-comment">${r.comment}</p>
        </div>`).join('') : '<p style="color:var(--muted);font-size:13px">هنوز نظری ثبت نشده؛ اولین نفر باشید!</p>'}
      ${reviewForm}
    </div>

    ${relatedHtml}

    <div class="mobile-buybar" data-mobile-buybar>
      <div class="bb-price-box">
        <div class="bb-price">${price(currentPrice(product))} <span class="unit" style="font-size:10px;color:var(--muted)">تومان</span></div>
        ${off ? `<span class="bb-price-old">${price(product.price)}</span>` : ''}
      </div>
      ${inStock ? `
      <div class="qty-stepper bb-qty">
        <button data-qty="-1">−</button>
        <span class="pd-qty">۱</span>
        <button data-qty="1">+</button>
      </div>
      <button class="btn btn-primary" data-add-cart>${ic('cart', 17)} افزودن به سبد</button>` : '<button class="btn btn-ghost" disabled>ناموجود</button>'}
    </div>
  </div>`;
}

export function mount(el) {
  const productId = el.querySelector('[data-wish-page]')?.dataset.wishPage;

  // گالری
  let idx = 0;
  el.querySelectorAll('[data-thumb]').forEach(t => t.addEventListener('click', () => {
    el.querySelector('#pd-main-img').src = t.dataset.thumb;
    el.querySelectorAll('[data-thumb]').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
  }));

  // تعداد
  let qty = 1;
  const qtyEls = el.querySelectorAll('#pd-qty, .pd-qty');
  el.querySelectorAll('[data-qty]').forEach(b => b.addEventListener('click', () => {
    qty = Math.max(1, Math.min(99, qty + Number(b.dataset.qty)));
    qtyEls.forEach(x => x.textContent = faNum(qty));
  }));

  const add = () => {
    fetch('/api/products/' + slug).then(r => r.json()).then(({ product }) => {
      if (product) {
        if (product.stock < qty) { toast('موجودی کافی نیست', 'err'); return; }
        Cart.add(product, qty);
        updateBadges();
        toast('به سبد خرید اضافه شد');
      }
    });
  };
  el.querySelectorAll('[data-add-cart]').forEach(b => b.addEventListener('click', add));
  el.querySelectorAll('[data-buy-now]').forEach(b => b.addEventListener('click', () => {
    fetch('/api/products/' + slug).then(r => r.json()).then(({ product }) => {
      Cart.add(product, qty);
      updateBadges();
      location.hash = '#/checkout';
    });
  }));

  el.querySelector('[data-share]')?.addEventListener('click', async () => {
    try { await navigator.share({ title: document.title, url: location.href }); }
    catch { navigator.clipboard?.writeText(location.href).then(() => toast('لینک کپی شد')); }
  });

  // امتیازدهی
  let rating = 5;
  el.querySelectorAll('[data-rate]').forEach(b => {
    b.classList.add('on');
    b.addEventListener('click', () => {
      rating = Number(b.dataset.rate);
      el.querySelectorAll('[data-rate]').forEach(x => x.classList.toggle('on', Number(x.dataset.rate) <= rating));
    });
  });

  // فرم نظر
  const form = el.querySelector('[data-review-form]');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const comment = form.querySelector('textarea[name="comment"]').value.trim();
      const title = form.querySelector('input[name="title"]').value.trim();
      try {
        await API.post('/products/' + productId + '/review', { rating, title, comment });
        toast('نظر شما ثبت شد و پس از تایید نمایش داده می‌شود');
        form.reset();
      } catch (err) { toast(err.message, 'err'); }
    });
  }
}

function updateBadges() {
  document.querySelectorAll('[data-cart-count]').forEach(b => {
    const c = Cart.count();
    b.textContent = faNum(c);
    b.style.display = c ? 'flex' : 'none';
  });
}
