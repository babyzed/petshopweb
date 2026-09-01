// admin/pages/users.js — مدیریت کاربران
import { AdminAPI, price, faNum, faDate, escHtml } from '../api.js';
import { toast, statusBadge, openModal, initials } from '../components.js';
import { ic } from '../icons.js';

let state = { page: 1, q: '' };

export async function render() {
  const q = new URLSearchParams({ page: state.page, q: state.q });
  const d = await AdminAPI.get('/admin/users?' + q);
  return `
  <div class="toolbar">
    <input class="search-inp" placeholder="جستجو با نام، ایمیل یا موبایل..." value="${state.q}" data-search>
    ${AdminAPI.isSuper() ? `<button class="btn btn-primary" data-new-user style="margin-inline-start:auto;padding:9px 16px;font-size:12.5px">${ic('plus', 14)} کاربر جدید</button>` : ''}
  </div>
  <table class="data-table">
    <thead><tr><th>کاربر</th><th>نقش</th><th>سفارش‌ها</th><th>تاریخ عضویت</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
      ${d.users.map(u => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <span class="at-avatar" style="width:36px;height:36px;font-size:13px">${initials(u.name)}</span>
              <div>
                <div class="t-name">${escHtml(u.name)}</div>
                <div class="t-sub" dir="ltr">${escHtml(u.email)}</div>
              </div>
            </div>
          </td>
          <td>${u.role_title || '—'}</td>
          <td>${faNum(u.order_count)}</td>
          <td style="font-size:11px">${faDate(u.created_at)}</td>
          <td>${u.status === 'active' ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-ghost" href="#/users/${u.id}" style="padding:7px 12px;font-size:11.5px">${ic('eye', 14)} مشاهده</a>
            <button class="btn btn-ghost" data-edit="${escHtml(JSON.stringify({ id: u.id, name: u.name, role_id: u.role_id, role_title: u.role_title }))}" style="padding:7px 12px;font-size:11.5px">${ic('edit', 14)} ویرایش</button>
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
  let timer;
  document.querySelector('[data-search]').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value; state.page = 1; location.reload(); }, 450);
  });
  document.querySelector('[data-new-user]')?.addEventListener('click', () => openNew());
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { state.page = Number(b.dataset.page); location.reload(); }));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEdit(JSON.parse(b.dataset.edit))));
}

const roleOptions = (roles, selectedId) => roles
  .map(r => `<option value="${r.id}" ${Number(selectedId) === Number(r.id) ? 'selected' : ''}>${r.title}</option>`).join('');

// ساخت کاربر جدید (فقط مدیر کل)
async function openNew() {
  const { roles } = await AdminAPI.get('/admin/roles');
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px">${ic('user', 18)} ساخت کاربر جدید</h3>
    <div class="form-grid">
      <div class="field full"><label>نام و نام خانوادگی *</label><input data-n-name placeholder="مثلاً: رضا محمدی"></div>
      <div class="field full"><label>ایمیل *</label><input dir="ltr" data-n-email placeholder="name@example.com"></div>
      <div class="field"><label>رمز عبور *</label><input dir="ltr" type="password" data-n-pass placeholder="حداقل ۶ کاراکتر"></div>
      <div class="field"><label>موبایل</label><input dir="ltr" data-n-phone placeholder="09xxxxxxxxx"></div>
      <div class="field full"><label>نقش کاربر</label>
        <select data-n-role>
          ${roleOptions(roles, roles.find(r => r.name === 'customer')?.id)}
        </select>
        <span class="hint">می‌توانید یک ادمین دلخواه (مدیر فروشگاه، محتوا، پشتیبانی یا مدیر کل) بسازید.</span>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ساخت کاربر</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const name = body.querySelector('[data-n-name]').value.trim();
    const email = body.querySelector('[data-n-email]').value.trim();
    const password = body.querySelector('[data-n-pass]').value;
    const phone = body.querySelector('[data-n-phone]').value.trim();
    const role_id = body.querySelector('[data-n-role]').value || undefined;
    if (!name || !email || !password) { toast('نام، ایمیل و رمز عبور الزامی‌اند', 'err'); return; }
    try {
      await AdminAPI.post('/admin/users', { name, email, password, phone, role_id });
      toast('کاربر ساخته شد ✅');
      close();
      setTimeout(() => location.reload(), 400);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}

async function openEdit(u) {
  const { roles } = await AdminAPI.get('/admin/roles');
  const isSuper = AdminAPI.isSuper();
  const { close, body } = openModal(`
    <h3 style="font-size:15px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px">${ic('edit', 18)} ویرایش کاربر ${escHtml(u.name)}</h3>
    <div class="form-grid">
      <div class="field full"><label>وضعیت حساب</label>
        <select data-status>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
        </select>
      </div>
      ${isSuper ? `
      <div class="field full"><label>نقش کاربر</label>
        <select data-role>
          ${roleOptions(roles, u.role_id)}
        </select>
        <span class="hint">فقط مدیر کل می‌تواند نقش را تغییر دهد؛ دست کم یک مدیر کل باید باقی بماند.</span>
      </div>` : '<div class="field full"><label>نقش کاربر</label><input value="' + escHtml(u.role_title || '—') + '" disabled></div>'}
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">ذخیره</button>
      <button class="btn btn-ghost" data-cancel>انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      status: body.querySelector('[data-status]').value,
      role_id: isSuper ? (body.querySelector('[data-role]').value || undefined) : undefined,
    };
    try {
      await AdminAPI.put('/admin/users/' + u.id, payload);
      toast('کاربر به‌روزرسانی شد ✅');
      close();
      setTimeout(() => location.reload(), 400);
    } catch (err) { toast(err.message, 'err'); }
  });
  body.querySelector('[data-cancel]').addEventListener('click', close);
}

// ---------- پروفایل کاربر ----------
export async function detailRender(params) {
  const { user } = await AdminAPI.get('/admin/users/' + params);
  return `
  <div class="toolbar">
    <a class="btn btn-ghost" href="#/users" style="padding:9px 16px;font-size:12.5px">${ic('arrowLeft', 16)} بازگشت</a>
    <h3 style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">${ic('user', 18)} ${user.name}</h3>
    <span style="margin-inline-start:auto">${user.status === 'active' ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">غیرفعال</span>'}</span>
  </div>
  <div class="dash-grid">
    <div>
      <div class="dash-card">
        <h3>${ic('receipt', 18)} سفارش‌های کاربر (${faNum(user.orders?.length || 0)})</h3>
        <table class="data-table">
          <thead><tr><th>کد</th><th>تاریخ</th><th>مبلغ</th><th>وضعیت</th></tr></thead>
          <tbody>
            ${user.orders?.length ? user.orders.map(o => `
              <tr style="cursor:pointer" data-href="#/orders/${o.id}"">
                <td><b style="color:var(--brand-dark)">${o.code}</b></td>
                <td style="font-size:11px">${faDate(o.created_at)}</td>
                <td>${price(o.total)} تومان</td>
                <td>${statusBadge(o.status)}</td>
              </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--muted)">سفارشی ثبت نشده است.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="dash-card">
        <h3>${ic('home', 18)} آدرس‌ها</h3>
        ${user.addresses?.length ? user.addresses.map(a => `
          <div class="mini-list-item">
            ${ic('pin', 16)}
            <div style="flex:1"><b>${a.full_name}</b> <span class="t-sub">${a.province} ${a.city} — ${a.address} — ${a.postal_code}</span></div>
            ${a.is_default ? '<span class="s-badge s-active">پیش‌فرض</span>' : ''}
          </div>`).join('') : '<p class="hint">آدرسی ثبت نشده است.</p>'}
      </div>
    </div>
    <div class="dash-card" style="align-self:start">
      <h3>${ic('home', 18)} اطلاعات حساب</h3>
      <div class="mini-list-item">${ic('user', 16)}<span class="mli-name">نام</span><b>${user.name}</b></div>
      <div class="mini-list-item">${ic('mail', 16)}<span class="mli-name">ایمیل</span><b dir="ltr">${user.email}</b></div>
      <div class="mini-list-item">${ic('phone', 16)}<span class="mli-name">موبایل</span><b dir="ltr">${user.phone || '—'}</b></div>
      <div class="mini-list-item">${ic('shield', 16)}<span class="mli-name">نقش</span><b>${user.role_title || '—'}</b></div>
      <div class="mini-list-item">${ic('clock', 16)}<span class="mli-name">عضویت</span><b>${faDate(user.created_at)}</b></div>
    </div>
  </div>`;
}
