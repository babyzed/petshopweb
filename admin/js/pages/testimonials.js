// admin/pages/testimonials.js — نظرات مشتریان (صفحه اصلی)
import { AdminAPI, faNum } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';

export async function render() {
  const { testimonials } = await AdminAPI.get('/admin/testimonials');
  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800">💬 نظرات مشتریان (صفحه اصلی)</h3>
    <button class="btn btn-primary" data-new style="padding:10px 22px;font-size:13px">+ نظر جدید</button>
  </div>
  <table class="data-table">
    <thead><tr><th>نام</th><th>نقش</th><th>نظر</th><th>امتیاز</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
      ${testimonials.map(t => `
        <tr>
          <td><b>${t.name}</b></td>
          <td class="t-sub">${t.role || ''}</td>
          <td class="t-sub" style="max-width:320px">${t.text}</td>
          <td>${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</td>
          <td>${t.is_active ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost" data-edit='${JSON.stringify(t)}' style="padding:7px 12px;font-size:11.5px">ویرایش</button>
            <button class="btn btn-ghost" data-del="${t.id}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">حذف</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

export function after() {
  document.querySelector('[data-new]').addEventListener('click', () => openForm(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف نظر', 'این نظر حذف شود؟', async () => {
      try { await AdminAPI.del('/admin/testimonials/' + b.dataset.del); toast('حذف شد'); setTimeout(() => location.reload(), 350); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

function openForm(t) {
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px">${t ? '✏️ ویرایش' : '➕ نظر جدید'}</h3>
    <div class="form-grid">
      <div class="field"><label>نام مشتری *</label><input data-name value="${t?.name || ''}"></div>
      <div class="field"><label>نقش (مثلاً: صاحب گربه)</label><input data-role value="${t?.role || ''}"></div>
      <div class="field full"><label>متن نظر *</label><textarea data-text rows="3">${t?.text || ''}</textarea></div>
      <div class="field"><label>امتیاز (۱ تا ۵)</label><input type="number" min="1" max="5" data-rating value="${t?.rating || 5}"></div>
      <div class="field"><label>وضعیت</label><button class="toggle ${t?.is_active === false ? '' : 'on'}" data-active></button></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-active]').addEventListener('click', function () { this.classList.toggle('on'); });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      name: body.querySelector('[data-name]').value.trim(),
      role: body.querySelector('[data-role]').value.trim(),
      text: body.querySelector('[data-text]').value.trim(),
      rating: Math.min(5, Math.max(1, Number(body.querySelector('[data-rating]').value) || 5)),
      is_active: body.querySelector('[data-active]').classList.contains('on'),
    };
    if (!payload.name || !payload.text) { toast('نام و متن نظر الزامی است', 'err'); return; }
    try {
      if (t) await AdminAPI.put('/admin/testimonials/' + t.id, payload);
      else await AdminAPI.post('/admin/testimonials', payload);
      toast('ذخیره شد ✅');
      close();
      setTimeout(() => location.reload(), 350);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}
