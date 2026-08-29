// admin/pages/roles.js — نقش‌ها و دسترسی‌ها (Role & Permission)
import { AdminAPI, faNum } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';

export async function render() {
  const { roles, stats, catalog } = await AdminAPI.get('/admin/roles');
  const userCount = (rid) => stats.find(s => s.role_id === rid)?.c || 0;
  const permsOf = (perms) => perms.includes('*') ? 'همه دسترسی‌ها' : (perms.length ? perms.length + ' دسترسی' : 'بدون دسترسی');

  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800">🛡️ نقش‌ها و دسترسی‌ها</h3>
    <button class="btn btn-primary" data-new style="padding:10px 22px;font-size:13px">+ نقش جدید</button>
  </div>
  <div class="dash-card">
    <p class="hint" style="margin-bottom:14px">نقش جدید بسازید و هر ترکیبی از دسترسی‌ها را تعیین کنید. نقش‌های سیستمی قابل ویرایش/حذف نیستند.</p>
    <table class="data-table">
      <thead><tr><th>نقش</th><th>کاربران</th><th>دسترسی‌ها</th><th>نوع</th><th>عملیات</th></tr></thead>
      <tbody>
        ${roles.map(r => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="stat-ic ${r.is_system ? 'o' : 'g'}" style="width:36px;height:36px;font-size:17px">${r.is_system ? '⭐' : '🎭'}</span>
                <div><b style="font-size:13px">${r.title}</b><div class="t-sub" dir="ltr">${r.name}</div></div>
              </div>
            </td>
            <td>${faNum(userCount(r.id))} کاربر</td>
            <td>${permsOf(r.permissions)}</td>
            <td>${r.is_system ? '<span class="s-badge s-paid" style="background:#FFF7ED;color:#9A3412">سیستمی</span>' : '<span class="s-badge s-approved">سفارشی</span>'}</td>
            <td style="white-space:nowrap">
              ${r.is_system ? '<span class="t-sub">غیرقابل ویرایش</span>' : `
                <button class="btn btn-ghost" data-edit='${JSON.stringify(r)}' style="padding:7px 12px;font-size:11.5px">ویرایش دسترسی‌ها</button>
                <button class="btn btn-ghost" data-del="${r.id}" data-name="${r.title}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">حذف</button>`}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="dash-card">
    <h3>📋 کاتالوگ دسترسی‌های موجود</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${catalog.map(p => `<span class="s-badge s-paid" style="background:#F5F3FF;color:#6D28D9;font-size:11px">${p.group}: ${p.label}</span>`).join('')}
    </div>
  </div>`;
}

export function after() {
  document.querySelector('[data-new]').addEventListener('click', async () => openForm(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف نقش', `نقش «${b.dataset.name}» حذف شود؟`, async () => {
      try { await AdminAPI.del('/admin/roles/' + b.dataset.del); toast('نقش حذف شد'); setTimeout(() => location.reload(), 350); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

async function openForm(role) {
  const { roles, catalog } = await AdminAPI.get('/admin/roles');
  const groups = [...new Set(catalog.map(p => p.group))];
  const current = role ? role.permissions : [];
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px">${role ? '✏️ ویرایش نقش ' + role.title : '➕ نقش جدید'}</h3>
    <div class="form-grid">
      <div class="field"><label>نام انگلیسی (کلید) *</label><input data-name value="${role?.name || ''}" dir="ltr" placeholder="editor" ${role ? 'disabled' : ''}></div>
      <div class="field"><label>عنوان فارسی *</label><input data-title value="${role?.title || ''}" placeholder="مثلاً: ویرایشگر محتوا"></div>
    </div>
    <div style="margin-top:14px">
      ${groups.map(g => `
        <div style="margin-bottom:10px">
          <b style="font-size:12px;color:#57534E">${g}</b>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
            ${catalog.filter(p => p.group === g).map(p => `
              <label class="sf-check" style="display:flex;align-items:center;gap:8px;font-size:12.5px">
                <input type="checkbox" data-perm="${p.key}" ${current.includes(p.key) ? 'checked' : ''} style="accent-color:var(--brand);width:16px;height:16px">
                ${p.label}
              </label>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره نقش</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true, wide: true });

  body.querySelector('[data-save]').addEventListener('click', async () => {
    const perms = [...body.querySelectorAll('[data-perm]:checked')].map(x => x.dataset.perm);
    const payload = {
      name: (body.querySelector('[data-name]').value || role?.name || '').trim().toLowerCase(),
      title: body.querySelector('[data-title]').value.trim(),
      permissions: perms,
    };
    if (!payload.name || !payload.title) { toast('نام و عنوان نقش الزامی است', 'err'); return; }
    try {
      if (role) await AdminAPI.put('/admin/roles/' + role.id, payload);
      else await AdminAPI.post('/admin/roles', payload);
      toast('نقش ذخیره شد ✅');
      close();
      setTimeout(() => location.reload(), 350);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}
