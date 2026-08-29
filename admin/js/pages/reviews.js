// admin/pages/reviews.js — مدیریت نظرات محصولات
import { AdminAPI, faNum, faDate } from '../api.js';
import { toast, confirmModal, statusBadge } from '../components.js';

let state = { page: 1, status: 'pending' };

export async function render() {
  const q = new URLSearchParams({ page: state.page, status: state.status });
  const d = await AdminAPI.get('/admin/reviews?' + q);
  const statuses = [
    ['pending', 'در انتظار تایید'],
    ['approved', 'تایید شده'],
    ['rejected', 'رد شده'],
  ];
  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800">💬 نظرات محصولات</h3>
    <div style="display:flex;gap:6px">
      ${statuses.map(([s, l]) => `<button class="btn ${state.status === s ? 'btn-primary' : 'btn-ghost'}" data-status="${s}" style="padding:8px 16px;font-size:12px">${l}</button>`).join('')}
    </div>
  </div>
  <table class="data-table">
    <thead><tr><th>کاربر</th><th>محصول</th><th>امتیاز</th><th>نظر</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
      ${d.reviews.map(r => `
        <tr>
          <td><b>${r.user_name}</b></td>
          <td><a href="#/products/${r.product_id}" class="t-name" style="color:var(--brand-dark)">${r.product_name}</a></td>
          <td>${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</td>
          <td style="max-width:260px"><b style="font-size:12px">${r.title || ''}</b><div class="t-sub">${r.comment}</div></td>
          <td style="font-size:11px">${faDate(r.created_at)}</td>
          <td>${statusBadge(r.status)}</td>
          <td style="white-space:nowrap">
            ${r.status !== 'approved' ? `<button class="btn btn-ghost" data-approve="${r.id}" style="padding:7px 12px;font-size:11.5px;color:var(--green)">تایید</button>` : ''}
            ${r.status !== 'rejected' ? `<button class="btn btn-ghost" data-reject="${r.id}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">رد</button>` : ''}
            <button class="btn btn-ghost" data-del="${r.id}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">حذف</button>
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
  document.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => { state.status = b.dataset.status; state.page = 1; location.reload(); }));
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { state.page = Number(b.dataset.page); location.reload(); }));
  const setStatus = async (id, status) => {
    try { await AdminAPI.put('/admin/reviews/' + id + '/status', { status }); toast('به‌روزرسانی شد ✅'); setTimeout(() => location.reload(), 350); }
    catch (err) { toast(err.message, 'err'); }
  };
  document.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.approve, 'approved')));
  document.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => setStatus(b.dataset.reject, 'rejected')));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف نظر', 'این نظر برای همیشه حذف شود؟', async () => {
      try { await AdminAPI.del('/admin/reviews/' + b.dataset.del); toast('حذف شد'); setTimeout(() => location.reload(), 350); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}
