// admin/pages/orders.js — مدیریت سفارش‌ها
import { AdminAPI, price, faNum, faDate, escHtml } from '../api.js';
import { toast, statusBadge, statusLabel, paymentBadge } from '../components.js';
import { ic } from '../icons.js';

const STORAGE_KEY = 'admin_orders_state';
let state = (() => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || { page: 1, status: 'all', q: '' }; } catch { return { page: 1, status: 'all', q: '' }; } })();
function saveState() { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }

// مسیر وضعیت‌ها بر اساس روش پرداخت (همان مسیری که سرور اعتبارسنجی می‌کند)
// در محل: ثبت سفارش → تایید فروشگاه → ارسال → تحویل
// آنلاین: ثبت سفارش → پرداخت → ارسال → تحویل
const FLOW = {
  cod: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
  online: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
};
const FILTER_STATUSES = ['pending', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'];
const FILTER_LABELS = { pending: 'در انتظار تایید/پرداخت' };
const STATUS_ICONS = { pending: 'clock', confirmed: 'check', paid: 'card', shipped: 'truck', delivered: 'home', cancelled: 'x' };

// فیلتر وضعیت از هَش (مثل #/orders?status=pending) — برای لینک‌های داشبورد
function readHashFilter() {
  const hash = location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return;
  const s = new URLSearchParams(hash.slice(qIdx + 1)).get('status');
  if (s && (s === 'all' || FILTER_STATUSES.includes(s))) {
    state.status = s;
    state.page = 1;
    saveState();
  }
}

export async function render() {
  readHashFilter();
  const q = new URLSearchParams({ page: state.page, status: state.status, q: state.q });
  const d = await AdminAPI.get('/admin/orders?' + q);
  return `
  <div class="toolbar">
    <input class="search-inp" placeholder="جستجو با کد سفارش یا نام مشتری..." value="${state.q}" data-search>
    <select data-status class="filter-sel">
      <option value="all">همه وضعیت‌ها</option>
      ${FILTER_STATUSES.map(s => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${FILTER_LABELS[s] || statusLabel(s)}</option>`).join('')}
    </select>
    ${d.demoCount > 0 ? `<span class="demo-hint">${ic('info', 12)} ${faNum(d.demoCount)} سفارش نمایشی</span>` : ''}
  </div>
  <table class="data-table">
    <thead><tr><th>کد سفارش</th><th>مشتری</th><th>تاریخ</th><th>اقلام</th><th>مبلغ</th><th>پرداخت</th><th>وضعیت</th><th></th></tr></thead>
    <tbody>
      ${d.orders.map(o => {
        const c = JSON.parse(o.customer_json || '{}');
        // سفارش «پرداخت در محل» در انتظار تایید → دکمه تایید سریع همان‌جا در لیست
        const canApprove = o.payment_method === 'cod' && o.status === 'pending';
        return `
        <tr style="cursor:pointer" data-href="#/orders/${o.id}">
          <td><b style="color:var(--brand-dark)">${o.code}</b> ${o.is_demo ? '<span class="s-badge s-draft" style="font-size:9px;margin-right:4px">نمایشی</span>' : ''}</td>
          <td><div class="t-name">${escHtml(c.full_name || '—')}</div><div class="t-sub" dir="ltr">${escHtml(c.phone || '')}</div></td>
          <td style="font-size:11px">${faDate(o.created_at)}</td>
          <td>${faNum(o.item_count)} کالا</td>
          <td><b>${price(o.total)} تومان</b></td>
          <td>${paymentBadge(o.payment_method, o.payment_status)}</td>
          <td>${statusBadge(o.status, o.payment_method)}</td>
          <td class="row-actions">
            ${canApprove ? `<button class="btn btn-primary btn-xs" data-approve="${o.id}" title="تایید سفارش">${ic('check', 13)} تایید</button>` : ''}
            ${ic('chevronLeft', 16)}
          </td>
        </tr>`;
      }).join('')}
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
    timer = setTimeout(() => { state.q = e.target.value; state.page = 1; saveState(); location.reload(); }, 450);
  });
  document.querySelector('[data-status]').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; saveState(); location.reload(); });
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => { state.page = Number(b.dataset.page); saveState(); location.reload(); }));

  // تایید سریع از داخل لیست سفارش‌ها
  document.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', async (e) => {
    e.stopPropagation(); // جلوگیری از رفتن به صفحه جزئیات (data-href روی ردیف)
    if (b.disabled) return;
    b.disabled = true;
    try {
      const r = await AdminAPI.put('/admin/orders/' + b.dataset.approve + '/status', { status: 'confirmed' });
      toast(r.message || 'سفارش تایید شد ✅');
      setTimeout(() => location.reload(), 500);
    } catch (err) { b.disabled = false; toast(err.message, 'err'); }
  }));
}

// ---------- نمودار مراحل سفارش ----------
function statusPipeline(order) {
  const steps = order.payment_method === 'cod'
    ? [['pending', 'ثبت سفارش'], ['confirmed', 'تایید فروشگاه'], ['shipped', 'ارسال'], ['delivered', 'تحویل']]
    : [['pending', 'ثبت سفارش'], ['paid', 'پرداخت'], ['shipped', 'ارسال'], ['delivered', 'تحویل']];
  const idx = steps.findIndex(s => s[0] === order.status);
  return `
  <div class="status-flow">
    ${steps.map(([key, label], i) => {
      const done = order.status !== 'cancelled' && idx >= i;
      const current = order.status === key;
      return `<div class="sf-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
        <span class="sf-dot">${done ? ic('check', 12) : faNum(i + 1)}</span>
        <span class="sf-label">${label}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ---------- جزئیات سفارش ----------
export async function detailRender(params) {
  const { order, user } = await AdminAPI.get('/admin/orders/' + params);
  const c = order.customer || {};
  const isCod = order.payment_method === 'cod';
  const awaitingApproval = isCod && order.status === 'pending';
  const flow = isCod ? FLOW.cod : FLOW.online;

  return `
  <div class="toolbar">
    <a class="btn btn-ghost" href="#/orders" style="padding:9px 16px;font-size:12.5px">${ic('arrowLeft', 16)} بازگشت</a>
    <h3 style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">${ic('receipt', 18)} سفارش ${order.code}</h3>
    <span style="margin-inline-start:auto">${statusBadge(order.status, order.payment_method)}</span>
  </div>

  ${awaitingApproval ? `
  <div class="approval-banner">
    <span class="ab-ic">${ic('bell', 22)}</span>
    <div class="ab-txt">
      <b>این سفارش «پرداخت در محل» در انتظار تایید شماست</b>
      <span>تا سفارش تایید نشود، امکان ثبت ارسال وجود ندارد.</span>
    </div>
    <button class="btn btn-primary" data-set-status="confirmed">${ic('check', 16)} تایید سفارش</button>
  </div>` : ''}

  <div class="dash-grid">
    <div>
      <div class="dash-card">
        <h3>${ic('package', 18)} محصولات</h3>
        <table class="data-table">
          <thead><tr><th>محصول</th><th>قیمت واحد</th><th>تعداد</th><th>جمع</th></tr></thead>
          <tbody>
            ${order.items.map(it => `
              <tr>
                <td><div style="display:flex;align-items:center;gap:10px">
                  ${it.image ? `<img class="t-img" src="${it.image}" style="width:36px;height:36px">` : `<span style="font-size:18px;color:var(--brand)">${ic('package', 20)}</span>`}
                  <b style="font-size:12.5px">${escHtml(it.name)}</b>
                </div></td>
                <td>${price(it.price)}</td>
                <td>${faNum(it.quantity)}</td>
                <td><b>${price(it.total)} تومان</b></td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div class="sum-rows" style="margin-top:14px">
          <div class="sum-row"><span>جمع کالاها</span><span class="val">${price(order.subtotal)} تومان</span></div>
          ${order.discount ? `<div class="sum-row" style="color:var(--green)"><span>تخفیف (${order.coupon_code || ''})</span><span class="val">− ${price(order.discount)} تومان</span></div>` : ''}
          <div class="sum-row"><span>ارسال</span><span class="val">${order.shipping ? price(order.shipping) + ' تومان' : 'رایگان'}</span></div>
          <div class="sum-row" style="font-size:16px;font-weight:800;border-top:2px solid #F1EDE7;margin-top:8px;padding-top:10px">
            <span>مبلغ نهایی</span><span class="val" style="color:var(--brand-dark)">${price(order.total)} تومان</span></div>
        </div>
      </div>

      <div class="dash-card">
        <h3>${ic('refreshCw', 18)} تغییر وضعیت سفارش</h3>
        ${statusPipeline(order)}
        <div class="form-grid" style="margin-top:14px">
          <div class="field">
            <label>کد رهگیری پستی</label>
            <input data-tracking-code dir="ltr" placeholder="هنگام ارسال وارد کنید" value="${escHtml(order.tracking_code || '')}">
            <span style="font-size:11px;color:var(--muted)">این کد پس از ثبت «ارسال»، همزمان با پیامک ارسال برای مشتری فرستاده می‌شود.</span>
          </div>
        </div>
        <div class="status-actions">
          ${flow.map(s => `
            <button class="btn ${order.status === s ? 'btn-primary' : (s === 'cancelled' ? 'btn-ghost btn-cancel' : 'btn-ghost')}" data-set-status="${s}" ${order.status === s ? 'disabled' : ''} style="padding:9px 18px;font-size:12px">
              ${ic(STATUS_ICONS[s] || 'clock', 14)} ${s === 'confirmed' ? 'تایید سفارش' : statusLabel(s, order.payment_method)}
            </button>`).join('')}
        </div>
        <p class="hint" style="margin-top:10px">
          ${isCod
            ? 'این سفارش «پرداخت در محل» است: ابتدا سفارش را <b>تایید</b> کنید، سپس ارسال و در پایان تحویل را ثبت کنید. وجه هنگام تحویل دریافت و ثبت می‌شود.'
            : 'برای سفارش آنلاین، ارسال فقط پس از تأیید پرداخت امکان‌پذیر است.'}
        </p>
        <p class="hint" style="margin-top:6px">با «لغو شده» موجودی محصولات به انبار برمی‌گردد.</p>
      </div>

      ${order.history?.length ? `
      <div class="dash-card">
        <h3>${ic('clock', 18)} تاریخچه وضعیت</h3>
        <div class="hist-list">
          ${order.history.slice().reverse().map(h => `
            <div class="hist-item">
              <span class="hist-dot ${h.new_status === 'cancelled' ? 'bad' : ''}"></span>
              <div class="hist-body">
                <b>${h.old_status ? statusLabel(h.new_status, order.payment_method) : 'ثبت سفارش'}</b>
                ${h.note ? `<span class="hist-note">${escHtml(h.note)}</span>` : ''}
                <span class="hist-meta">${faDate(h.created_at)} — ${h.changed_by_name ? escHtml(h.changed_by_name) : 'سیستم'}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <div>
      <div class="dash-card">
        <h3>${ic('truck', 18)} اطلاعات مشتری و تحویل</h3>
        <div class="mini-list-item">${ic('user', 16)}<span class="mli-name">نام</span><b>${escHtml(c.full_name || '—')}</b></div>
        <div class="mini-list-item">${ic('phone', 16)}<span class="mli-name">موبایل</span><b dir="ltr">${escHtml(c.phone || '—')}</b></div>
        <div class="mini-list-item">${ic('home', 16)}<span class="mli-name">آدرس</span><b style="max-width:180px">${escHtml(c.address || '—')}</b></div>
        ${c.postal_code ? `<div class="mini-list-item">${ic('pin', 16)}<span class="mli-name">کد پستی</span><b dir="ltr">${escHtml(c.postal_code)}</b></div>` : ''}
        <div class="mini-list-item">${ic('card', 16)}<span class="mli-name">روش پرداخت</span><b>${isCod ? 'در محل' : 'آنلاین'}</b></div>
        <div class="mini-list-item">${ic('card', 16)}<span class="mli-name">وضعیت پرداخت</span>${paymentBadge(order.payment_method, order.payment_status)}</div>
        ${order.transaction_id ? `<div class="mini-list-item">${ic('clipboard', 16)}<span class="mli-name">شناسه تراکنش</span><b dir="ltr">${escHtml(order.transaction_id)}</b></div>` : ''}
        ${order.tracking_code ? `<div class="mini-list-item">${ic('package', 16)}<span class="mli-name">کد رهگیری پستی</span><b dir="ltr">${escHtml(order.tracking_code)}</b></div>` : ''}
        <div class="mini-list-item">${ic('clock', 16)}<span class="mli-name">تاریخ ثبت</span><b>${faDate(order.created_at)}</b></div>
        ${order.note ? `<div class="mini-list-item">${ic('file', 16)}<span class="mli-name">یادداشت</span><b style="max-width:180px">${escHtml(order.note)}</b></div>` : ''}
      </div>
      ${user ? `
      <div class="dash-card">
        <h3>${ic('user', 18)} حساب کاربری مرتبط</h3>
        <div class="mini-list-item">${ic('user', 16)}<span class="mli-name">${escHtml(user.name)}</span><b dir="ltr">${escHtml(user.email)}</b></div>
        <div class="mini-list-item">${ic('phone', 16)}<span class="mli-name">موبایل</span><b dir="ltr">${escHtml(user.phone || '—')}</b></div>
        <a class="btn btn-ghost" href="#/users/${user.id}" style="margin-top:10px;padding:8px 16px;font-size:12px">${ic('eye', 14)} مشاهده سفارش‌های کاربر</a>
      </div>` : '<div class="dash-card"><h3>' + ic('user', 18) + ' حساب کاربری</h3><p class="hint">این سفارش به‌صورت مهمان ثبت شده است.</p></div>'}
    </div>
  </div>`;
}

export function detailAfter(params) {
  document.querySelectorAll('[data-set-status]').forEach(b => b.addEventListener('click', async () => {
    if (b.disabled) return;
    b.disabled = true;
    try {
      const r = await AdminAPI.put('/admin/orders/' + params + '/status', {
        status: b.dataset.setStatus,
        tracking_code: document.querySelector('[data-tracking-code]')?.value || '',
      });
      toast(r.message || 'وضعیت سفارش به‌روزرسانی شد ✅');
      setTimeout(() => location.reload(), 500);
    } catch (err) { b.disabled = false; toast(err.message, 'err'); }
  }));
}
