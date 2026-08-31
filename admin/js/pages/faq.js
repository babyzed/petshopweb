// admin/pages/faq.js — سوالات متداول
import { AdminAPI, faNum } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';
import { ic } from '../icons.js';

export async function render() {
  const { faqs } = await AdminAPI.get('/admin/faqs');
  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px">${ic('helpCircle', 18)} سوالات متداول</h3>
    <button class="btn btn-primary" data-new style="padding:10px 22px;font-size:13px">${ic('plus', 16)} پرسش جدید</button>
  </div>
  <table class="data-table">
    <thead><tr><th>#</th><th>پرسش</th><th>پاسخ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
      ${faqs.map((f, i) => `
        <tr>
          <td>${faNum(i + 1)}</td>
          <td><b style="font-size:12.5px">${f.question}</b></td>
          <td class="t-sub" style="max-width:280px">${f.answer}</td>
          <td>${f.is_active ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost" data-edit='${JSON.stringify(f)}' style="padding:7px 12px;font-size:11.5px">${ic('edit', 14)} ویرایش</button>
            <button class="btn btn-ghost" data-del="${f.id}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">${ic('trash', 14)} حذف</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

export function after() {
  document.querySelector('[data-new]').addEventListener('click', () => openForm(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف پرسش', 'این پرسش حذف شود؟', async () => {
      try { await AdminAPI.del('/admin/faqs/' + b.dataset.del); toast('حذف شد'); setTimeout(() => location.reload(), 350); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

function openForm(f) {
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px">${f ? ic('edit', 18) + ' ویرایش' : ic('plus', 18) + ' پرسش جدید'}</h3>
    <div class="form-grid">
      <div class="field full"><label>پرسش *</label><input data-q value="${f?.question || ''}"></div>
      <div class="field full"><label>پاسخ *</label><textarea data-a rows="4">${f?.answer || ''}</textarea></div>
      <div class="field"><label>ترتیب</label><input type="number" data-sort value="${f?.sort_order || 0}"></div>
      <div class="field"><label>وضعیت</label><button class="toggle ${f?.is_active === false ? '' : 'on'}" data-active></button></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-active]').addEventListener('click', function () { this.classList.toggle('on'); });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      question: body.querySelector('[data-q]').value.trim(),
      answer: body.querySelector('[data-a]').value.trim(),
      sort_order: Number(body.querySelector('[data-sort]').value) || 0,
      is_active: body.querySelector('[data-active]').classList.contains('on'),
    };
    if (!payload.question || !payload.answer) { toast('پرسش و پاسخ الزامی است', 'err'); return; }
    try {
      if (f) await AdminAPI.put('/admin/faqs/' + f.id, payload);
      else await AdminAPI.post('/admin/faqs', payload);
      toast('ذخیره شد ✅');
      close();
      setTimeout(() => location.reload(), 350);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}
