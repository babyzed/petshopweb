// admin/pages/categories.js — مدیریت دسته‌بندی‌ها (درختی)
import { AdminAPI, faNum } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';

export async function render() {
  const { categories } = await AdminAPI.get('/admin/categories');

  const treeHtml = (list, depth = 0) => list.map(c => `
    <tr data-depth="${depth}">
      <td>
        <div style="display:flex;align-items:center;gap:8px;padding-inline-start:${depth * 26}px">
          <span style="font-size:20px">${c.icon || '🐾'}</span>
          <b>${c.name}</b>
          ${c.children?.length ? `<span class="s-badge s-active" style="font-size:10px">${faNum(c.children.length)} زیردسته</span>` : ''}
        </div>
      </td>
      <td>${faNum(c.count || 0)} محصول</td>
      <td>${c.image ? '<img class="t-img" src="' + c.image + '" style="width:38px;height:38px">' : '—'}</td>
      <td>${c.is_active ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost" data-edit='${JSON.stringify({ id: c.id, name: c.name, icon: c.icon, parent_id: c.parent_id, sort_order: c.sort_order, is_active: c.is_active })}' style="padding:7px 12px;font-size:11.5px">ویرایش</button>
        <button class="btn btn-ghost" data-del="${c.id}" data-name="${c.name}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">حذف</button>
      </td>
    </tr>
    ${c.children?.length ? treeHtml(c.children, depth + 1) : ''}`).join('');

  const { categories: allCats } = await AdminAPI.get('/admin/categories');

  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800">🗂️ مدیریت دسته‌بندی‌ها</h3>
    <button class="btn btn-primary" data-new style="padding:10px 22px;font-size:13px">+ دسته جدید</button>
  </div>
  <table class="data-table">
    <thead><tr><th>نام دسته</th><th>تعداد محصول</th><th>تصویر</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>${treeHtml(categories)}</tbody>
  </table>`;
}

export function after() {
  document.querySelector('[data-new]').addEventListener('click', () => openForm(null, []));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const c = JSON.parse(b.dataset.edit);
    const cats = [];
    document.querySelectorAll('[data-edit]').forEach(x => {
      const d = JSON.parse(x.dataset.edit);
      if (d.id !== c.id) cats.push(d);
    });
    openForm(c, cats);
  }));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف دسته', `دسته «${b.dataset.name}» حذف شود؟`, async () => {
      try { await AdminAPI.del('/admin/categories/' + b.dataset.del); toast('دسته حذف شد'); setTimeout(() => location.reload(), 400); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

function openForm(cat, cats) {
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px">${cat ? '✏️ ویرایش دسته' : '➕ دسته جدید'}</h3>
    <div class="form-grid">
      <div class="field"><label>نام دسته *</label><input data-name value="${cat?.name || ''}"></div>
      <div class="field"><label>آیکون (ایموجی)</label><input data-icon value="${cat?.icon || '🐾'}" maxlength="4"></div>
      <div class="field"><label>دسته والد</label>
        <select data-parent>
          <option value="">بدون والد (دسته اصلی)</option>
          ${cats.map(c => `<option value="${c.id}" ${cat?.parent_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>ترتیب نمایش</label><input type="number" data-sort value="${cat?.sort_order || 0}"></div>
      <div class="field full"><label>تصویر (آدرس یا خالی)</label><input data-image value="${cat?.image || ''}" placeholder="/assets/img/categories/..."></div>
      <div class="field full"><label>وضعیت</label><button class="toggle ${cat?.is_active === false ? '' : 'on'}" data-active></button></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-active]').addEventListener('click', function () { this.classList.toggle('on'); });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      name: body.querySelector('[data-name]').value.trim(),
      icon: body.querySelector('[data-icon]').value.trim() || '🐾',
      parent_id: body.querySelector('[data-parent]').value || null,
      sort_order: Number(body.querySelector('[data-sort]').value) || 0,
      image: body.querySelector('[data-image]').value.trim(),
      is_active: body.querySelector('[data-active]').classList.contains('on'),
    };
    if (!payload.name) { toast('نام دسته الزامی است', 'err'); return; }
    try {
      if (cat) await AdminAPI.put('/admin/categories/' + cat.id, payload);
      else await AdminAPI.post('/admin/categories', payload);
      toast('ذخیره شد ✅');
      close();
      setTimeout(() => location.reload(), 400);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}
