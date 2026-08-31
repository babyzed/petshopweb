// admin/pages/coupons.js — مدیریت کدهای تخفیف
import { AdminAPI, faNum, faDate } from '../api.js';
import { toast, confirmModal, openModal } from '../components.js';
import { ic } from '../icons.js';

export async function render() {
  const { coupons } = await AdminAPI.get('/admin/coupons');
  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800;display:flex;align-items:center;gap:8px">${ic('percent', 18)} کدهای تخفیف</h3>
    <button class="btn btn-primary" data-new style="padding:10px 22px;font-size:13px">${ic('plus', 16)} کد جدید</button>
  </div>
  <table class="data-table">
    <thead><tr><th>کد</th><th>نوع</th><th>مقدار</th><th>حداقل خرید</th><th>استفاده</th><th>انقضا</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
      ${coupons.map(c => `
        <tr>
          <td><b style="color:var(--brand-dark)" dir="ltr">${c.code}</b></td>
          <td>${c.type === 'percent' ? 'درصدی' : 'مبلغی'}</td>
          <td><b>${c.type === 'percent' ? faNum(c.value) + '٪' : faNum(c.value).replace(/,/g, '٬') + ' تومان'}</b></td>
          <td>${c.min_amount ? faNum(c.min_amount).replace(/,/g, '٬') + ' تومان' : '—'}</td>
          <td>${faNum(c.used_count)} / ${c.max_usage ? faNum(c.max_usage) : '∞'}</td>
          <td style="font-size:11px">${c.expires_at ? faDate(c.expires_at) : 'بدون انقضا'}</td>
          <td>${c.is_active ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost" data-edit='${JSON.stringify(c)}' style="padding:7px 12px;font-size:11.5px">${ic('edit', 14)} ویرایش</button>
            <button class="btn btn-ghost" data-del="${c.id}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">${ic('trash', 14)} حذف</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

export function after() {
  document.querySelector('[data-new]').addEventListener('click', () => openForm(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openForm(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف کد تخفیف', 'این کد برای همیشه حذف شود؟', async () => {
      try { await AdminAPI.del('/admin/coupons/' + b.dataset.del); toast('حذف شد'); setTimeout(() => location.reload(), 350); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

function openForm(c) {
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px">${c ? ic('edit', 18) + ' ویرایش کد' : ic('plus', 18) + ' کد تخفیف جدید'}</h3>
    <div class="form-grid">
      <div class="field"><label>کد تخفیف *</label><input data-code value="${c?.code || ''}" dir="ltr" placeholder="SUMMER10"></div>
      <div class="field"><label>نوع</label>
        <select data-type>
          <option value="percent" ${c?.type === 'percent' ? 'selected' : ''}>درصدی</option>
          <option value="fixed" ${c?.type === 'fixed' ? 'selected' : ''}>مبلغ ثابت (تومان)</option>
        </select>
      </div>
      <div class="field"><label>مقدار تخفیف *</label><input type="number" min="1" data-value value="${c?.value || ''}"></div>
      <div class="field"><label>حداقل مبلغ خرید</label><input type="number" min="0" data-min value="${c?.min_amount || 0}"></div>
      <div class="field"><label>سقف استفاده (۰ = نامحدود)</label><input type="number" min="0" data-max value="${c?.max_usage || 0}"></div>
      <div class="field"><label>تاریخ انقضا (خالی = بدون انقضا)</label><input type="date" data-expires value="${c?.expires_at || ''}"></div>
      <div class="field full"><label>وضعیت</label><button class="toggle ${c?.is_active === false ? '' : 'on'}" data-active></button></div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-active]').addEventListener('click', function () { this.classList.toggle('on'); });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      code: body.querySelector('[data-code]').value.trim(),
      type: body.querySelector('[data-type]').value,
      value: body.querySelector('[data-value]').value,
      min_amount: body.querySelector('[data-min]').value,
      max_usage: body.querySelector('[data-max]').value,
      expires_at: body.querySelector('[data-expires]').value || null,
      is_active: body.querySelector('[data-active]').classList.contains('on'),
    };
    if (!payload.code || !payload.value) { toast('کد و مقدار را وارد کنید', 'err'); return; }
    try {
      if (c) await AdminAPI.put('/admin/coupons/' + c.id, payload);
      else await AdminAPI.post('/admin/coupons', payload);
      toast('ذخیره شد ✅');
      close();
      setTimeout(() => location.reload(), 350);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}
