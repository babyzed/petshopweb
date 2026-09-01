// admin/pages/orders.js — مدیریت سفارش‌ها
import { AdminAPI, price, faNum, faDate, escHtml } from '../api.js';
import { toast, statusBadge, paymentBadge } from '../components.js';
import { ic } from '../icons.js';

const STORAGE_KEY = 'admin_orders_state';
let state = (() => { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || { page: 1, status: 'all', q: '' }; } catch { return { page: 1, status: 'all', q: '' }; } })();
function saveState() { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} }

export async function render() {
  const q = new URLSearchParams({ page: state.page, status: state.status, q: state.q });
  const d = await AdminAPI.get('/admin/orders?' + q);
  return `
  <div class="toolbar">
    <input class="search-inp" placeholder="جستجو با کد سفارش یا نام مشتری..." value="${state.q}" data-search>
    <select data-status style="padding:10px 14px;border:1.5px solid #E7E0D8;border-radius:12px;font-size:13px;background:#fff">
      <option value="all">همه وضعیت‌ها</option>
      ${['pending', 'paid', 'shipped', 'delivered', 'cancelled'].map(s => `<option value="${s}" ${state.status === s ? 'selected' : ''}>${statusBadge(s).replace(/<[^>]*>/g, '')}</option>`).join('')}
    </select>
    ${d.demoCount > 0 ? `<span style="font-size:11px;color:var(--muted);background:#FEF3C7;padding:4px 12px;border-radius:8px">${ic('info', 12)} ${d.demoCount} سفارش نمایشی</span>` : ''}
  </div>
  <table class="data-table">
    <thead><tr><th>کد سفارش</th><th>مشتری</th><th>تاریخ</th><th>اقلام</th><th>مبلغ</th><th>پرداخت</th><th>وضعیت</th><th></th></tr></thead>
    <tbody>
      ${d.orders.map(o => {
        const c = JSON.parse(o.customer_json || '{}');
        return `
        <tr style="cursor:pointer" data-href="#/orders/${o.id}"">
          <td><b style="color:var(--brand-dark)">${o.code}</b> ${o.is_demo ? '<span class="s-badge s-draft" style="font-size:9px;margin-right:4px">نمایشی</span>' : ''}</td>
          <td><div class="t-name">${c.full_name || '—'}</div><div class="t-sub" dir="ltr">${c.phone || ''}</div></td>
          <td style="font-size:11px">${faDate(o.created_at)}</td>
          <td>${faNum(o.item_count)} کالا</td>
          <td><b>${price(o.total)} تومان</b></td>
          <td>${paymentBadge(o.payment_method, o.payment_status)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${ic('chevronLeft', 16)}</td>
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
}

// ---------- جزئیات سفارش ----------
export async function detailRender(params) {
  const { order, user } = await AdminAPI.get('/admin/orders/' + params);
  const c = order.customer || {};
  return `
  <div class="toolbar">
    <a class="btn btn-ghost" href="#/orders" style="padding:9px 16px;font-size:12.5px">${ic('arrowLeft', 16)} بازگشت</a>
    <h3 style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px">${ic('receipt', 18)} سفارش ${order.code}</h3>
    <span style="margin-inline-start:auto">${statusBadge(order.status)}</span>
  </div>

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
                  <b style="font-size:12.5px">${it.name}</b>
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
            <span>مبلغ نهایی</span><span class="val" style="color:var(--brand-dark)">${price(order.total)} تومان</span>
          </div>
        </div>
      </div>

      <div class="dash-card">
        <h3>${ic('refreshCw', 18)} تغییر وضعیت سفارش</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${(order.payment_method === 'cod'
            ? ['pending', 'shipped', 'delivered', 'cancelled']
            : ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
          ).map(s => `
            <button class="btn ${order.status === s ? 'btn-primary' : 'btn-ghost'}" data-set-status="${s}" ${order.status === s ? 'disabled' : ''} style="padding:9px 18px;font-size:12px">
              ${statusBadge(s).replace(/<[^>]*>/g, '')}
            </button>`).join('')}
        </div>
        <p class="hint" style="margin-top:10px">
          ${order.payment_method === 'cod'
            ? 'این سفارش «پرداخت در محل» است؛ وجه هنگام تحویل دریافت می‌شود و با تغییر وضعیت به «تحویل شده» پرداخت ثبت می‌شود.'
            : 'برای سفارش آنلاین، ارسال فقط پس از تأیید پرداخت امکان‌پذیر است.'}
        </p>
        <p class="hint" style="margin-top:6px">با «لغو شده» موجودی محصولات به انبار برمی‌گردد.</p>
      </div>
    </div>

    <div>
      <div class="dash-card">
        <h3>${ic('truck', 18)} اطلاعات مشتری و تحویل</h3>
        <div class="mini-list-item">${ic('user', 16)}<span class="mli-name">نام</span><b>${escHtml(c.full_name || '—')}</b></div>
        <div class="mini-list-item">${ic('phone', 16)}<span class="mli-name">موبایل</span><b dir="ltr">${escHtml(c.phone || '—')}</b></div>
        <div class="mini-list-item">${ic('home', 16)}<span class="mli-name">آدرس</span><b style="max-width:180px">${escHtml(c.address || '—')}</b></div>
        ${c.postal_code ? `<div class="mini-list-item">${ic('pin', 16)}<span class="mli-name">کد پستی</span><b dir="ltr">${escHtml(c.postal_code)}</b></div>` : ''}
        <div class="mini-list-item">${ic('card', 16)}<span class="mli-name">روش پرداخت</span><b>${order.payment_method === 'online' ? 'آنلاین' : 'در محل'}</b></div>
        <div class="mini-list-item">${ic('card', 16)}<span class="mli-name">وضعیت پرداخت</span>${paymentBadge(order.payment_method, order.payment_status)}</div>
        ${order.transaction_id ? `<div class="mini-list-item">${ic('clipboard', 16)}<span class="mli-name">شناسه تراکنش</span><b dir="ltr">${escHtml(order.transaction_id)}</b></div>` : ''}
        <div class="mini-list-item">${ic('clock', 16)}<span class="mli-name">تاریخ ثبت</span><b>${faDate(order.created_at)}</b></div>
        ${order.note ? `<div class="mini-list-item">${ic('file', 16)}<span class="mli-name">یادداشت</span><b style="max-width:180px">${escHtml(order.note)}</b></div>` : ''}
      </div>
      ${user ? `
      <div class="dash-card">
        <h3>${ic('user', 18)} حساب کاربری مرتبط</h3>
        <div class="mini-list-item">${ic('user', 16)}<span class="mli-name">${user.name}</span><b dir="ltr">${user.email}</b></div>
        <div class="mini-list-item">${ic('phone', 16)}<span class="mli-name">موبایل</span><b dir="ltr">${user.phone || '—'}</b></div>
        <a class="btn btn-ghost" href="#/users/${user.id}" style="margin-top:10px;padding:8px 16px;font-size:12px">${ic('eye', 14)} مشاهده سفارش‌های کاربر</a>
      </div>` : '<div class="dash-card"><h3>' + ic('user', 18) + ' حساب کاربری</h3><p class="hint">این سفارش به‌صورت مهمان ثبت شده است.</p></div>'}
    </div>
  </div>`;
}

export function detailAfter(params) {
  document.querySelectorAll('[data-set-status]').forEach(b => b.addEventListener('click', async () => {
    try {
      await AdminAPI.put('/admin/orders/' + params + '/status', { status: b.dataset.setStatus });
      toast('وضعیت سفارش به‌روزرسانی شد ✅');
      setTimeout(() => location.reload(), 400);
    } catch (err) { toast(err.message, 'err'); }
  }));
}
