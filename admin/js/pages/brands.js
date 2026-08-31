// admin/pages/brands.js — مدیریت برندها
import { AdminAPI, faNum } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';
import { ic } from '../icons.js';

export async function render() {
  const { brands } = await AdminAPI.get('/admin/brands');
  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px">${ic('tag', 18)} مدیریت برندها</h3>
    <button class="btn btn-primary" data-new style="padding:10px 22px;font-size:13px">${ic('plus', 16)} برند جدید</button>
  </div>
  <table class="data-table">
    <thead><tr><th>برند</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
      ${brands.map(b => `
        <tr>
          <td><b>${b.name}</b> <span class="t-sub" dir="ltr">(${b.slug})</span></td>
          <td>${b.is_active ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost" data-edit='${JSON.stringify(b)}' style="padding:7px 12px;font-size:11.5px">${ic('edit', 14)} ویرایش</button>
            <button class="btn btn-ghost" data-del="${b.id}" data-name="${b.name}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">${ic('trash', 14)} حذف</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

export function after() {
  document.querySelector('[data-new]').addEventListener('click', () => openForm(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف برند', `برند «${b.dataset.name}» حذف شود؟`, async () => {
      try { await AdminAPI.del('/admin/brands/' + b.dataset.del); toast('برند حذف شد'); setTimeout(() => location.reload(), 400); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

function openForm(brand) {
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px">${brand ? ic('edit', 18) + ' ویرایش برند' : ic('plus', 18) + ' برند جدید'}</h3>
    <div class="form-grid">
      <div class="field full"><label>نام برند *</label><input data-name value="${brand?.name || ''}"></div>
      <div class="field full"><label>وضعیت</label><button class="toggle ${brand?.is_active === false ? '' : 'on'}" data-active></button></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-active]').addEventListener('click', function () { this.classList.toggle('on'); });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = { name: body.querySelector('[data-name]').value.trim(), is_active: body.querySelector('[data-active]').classList.contains('on') };
    if (!payload.name) { toast('نام برند الزامی است', 'err'); return; }
    try {
      if (brand) await AdminAPI.put('/admin/brands/' + brand.id, payload);
      else await AdminAPI.post('/admin/brands', payload);
      toast('ذخیره شد ✅');
      close();
      setTimeout(() => location.reload(), 400);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}
