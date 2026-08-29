// pages/order.js — جزئیات و پیگیری سفارش
import { API, price, faNum, timeFa } from '../api.js';
import { Session } from '../store.js';
import { toast } from '../components.js';

export function title() { return 'پیگیری سفارش | پت‌شاپ'; }

export async function render(params) {
  if (!Session.isLoggedIn) {
    return `<div class="container"><div class="empty-state" style="background:var(--card);border-radius:24px;border:1px solid var(--line);margin:40px auto;max-width:500px"><div class="es-ic">🔒</div><h3>برای مشاهده سفارش وارد شوید</h3><a class="btn btn-primary" href="#/auth" style="margin-top:12px">ورود</a></div></div>`;
  }
  const { order } = await API.get('/orders/my/' + params.id);
  return `
  <div class="container">
    <nav class="breadcrumb"><a href="#/">خانه</a><span class="sep">/</span><a href="#/account?tab=orders">سفارش‌های من</a><span class="sep">/</span><span>${order.code}</span></nav>
    <div class="page-hero">
      <div>
        <h1>🧾 سفارش ${order.code}</h1>
        <p>ثبت‌شده در ${timeFa(order.created_at)} — وضعیت: <b style="color:var(--brand-dark)">${order.status_label}</b></p>
      </div>
      <div class="ph-ic">📦</div>
    </div>

    <div class="order-timeline" style="background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px">
      ${order.statuses.map((s, i) => `
        <div class="ot-step ${s.done ? 'done' : ''} ${order.status === s.key && order.status !== 'cancelled' ? 'current' : ''}">
          <div class="ot-dot">${s.done ? '✓' : faNum(i + 1)}</div>
          <div class="ot-label">${s.label}</div>
        </div>`).join('')}
    </div>
    ${order.status === 'cancelled' ? '<p style="text-align:center;color:var(--danger);font-weight:700;margin-top:12px">⚠️ این سفارش لغو شده است</p>' : ''}

    <div class="checkout-layout" style="margin-top:22px">
      <div class="checkout-card">
        <h3>📦 محصولات سفارش</h3>
        ${order.items.map(it => `
          <div class="order-summary-item">
            ${it.image ? `<img src="${it.image}" alt="" onerror="this.src='/assets/img/placeholder.jpg'">` : '<span style="font-size:30px">🐾</span>'}
            <div style="flex:1"><div class="os-name">${it.name}</div><div class="os-qty">تعداد: ${faNum(it.quantity)}</div></div>
            <span class="os-price">${price(it.total)} تومان</span>
          </div>`).join('')}
      </div>
      <div>
        <div class="checkout-card">
          <h3>🚚 اطلاعات گیرنده</h3>
          <div class="c-info-row"><span class="ci-ic">👤</span><div><span class="ci-l">نام</span><span class="ci-v">${order.customer.full_name}</span></div></div>
          <div class="c-info-row"><span class="ci-ic">📱</span><div><span class="ci-l">موبایل</span><span class="ci-v" dir="ltr">${order.customer.phone}</span></div></div>
          <div class="c-info-row"><span class="ci-ic">📍</span><div><span class="ci-l">آدرس</span><span class="ci-v">${order.customer.address || '—'}</span></div></div>
          <div class="c-info-row"><span class="ci-ic">💳</span><div><span class="ci-l">پرداخت</span><span class="ci-v">${order.payment_method === 'online' ? 'آنلاین (پرداخت شده)' : 'در محل'}</span></div></div>
          ${order.note ? `<div class="c-info-row"><span class="ci-ic">📝</span><div><span class="ci-l">یادداشت</span><span class="ci-v">${order.note}</span></div></div>` : ''}
        </div>
        <div class="checkout-card">
          <h3>💰 مبالغ</h3>
          <div class="sum-rows">
            <div class="sum-row"><span>جمع کالاها</span><span class="val">${price(order.subtotal)} تومان</span></div>
            ${order.discount ? `<div class="sum-row discount"><span>تخفیف</span><span class="val">− ${price(order.discount)} تومان</span></div>` : ''}
            <div class="sum-row"><span>ارسال</span><span class="val">${order.shipping ? price(order.shipping) + ' تومان' : 'رایگان'}</span></div>
            <div class="sum-row grand"><span>مبلغ نهایی</span><span class="val">${price(order.total)} تومان</span></div>
          </div>
          ${['pending', 'paid'].includes(order.status) ? `<button class="btn btn-outline btn-block" style="margin-top:14px;color:var(--danger);border-color:var(--danger)" data-cancel>لغو سفارش</button>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

export function mount(el, params) {
  el.querySelector('[data-cancel]')?.addEventListener('click', async (btn) => {
    if (!confirm('از لغو این سفارش مطمئن هستید؟')) return;
    btn.disabled = true;
    try {
      await API.post('/orders/my/' + params.id + '/cancel');
      toast('سفارش لغو شد');
      setTimeout(() => location.reload(), 600);
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
}
