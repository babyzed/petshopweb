// pages/shop.js — فروشگاه با فیلتر، مرتب‌سازی و صفحه‌بندی
import { API, price, faNum, currentPrice } from '../api.js';
import { productCard, productCardH } from '../components.js';
import { ic, catIcon } from '../icons.js';
import { setMeta } from '../meta.js';

let state = { page: 1, perPage: 12, total: 0, pages: 1 };
let lastQuery = null;

export function title(params, query) {
  return query.get('category') ? 'فروشگاه' : 'فروشگاه پت‌شاپ';
}

export async function render(params, query) {
  lastQuery = query;
  const page = Number(query.get('page')) || 1;
  state.page = page;

  const [catsRes, brandsRes] = await Promise.all([
    API.get('/categories').catch(() => ({ categories: [] })),
    API.get('/brands').catch(() => ({ brands: [] })),
  ]);
  const cats = catsRes.categories;
  const brands = brandsRes.brands;
  const activeCat = query.get('category') || '';

  const qs = new URLSearchParams(query);
  qs.set('page', page);
  qs.set('per_page', state.perPage);

  const data = await API.get('/products?' + qs.toString());
  state.total = data.total;
  state.pages = Math.max(1, data.pages);

  const isMobile = window.innerWidth <= 900;
  const card = (p) => isMobile ? productCardH(p) : productCard(p);

  const selected = [];
  const catPath = (list, slug) => { for (const c of list) { if (c.slug === slug) return c; const r = catPath(c.children || [], slug); if (r) return r; } return null; };
  const activeCatObj = catPath(cats, activeCat);

  // SEO — متاتگ‌های صفحه فروشگاه / دسته‌بندی
  setMeta({
    title: activeCatObj ? activeCatObj.name : 'فروشگاه پت‌شاپ',
    description: activeCatObj
      ? `خرید اینترنتی محصولات دسته «${activeCatObj.name}» با ضمانت اصالت و ارسال سریع.`
      : 'فروشگاه اینترنتی محصولات حیوانات خانگی؛ غذای سگ و گربه، اسباب‌بازی، لوازم بهداشتی و مکمل‌ها.',
    path: activeCatObj ? '#/category/' + activeCatObj.slug : '#/shop',
  });

  const catListHtml = (list, depth = 0) => list.map(c => `
    <button class="sf-cat ${c.slug === activeCat ? 'active' : ''} ${depth ? 'sub' : ''}" data-cat="${c.slug}">
      ${catIcon(c, 13)} ${c.name} <span style="opacity:.6;font-size:11px">${faNum(c.count)}</span>
    </button>
    ${c.children?.length ? catListHtml(c.children, depth + 1) : ''}`).join('');

  return `
  <div class="container">
    <nav class="breadcrumb">
      <a href="#/">خانه</a><span class="sep">/</span>
      <span>فروشگاه</span>
      ${activeCatObj ? `<span class="sep">/</span><span style="color:var(--text);font-weight:600">${activeCatObj.name}</span>` : ''}
    </nav>

    <div class="page-hero">
      <div>
        <h1>${activeCatObj ? catIcon(activeCatObj, 20) + ' ' + activeCatObj.name : 'فروشگاه پت‌شاپ'}</h1>
        <p>${activeCatObj ? `${faNum(activeCatObj.count)} محصول در این دسته` : `همه محصولات برای سگ، گربه و سایر حیوانات خانگی (${faNum(state.total)} محصول)`}</p>
      </div>
      <div class="ph-ic">${ic('paw', 42)}</div>
    </div>

    <div class="shop-layout" style="margin-top:22px">
      <aside class="shop-filters" aria-label="فیلترها">
        <div class="sf-group">
          <div class="sf-title">${ic('grid', 15)} دسته‌بندی</div>
          <button class="sf-cat ${!activeCat ? 'active' : ''}" data-cat="">همه دسته‌ها</button>
          ${catListHtml(cats)}
        </div>
        <div class="sf-group">
          <div class="sf-title">${ic('tag', 15)} برند</div>
          ${brands.map(b => `
            <label class="sf-check">
              <input type="checkbox" data-brand="${b.id}" ${query.get('brand') == b.id ? 'checked' : ''}> ${b.name}
            </label>`).join('')}
        </div>
        <div class="sf-group">
          <div class="sf-title">${ic('cash', 15)} محدوده قیمت (تومان)</div>
          <div class="sf-range">
            <input type="number" placeholder="از" min="0" value="${query.get('min_price') || ''}" data-min-price>
            <input type="number" placeholder="تا" min="0" value="${query.get('max_price') || ''}" data-max-price>
          </div>
        </div>
        <div class="sf-group">
          <div class="sf-title">${ic('sliders', 15)} وضعیت</div>
          <label class="sf-check"><input type="checkbox" data-stock ${query.get('in_stock') === '1' ? 'checked' : ''}> فقط موجود</label>
          <label class="sf-check"><input type="checkbox" data-sale ${query.get('on_sale') === '1' ? 'checked' : ''}> فقط تخفیف‌دار</label>
        </div>
        ${data.featureOptions?.length ? `
        <div class="sf-group">
          <div class="sf-title">${ic('search', 15)} ویژگی‌های محصول</div>
          ${[...new Map(data.featureOptions.map(f => [f.k, f])).values()].map(f => `
            <label class="sf-check"><input type="checkbox" data-feature="${f.k}" ${query.get('feature') === f.k ? 'checked' : ''}> ${f.k}: ${f.v}</label>`).join('')}
        </div>` : ''}
        <button class="btn btn-primary btn-block sf-apply" data-apply>اعمال فیلترها</button>
        <button class="btn btn-ghost btn-block sf-reset" data-reset>حذف فیلترها</button>
      </aside>

      <div>
        <div class="shop-toolbar">
          <span class="shop-count"><b>${faNum(state.total)}</b> محصول یافت شد</span>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-ghost mobile-filter-btn" data-open-filters>${ic('sliders', 15)} فیلترها</button>
            <select class="sort-select" data-sort>
              <option value="newest" ${(query.get('sort') || 'newest') === 'newest' ? 'selected' : ''}>جدیدترین</option>
              <option value="best" ${query.get('sort') === 'best' ? 'selected' : ''}>پرفروش‌ترین</option>
              <option value="price_asc" ${query.get('sort') === 'price_asc' ? 'selected' : ''}>ارزان‌ترین</option>
              <option value="price_desc" ${query.get('sort') === 'price_desc' ? 'selected' : ''}>گران‌ترین</option>
              <option value="discount" ${query.get('sort') === 'discount' ? 'selected' : ''}>بیشترین تخفیف</option>
              <option value="popular" ${query.get('sort') === 'popular' ? 'selected' : ''}>محبوب‌ترین</option>
            </select>
          </div>
        </div>

        ${data.products.length ? `<div class="p-grid ${isMobile ? 'plist' : ''}">${data.products.map(card).join('')}</div>` : `
          <div class="empty-state" style="background:var(--card);border:1px solid var(--line);border-radius:22px">
            <div class="es-ic">${ic('search', 32)}</div>
            <h3>محصولی پیدا نشد</h3>
            <p>فیلترها را تغییر دهید یا دسته دیگری را امتحان کنید.</p>
          </div>`}

        ${state.pages > 1 ? `
        <nav class="pagination" aria-label="صفحه‌بندی">
          <button class="page-btn" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>→</button>
          ${Array.from({ length: Math.min(state.pages, 7) }, (_, i) => {
            let p = i + 1;
            if (state.pages > 7) {
              if (state.page > 4 && i < 3) p = state.page - 3 + i;
              else if (state.page > 4 && i > 3) p = state.pages - (6 - i);
            }
            return `<button class="page-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${faNum(p)}</button>`;
          }).join('')}
          <button class="page-btn" data-page="${state.page + 1}" ${state.page >= state.pages ? 'disabled' : ''}>←</button>
        </nav>` : ''}
      </div>
    </div>

    <div class="filter-sheet" data-filter-sheet>
      <div class="fs-backdrop" data-close-sheet></div>
      <div class="fs-panel">
        <div class="fs-grip"></div>
        <div class="fs-head"><h3>${ic('sliders', 16)} فیلترها</h3><button class="btn btn-ghost" data-close-sheet>بستن</button></div>
        ${catListHtml(cats)}
        <hr style="border:none;border-top:1px solid var(--line);margin:12px 0">
        ${brands.map(b => `<label class="sf-check"><input type="checkbox" data-brand="${b.id}" ${query.get('brand') == b.id ? 'checked' : ''}> ${b.name}</label>`).join('')}
        <div class="sf-range" style="margin:12px 0">
          <input type="number" placeholder="قیمت از" value="${query.get('min_price') || ''}" data-min-price>
          <input type="number" placeholder="قیمت تا" value="${query.get('max_price') || ''}" data-max-price>
        </div>
        <label class="sf-check"><input type="checkbox" data-stock ${query.get('in_stock') === '1' ? 'checked' : ''}> فقط موجود</label>
        <label class="sf-check"><input type="checkbox" data-sale ${query.get('on_sale') === '1' ? 'checked' : ''}> فقط تخفیف‌دار</label>
        <button class="btn btn-primary btn-block" style="margin-top:14px" data-apply>اعمال فیلترها</button>
      </div>
    </div>
  </div>`;
}

export function mount(el, params, query) {
  const sheet = el.querySelector('[data-filter-sheet]');
  const openSheet = () => sheet.classList.add('open');
  const closeSheet = () => sheet.classList.remove('open');
  el.querySelector('[data-open-filters]')?.addEventListener('click', openSheet);
  el.querySelectorAll('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheet));

  const buildQs = () => {
    const q = new URLSearchParams();
    const cat = el.querySelector('.sf-cat.active')?.dataset.cat || lastQuery.get('category') || '';
    if (cat) q.set('category', cat);
    el.querySelectorAll('[data-brand]:checked').forEach(b => q.set('brand', b.dataset.brand));
    const min = el.querySelector('[data-min-price]').value.trim();
    const max = el.querySelector('[data-max-price]').value.trim();
    if (min) q.set('min_price', min);
    if (max) q.set('max_price', max);
    if (el.querySelector('[data-stock]')?.checked) q.set('in_stock', '1');
    if (el.querySelector('[data-sale]')?.checked) q.set('on_sale', '1');
    const feat = el.querySelector('[data-feature]:checked')?.dataset.feature;
    if (feat) q.set('feature', feat);
    const sort = el.querySelector('[data-sort]')?.value || lastQuery.get('sort') || 'newest';
    q.set('sort', sort);
    return q.toString();
  };

  el.querySelector('[data-apply]')?.addEventListener('click', () => { location.hash = '#/shop?' + buildQs(); });
  el.querySelector('[data-reset]')?.addEventListener('click', () => { location.hash = '#/shop'; });
  el.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
    const q = new URLSearchParams(buildQs());
    if (b.dataset.cat) q.set('category', b.dataset.cat); else q.delete('category');
    location.hash = '#/shop?' + q.toString();
  }));
  const sortSel = el.querySelector('[data-sort]');
  if (sortSel) sortSel.addEventListener('change', () => {
    const q = new URLSearchParams(buildQs());
    q.set('sort', sortSel.value);
    location.hash = '#/shop?' + q.toString();
  });
  el.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
    const q = new URLSearchParams(buildQs());
    q.set('page', b.dataset.page);
    location.hash = '#/shop?' + q.toString();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
}
