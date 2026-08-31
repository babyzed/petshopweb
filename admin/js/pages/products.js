// admin/pages/products.js — مدیریت کامل محصولات
import { AdminAPI, price, faNum, uploadImage } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';
import { ic } from '../icons.js';

let listState = { page: 1, q: '', category: '', status: 'all' };

export async function render() {
  const q = new URLSearchParams({ page: listState.page, q: listState.q, category: listState.category, status: listState.status });
  const d = await AdminAPI.get('/admin/products?' + q);
  const cats = (await AdminAPI.get('/admin/categories')).flat;
  const brands = (await AdminAPI.get('/admin/brands')).brands;

  const catName = (id) => cats.find(c => c.id === id)?.name || '—';
  const brandName = (id) => brands.find(b => b.id === id)?.name || '—';

  return `
  <div class="toolbar">
    <input class="search-inp" placeholder="جستجو در نام یا کد محصول..." value="${listState.q}" data-search>
    <select data-cat-filter style="padding:10px 14px;border:1.5px solid #E7E0D8;border-radius:12px;font-size:13px;background:#fff">
      <option value="">همه دسته‌ها</option>
      ${cats.map(c => `<option value="${c.id}" ${listState.category == c.id ? 'selected' : ''}>${'—'.repeat(c.parent_id ? 1 : 0)} ${c.name}</option>`).join('')}
    </select>
    <select data-status-filter style="padding:10px 14px;border:1.5px solid #E7E0D8;border-radius:12px;font-size:13px;background:#fff">
      <option value="all" ${listState.status === 'all' ? 'selected' : ''}>همه وضعیت‌ها</option>
      <option value="active" ${listState.status === 'active' ? 'selected' : ''}>فعال</option>
      <option value="inactive" ${listState.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
      <option value="draft" ${listState.status === 'draft' ? 'selected' : ''}>پیش‌نویس</option>
    </select>
    <a class="btn btn-primary" href="#/products/new" style="padding:10px 22px;font-size:13px">${ic('plus', 16)} محصول جدید</a>
  </div>

  <table class="data-table">
    <thead><tr>
      <th>محصول</th><th>دسته</th><th>برند</th><th>قیمت</th><th>تخفیف‌خورده</th><th>موجودی</th><th>ویژه</th><th>وضعیت</th><th>عملیات</th>
    </tr></thead>
    <tbody>
      ${d.products.map(p => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              ${p.image ? `<img class="t-img" src="${p.image}" alt="">` : `<span style="font-size:22px;color:var(--brand)">${ic('package', 26)}</span>`}
              <div>
                <div class="t-name" style="max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</div>
                <div class="t-sub" dir="ltr">${p.sku || p.slug}</div>
              </div>
            </div>
          </td>
          <td>${catName(p.category_id)}</td>
          <td>${brandName(p.brand_id)}</td>
          <td>${price(p.price)}</td>
          <td>${p.sale_price ? price(p.sale_price) : '—'}</td>
          <td><span class="s-badge ${p.stock === 0 ? 's-cancelled' : p.stock <= 10 ? 's-pending' : 's-approved'}">${faNum(p.stock)}</span></td>
          <td>${p.is_special ? ic('sparkles', 16) : '—'}</td>
          <td>${p.status === 'active' ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-ghost" href="#/products/${p.id}" style="padding:7px 12px;font-size:11.5px">${ic('edit', 14)} ویرایش</a>
            <button class="btn btn-ghost" data-del="${p.id}" data-name="${p.name}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">${ic('trash', 14)} حذف</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>

  <div class="page-nav">
    <button class="btn btn-ghost" data-page="${d.page - 1}" ${d.page <= 1 ? 'disabled' : ''}>قبلی</button>
    <span style="font-size:12.5px;font-weight:700">صفحه ${faNum(d.page)} از ${faNum(d.pages)}</span>
    <button class="btn btn-ghost" data-page="${d.page + 1}" ${d.page >= d.pages ? 'disabled' : ''}>بعدی</button>
  </div>`;
}

export function after() {
  const search = document.querySelector('[data-search]');
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { listState.q = search.value; listState.page = 1; location.hash = '#/products'; setTimeout(() => location.reload(), 50); }, 500);
  });
  document.querySelector('[data-cat-filter]').addEventListener('change', (e) => { listState.category = e.target.value; listState.page = 1; location.reload(); });
  document.querySelector('[data-status-filter]').addEventListener('change', (e) => { listState.status = e.target.value; listState.page = 1; location.reload(); });
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { listState.page = Number(b.dataset.page); location.reload(); }));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف محصول', `«${b.dataset.name}» حذف شود؟ این عملیات برگشت‌پذیر نیست.`, async () => {
      try { await AdminAPI.del('/admin/products/' + b.dataset.del); toast('محصول حذف شد'); setTimeout(() => location.reload(), 400); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

// ============================================================
// فرم افزودن / ویرایش محصول
// ============================================================
export async function formRender(params) {
  const id = params;
  const cats = (await AdminAPI.get('/admin/categories')).flat;
  const brands = (await AdminAPI.get('/admin/brands')).brands;
  let p = { features: {}, images: [], status: 'active', is_special: 0, price: '', sale_price: '', stock: 0 };
  if (id) p = (await AdminAPI.get('/admin/products/' + id)).product;

  const featRows = Object.entries(p.features || {}).map(([k, v]) =>
    `<div class="feat-row"><input placeholder="نام ویژگی (مثلاً: وزن)" value="${k}" data-fk><input placeholder="مقدار (مثلاً: ۲ کیلوگرم)" value="${v}" data-fv><button class="btn btn-ghost" data-feat-del style="color:var(--danger)">${ic('x', 14)}</button></div>`).join('');

  return `
  <div class="a-card">
    <h3>${ic('package', 18)} ${id ? 'ویرایش محصول' : 'افزودن محصول جدید'}</h3>
    <div class="form-grid">
      <div class="field full"><label>نام محصول *</label><input data-f-name value="${p.name || ''}" placeholder="مثلاً: غذای خشک گربه بالغ"></div>
      <div class="field"><label>SKU</label><input data-f-sku value="${p.sku || ''}" placeholder="مثلاً: CF-1001" dir="ltr"></div>
      <div class="field"><label>اسلاگ (خالی = خودکار)</label><input data-f-slug value="${p.slug || ''}" dir="ltr"></div>
      <div class="field"><label>دسته‌بندی</label>
        <select data-f-cat>
          <option value="">بدون دسته</option>
          ${cats.map(c => `<option value="${c.id}" ${p.category_id == c.id ? 'selected' : ''}>${'—'.repeat(c.parent_id ? 1 : 0)} ${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>برند</label>
        <select data-f-brand>
          <option value="">بدون برند</option>
          ${brands.map(b => `<option value="${b.id}" ${p.brand_id == b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>قیمت (تومان) *</label><input type="number" min="0" data-f-price value="${p.price || ''}"></div>
      <div class="field"><label>قیمت تخفیف‌خورده (تومان)</label><input type="number" min="0" data-f-sale value="${p.sale_price || ''}"></div>
      <div class="field"><label>موجودی</label><input type="number" min="0" data-f-stock value="${p.stock || 0}"></div>
      <div class="field"><label>وزن / حجم</label><input data-f-weight value="${p.weight || ''}" placeholder="مثلاً: ۲ کیلوگرم"></div>
      <div class="field"><label>وضعیت</label>
        <select data-f-status>
          <option value="active" ${p.status === 'active' ? 'selected' : ''}>فعال</option>
          <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>غیرفعال</option>
          <option value="draft" ${p.status === 'draft' ? 'selected' : ''}>پیش‌نویس</option>
        </select>
      </div>
      <div class="field"><label>محصول ویژه (نمایش در بخش پیشنهاد پت‌شاپ)</label>
        <div class="toggle-row"><button class="toggle ${p.is_special ? 'on' : ''}" data-f-special></button><span style="font-size:12px;color:var(--muted)">${ic('sparkles', 14)} نمایش در صفحه اصلی</span></div>
      </div>
      <div class="field full"><label>توضیحات کامل</label><textarea data-f-desc rows="4">${p.description || ''}</textarea></div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('image', 18)} تصاویر محصول</h3>
    <div class="img-uploader" data-img-uploader>
      ${(p.images || []).map(im => `
        <div class="iu-item"><img src="${im.image}" alt=""><button class="iu-del" data-img-del="${im.id}">✕</button></div>`).join('')}
      <label class="iu-item iu-add" data-img-add>+<input type="file" accept="image/*"></label>
    </div>
    <p class="hint" style="margin-top:8px">اولین تصویر، تصویر اصلی محصول است.</p>
  </div>

  <div class="a-card">
    <h3>${ic('list', 18)} ویژگی‌ها (برای فیلتر محصولات)</h3>
    <div data-feat-list>${featRows || ''}</div>
    <button class="btn btn-ghost" data-feat-add style="margin-top:8px">${ic('plus', 14)} افزودن ویژگی</button>
  </div>

  <div style="display:flex;gap:10px">
    <button class="btn btn-primary btn-lg" data-save style="flex:1">${ic('settings', 16)} ${id ? 'ذخیره تغییرات' : 'ثبت محصول'}</button>
    <a class="btn btn-ghost btn-lg" href="#/products">انصراف</a>
  </div>`;
}

export function formAfter(params) {
  const id = params;
  const state = { images: [], features: {} };
  document.querySelectorAll('[data-fk]').forEach(el => {
    state.features[el.value] = el.closest('.feat-row').querySelector('[data-fv]').value;
  });

  // ویژگی‌ها
  document.querySelector('[data-feat-add]').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'feat-row';
    row.innerHTML = `<input placeholder="نام ویژگی" data-fk><input placeholder="مقدار" data-fv><button class="btn btn-ghost" data-feat-del style="color:var(--danger)">${ic('x', 14)}</button>`;
    document.querySelector('[data-feat-list]').appendChild(row);
    row.querySelector('[data-feat-del]').addEventListener('click', () => row.remove());
  });
  document.querySelectorAll('[data-feat-del]').forEach(b => b.addEventListener('click', () => b.closest('.feat-row').remove()));

  // آپلود تصویر
  const addBtn = document.querySelector('[data-img-add]');
  addBtn.querySelector('input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      const item = document.createElement('div');
      item.className = 'iu-item';
      item.innerHTML = `<img src="${url}" alt=""><button class="iu-del" data-img-del-uploaded>✕</button>`;
      addBtn.before(item);
      item.querySelector('[data-img-del-uploaded]').addEventListener('click', () => item.remove());
      toast('تصویر آپلود شد');
    } catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  });
  document.querySelectorAll('[data-img-del]').forEach(b => b.addEventListener('click', async () => {
    try { await AdminAPI.del(`/admin/products/${id}/images/${b.dataset.imgDel}`); b.closest('.iu-item').remove(); toast('تصویر حذف شد'); }
    catch (err) { toast(err.message, 'err'); }
  }));

  // ذخیره
  document.querySelector('[data-save]').addEventListener('click', async (btn) => {
    const features = {};
    document.querySelectorAll('[data-fk]').forEach(el => {
      const v = el.closest('.feat-row').querySelector('[data-fv]').value;
      if (el.value.trim()) features[el.value.trim()] = v.trim();
    });
    const body = {
      name: document.querySelector('[data-f-name]').value.trim(),
      slug: document.querySelector('[data-f-slug]').value.trim(),
      sku: document.querySelector('[data-f-sku]').value.trim(),
      category_id: document.querySelector('[data-f-cat]').value || null,
      brand_id: document.querySelector('[data-f-brand]').value || null,
      price: document.querySelector('[data-f-price]').value,
      sale_price: document.querySelector('[data-f-sale]').value,
      stock: document.querySelector('[data-f-stock]').value,
      weight: document.querySelector('[data-f-weight]').value.trim(),
      status: document.querySelector('[data-f-status]').value,
      is_special: document.querySelector('[data-f-special]').classList.contains('on') ? 1 : 0,
      description: document.querySelector('[data-f-desc]').value.trim(),
      features,
    };
    if (!body.name) { toast('نام محصول الزامی است', 'err'); return; }
    if (!body.price || body.price <= 0) { toast('قیمت معتبر وارد کنید', 'err'); return; }
    const newImages = [...document.querySelectorAll('.iu-item img')]
      .map(img => img.src)
      .filter(src => !src.includes('/admin/'))
      .map(src => new URL(src, location.origin).pathname);
    body.images = newImages;

    btn.disabled = true;
    btn.textContent = '⏳ در حال ذخیره...';
    try {
      if (id) { await AdminAPI.put('/admin/products/' + id, body); toast('محصول ذخیره شد ✅'); }
      else { await AdminAPI.post('/admin/products', body); toast('محصول ایجاد شد ✅'); }
      location.hash = '#/products';
      setTimeout(() => location.reload(), 300);
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = '💾 ذخیره'; }
  });

  document.querySelector('[data-f-special]').addEventListener('click', function () { this.classList.toggle('on'); });
}
