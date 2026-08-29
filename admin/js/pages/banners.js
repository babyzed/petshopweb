// admin/pages/banners.js — مدیریت بنرها
import { AdminAPI, uploadImage } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';

export async function render() {
  const { banners } = await AdminAPI.get('/admin/banners');
  const hero = banners.filter(b => b.position === 'hero');
  const promo = banners.filter(b => b.position === 'promo');
  const card = (b) => `
    <div class="dash-card">
      <div style="display:flex;gap:14px;align-items:center">
        ${b.image ? `<img src="${b.image}" style="width:130px;height:80px;border-radius:12px;object-fit:cover" alt="">` : '<div style="width:130px;height:80px;border-radius:12px;background:#FAF7F4;display:flex;align-items:center;justify-content:center;font-size:28px">🖼️</div>'}
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:13.5px">${b.title}</div>
          <div class="t-sub">${b.subtitle || ''}</div>
          <div style="margin-top:6px">${b.is_active ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'} <span class="s-badge s-paid" style="background:#F5F3FF;color:#6D28D9">ترتیب: ${b.sort_order}</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-ghost" data-edit='${JSON.stringify(b)}' style="padding:7px 14px;font-size:11.5px">ویرایش</button>
          <button class="btn btn-ghost" data-del="${b.id}" style="padding:7px 14px;font-size:11.5px;color:var(--danger)">حذف</button>
        </div>
      </div>
    </div>`;

  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800">🖼️ مدیریت بنرها</h3>
    <button class="btn btn-primary" data-new style="padding:10px 22px;font-size:13px">+ بنر جدید</button>
  </div>
  <div class="dash-card" style="background:#FFF7ED;border-color:#FED7AA">
    <h3>🏠 اسلایدر Hero صفحه اصلی (${hero.length})</h3>
    <p class="hint">تصاویر پیشنهادی: نسبت مربع (۱۰۲۴×۱۰۲۴) با فضای خالی سمت راست برای متن</p>
  </div>
  ${hero.map(card).join('')}
  <div class="dash-card" style="background:#F0FDF4;border-color:#BBF7D0">
    <h3>🎯 بنرهای تبلیغاتی (${promo.length})</h3>
    <p class="hint">تصاویر پیشنهادی: عریض (۱۶۰۰×۶۰۰) با فضای متن سمت راست</p>
  </div>
  ${promo.map(card).join('')}`;
}

export function after() {
  document.querySelector('[data-new]').addEventListener('click', () => openForm(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف بنر', 'این بنر حذف شود؟', async () => {
      try { await AdminAPI.del('/admin/banners/' + b.dataset.del); toast('حذف شد'); setTimeout(() => location.reload(), 350); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

function openForm(b) {
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px">${b ? '✏️ ویرایش بنر' : '➕ بنر جدید'}</h3>
    <div class="form-grid">
      <div class="field full"><label>عنوان بنر *</label><input data-title value="${b?.title || ''}"></div>
      <div class="field full"><label>زیرعنوان</label><input data-subtitle value="${b?.subtitle || ''}"></div>
      <div class="field"><label>موقعیت</label>
        <select data-position>
          <option value="hero" ${b?.position === 'hero' ? 'selected' : ''}>اسلایدر Hero</option>
          <option value="promo" ${b?.position === 'promo' ? 'selected' : ''}>بنر تبلیغاتی</option>
        </select>
      </div>
      <div class="field"><label>ترتیب نمایش</label><input type="number" data-sort value="${b?.sort_order || 0}"></div>
      <div class="field full"><label>لینک (مثلاً /#/shop)</label><input data-link value="${b?.link || ''}" dir="ltr"></div>
      <div class="field full"><label>تصویر</label>
        <div class="img-uploader">
          <div class="iu-item" style="width:150px;height:90px">${b?.image ? `<img src="${b.image}" alt="">` : '<span style="color:var(--muted);font-size:11px">تصویری انتخاب نشده</span>'}</div>
          <label class="iu-item iu-add" data-img>+<input type="file" accept="image/*"></label>
        </div>
      </div>
      <div class="field full"><label>وضعیت</label><button class="toggle ${b?.is_active === false ? '' : 'on'}" data-active></button></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true, wide: true });

  let image = b?.image || '';
  const imgWrap = body.querySelector('[data-img]');
  imgWrap.querySelector('input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      image = await uploadImage(file);
      const img = body.querySelector('.iu-item img');
      if (img) img.src = image;
      else { const holder = document.createElement('img'); holder.src = image; holder.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:14px'; imgWrap.before(holder); }
      toast('تصویر آپلود شد');
    } catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  });
  body.querySelector('[data-active]').addEventListener('click', function () { this.classList.toggle('on'); });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      title: body.querySelector('[data-title]').value.trim(),
      subtitle: body.querySelector('[data-subtitle]').value.trim(),
      position: body.querySelector('[data-position]').value,
      sort_order: Number(body.querySelector('[data-sort]').value) || 0,
      link: body.querySelector('[data-link]').value.trim(),
      image,
      is_active: body.querySelector('[data-active]').classList.contains('on'),
    };
    if (!payload.title) { toast('عنوان الزامی است', 'err'); return; }
    try {
      if (b) await AdminAPI.put('/admin/banners/' + b.id, payload);
      else await AdminAPI.post('/admin/banners', payload);
      toast('ذخیره شد ✅');
      close();
      setTimeout(() => location.reload(), 350);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}
