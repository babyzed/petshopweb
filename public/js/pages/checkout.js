// pages/checkout.js — تسویه حساب: فرم، کد تخفیف، هزینه ارسال، ثبت سفارش
import { API, price, faNum } from '../api.js';
import { Cart, Session } from '../store.js';
import { toast } from '../components.js';
import { ic } from '../icons.js';

let coupon = null;
let shippingCost = 0;
let shippingSettings = { cost: 75000, free_over: 2000000 };
let paymentSettings = { online_enabled: true, cod_enabled: true };

export function title() { return 'تسویه حساب | پت‌شاپ'; }

export async function render() {
  if (!Cart.items.length) {
    return `
    <div class="container">
      <div class="empty-state" style="background:var(--card);border:1px solid var(--line);border-radius:24px;margin:40px auto;max-width:520px">
        <div class="es-ic">${ic('cart', 30)}</div>
        <h3>سبد خرید شما خالی است</h3>
        <p>قبل از تسویه، چند محصول جذاب به سبد اضافه کنید.</p>
        <a class="btn btn-primary" href="#/shop" style="margin-top:14px">رفتن به فروشگاه</a>
      </div>
    </div>`;
  }

  const pub = await (await import('../store.js')).Settings.get();
  shippingSettings = pub.shipping || shippingSettings;
  paymentSettings = pub.payment || paymentSettings;
  const settings = pub;

  let addresses = [];
  if (Session.isLoggedIn) {
    try { ({ addresses } = await API.get('/auth/addresses')); } catch (e) {}
  }

  const defaultAddr = addresses.find(a => a.is_default) || addresses[0] || null;

  return `
  <div class="container">
    <nav class="breadcrumb">
      <a href="#/">خانه</a><span class="sep">/</span><a href="#/shop">فروشگاه</a><span class="sep">/</span><span>تسویه حساب</span>
    </nav>
    <div class="page-hero">
      <div>
        <h1>تسویه حساب</h1>
        <p>سریع و آسان؛ در کمتر از یک دقیقه سفارش‌تان را ثبت کنید</p>
      </div>
      <div class="ph-ic">${ic('card', 44)}</div>
    </div>

    <div class="checkout-layout" style="margin-top:22px">
      <div>
        <div class="checkout-card">
          <h3><span class="cc-step">۱</span> اطلاعات گیرنده</h3>
          <div class="form-grid">
            <div class="field">
              <label>نام و نام خانوادگی *</label>
              <input type="text" value="${Session.user?.name || ''}" data-c-name placeholder="مثلاً: سارا محمدی">
            </div>
            <div class="field">
              <label>شماره موبایل *</label>
              <input type="tel" dir="ltr" value="${Session.user?.phone || ''}" data-c-phone placeholder="09xxxxxxxxx">
            </div>
          </div>
        </div>

        <div class="checkout-card">
          <h3><span class="cc-step">۲</span> آدرس تحویل</h3>
          ${addresses.length ? `
          <div class="addr-list" data-addr-list>
            ${addresses.map((a, i) => `
              <label class="addr-item ${defaultAddr?.id === a.id ? 'selected' : ''}">
                <input type="radio" name="addr" value="${a.id}" ${defaultAddr?.id === a.id ? 'checked' : ''}>
                <div style="flex:1">
                  <div style="font-weight:700;font-size:13px">${a.title || 'آدرس ' + faNum(i + 1)} — ${a.full_name}</div>
                  <div style="font-size:12px;color:var(--muted)">${a.province} ${a.city} — ${a.address} — کد پستی: ${a.postal_code}</div>
                </div>
              </label>`).join('')}
          </div>
          <p style="text-align:start;margin:10px 0"><button class="btn btn-ghost" style="font-size:12.5px" data-toggle-new-addr>+ آدرس جدید</button></p>
          ` : ''}
          <div class="form-grid" data-new-addr ${addresses.length ? 'style="display:none"' : ''}>
            <div class="field"><label>عنوان آدرس</label><input type="text" data-a-title placeholder="منزل / محل کار"></div>
            <div class="field"><label>کد پستی</label><input type="text" dir="ltr" data-a-postal placeholder="10 رقمی"></div>
            <div class="field"><label>استان</label><input type="text" data-a-province placeholder="تهران"></div>
            <div class="field"><label>شهر</label><input type="text" data-a-city placeholder="تهران"></div>
            <div class="field full"><label>آدرس کامل *</label><textarea data-a-address rows="2" placeholder="خیابان، کوچه، پلاک..."></textarea></div>
            ${Session.isLoggedIn ? '<label class="sf-check" style="grid-column:1/-1"><input type="checkbox" data-a-save checked> ذخیره این آدرس در حساب من</label>' : ''}
          </div>
        </div>

        <div class="checkout-card">
          <h3><span class="cc-step">۳</span> روش پرداخت</h3>
          ${paymentSettings.online_enabled || paymentSettings.cod_enabled ? `
          <div class="payment-methods">
            ${paymentSettings.online_enabled ? `
            <label class="pay-method ${!paymentSettings.cod_enabled ? 'selected' : ''}">
              <span class="pm-ic">${ic('card', 20)}</span>
              <div><div class="pm-name">پرداخت آنلاین</div><div class="pm-desc">اتصال امن به درگاه پرداخت</div></div>
              <input type="radio" name="pay" value="online" ${!paymentSettings.cod_enabled ? 'checked' : ''}>
            </label>` : ''}
            ${paymentSettings.cod_enabled ? `
            <label class="pay-method ${!paymentSettings.online_enabled ? 'selected' : ''}">
              <span class="pm-ic">${ic('cash', 20)}</span>
              <div><div class="pm-name">پرداخت در محل</div><div class="pm-desc">مبلغ را هنگام تحویل بپردازید</div></div>
              <input type="radio" name="pay" value="cod" ${!paymentSettings.online_enabled ? 'checked' : ''}>
            </label>` : ''}
          </div>` : `
          <p style="color:var(--muted);text-align:center;padding:16px 0">روش پرداختی در حال حاضر فعال نیست.</p>`}
        </div>

        <div class="checkout-card">
          <h3><span class="cc-step">۴</span> یادداشت سفارش <span style="font-size:11px;color:var(--muted);font-weight:500">(اختیاری)</span></h3>
          <div class="field"><textarea data-c-note rows="2" placeholder="مثلاً: لطفاً با پت‌من تماس بگیرید..."></textarea></div>
        </div>
      </div>

      <div>
        <div class="checkout-card" style="position:sticky;top:100px">
          <h3>${ic('package', 18)} خلاصه سفارش (${faNum(Cart.count())} کالا)</h3>
          <div data-summary-items>
            ${Cart.items.map(it => `
              <div class="order-summary-item">
                <img src="${it.image}" alt="">
                <div style="flex:1"><div class="os-name">${it.name}</div><div class="os-qty">تعداد: ${faNum(it.quantity)}</div></div>
                <span class="os-price">${price(it.price * it.quantity)}</span>
              </div>`).join('')}
          </div>
          <div class="sum-rows">
            <div class="sum-row"><span>جمع کالاها</span><span class="val" data-sum-subtotal>${price(Cart.subtotal())} تومان</span></div>
            <div class="sum-row discount"><span>تخفیف</span><span class="val" data-sum-discount>—</span></div>
            <div class="sum-row"><span>هزینه ارسال</span><span class="val" data-sum-shipping>—</span></div>
            <div class="sum-row free" data-free-line style="display:none"><span>${ic('check', 14)} ارسال رایگان شد!</span></div>
            <div class="sum-row grand"><span>مبلغ قابل پرداخت</span><span class="val" data-sum-total>—</span></div>
          </div>

          <div class="coupon-row">
            <input type="text" placeholder="کد تخفیف دارید؟ وارد کنید" data-coupon-input>
            <button class="btn btn-outline" data-coupon-apply>اعمال</button>
          </div>
          <div data-coupon-box></div>

          <button class="btn btn-primary btn-block btn-lg" style="margin-top:18px" data-submit-order>
            ${'ثبت نهایی سفارش'} ←
          </button>
          <p style="font-size:11.5px;color:var(--muted);text-align:center;margin-top:10px">با ثبت سفارش، <a href="#/page/rules" style="color:var(--brand-dark)">قوانین</a> پت‌شاپ را می‌پذیرید.</p>
        </div>
      </div>
    </div>
  </div>`;
}

export function mount(el) {
  if (!Cart.items.length) return; // empty cart — nothing to mount
  const subtotal = Cart.subtotal();
  coupon = null;

  const refreshTotals = () => {
    const discount = coupon ? coupon.discount : 0;
    const after = subtotal - discount;
    shippingCost = after >= shippingSettings.free_over ? 0 : shippingSettings.cost;
    const total = after + shippingCost;
    el.querySelector('[data-sum-discount]').textContent = discount ? `− ${price(discount)} تومان` : '—';
    el.querySelector('[data-sum-shipping]').textContent = shippingCost === 0 ? 'رایگان' : price(shippingCost) + ' تومان';
    el.querySelector('[data-sum-total]').textContent = price(total) + ' تومان';
    el.querySelector('[data-free-line]').style.display = shippingCost === 0 ? 'flex' : 'none';
  };
  refreshTotals();

  // کد تخفیف
  const applyCoupon = async () => {
    const code = el.querySelector('[data-coupon-input]').value.trim();
    if (!code) { toast('کد تخفیف را وارد کنید', 'info'); return; }
    try {
      const r = await API.post('/coupons/validate', { code, subtotal });
      if (r.valid) {
        coupon = r;
        refreshTotals();
        el.querySelector('[data-coupon-box]').innerHTML = `
          <div class="coupon-applied">
            <span>${ic('ticket', 14)} ${r.code} — ${faNum(r.discount).replace(/,/g, '٬')} تومان تخفیف</span>
            <button data-coupon-remove>حذف</button>
          </div>`;
        el.querySelector('[data-coupon-remove]').addEventListener('click', () => { coupon = null; el.querySelector('[data-coupon-box]').innerHTML = ''; refreshTotals(); });
      } else {
        toast(r.error || 'کد تخفیف معتبر نیست', 'err');
      }
    } catch (err) { toast(err.message, 'err'); }
  };
  el.querySelector('[data-coupon-apply]').addEventListener('click', applyCoupon);
  el.querySelector('[data-coupon-input]').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyCoupon(); });

  // آدرس
  el.querySelector('[data-toggle-new-addr]')?.addEventListener('click', () => {
    const na = el.querySelector('[data-new-addr]');
    na.style.display = na.style.display === 'none' ? 'grid' : 'none';
  });
  el.querySelectorAll('.addr-item input').forEach(r => r.addEventListener('change', () => {
    el.querySelectorAll('.addr-item').forEach(a => a.classList.remove('selected'));
    r.closest('.addr-item').classList.add('selected');
  }));
  el.querySelectorAll('.pay-method').forEach(p => p.addEventListener('click', () => {
    el.querySelectorAll('.pay-method').forEach(x => x.classList.remove('selected'));
    p.classList.add('selected');
  }));

  // ثبت سفارش
  el.querySelector('[data-submit-order]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const name = el.querySelector('[data-c-name]').value.trim();
    const phone = el.querySelector('[data-c-phone]').value.trim();
    if (!name) { toast('نام و نام خانوادگی را وارد کنید', 'err'); return; }
    if (!/^09\d{9}$/.test(phone)) { toast('شماره موبایل معتبر وارد کنید (09...)', 'err'); return; }

    const selectedAddr = el.querySelector('.addr-item input:checked');
    let address = '';
    let postalCode = '';
    if (selectedAddr) {
      const a = selectedAddr.closest('.addr-item');
      address = a.querySelector('div:nth-child(2) div:nth-child(2)')?.textContent || '';
      // استخراج کد پستی از متن آدرس
      const postalMatch = address.match(/کد پستی:\s*(\d+)/);
      if (postalMatch) postalCode = postalMatch[1];
    } else {
      const raw = el.querySelector('[data-a-address]').value.trim();
      if (!raw) { toast('آدرس تحویل را وارد کنید', 'err'); return; }
      postalCode = el.querySelector('[data-a-postal]').value.trim();
      address = `${el.querySelector('[data-a-province]').value.trim()} ${el.querySelector('[data-a-city]').value.trim()} — ${raw}${postalCode ? ' — کد پستی: ' + postalCode : ''}`;
      // ذخیره آدرس
      if (Session.isLoggedIn && el.querySelector('[data-a-save]')?.checked) {
        try {
          await API.post('/auth/addresses', {
            full_name: name, phone,
            province: el.querySelector('[data-a-province]').value.trim(),
            city: el.querySelector('[data-a-city]').value.trim(),
            address: raw,
            postal_code: el.querySelector('[data-a-postal]').value.trim(),
            title: el.querySelector('[data-a-title]').value.trim() || 'آدرس من',
          });
        } catch (e) {}
      }
    }

    const payment = el.querySelector('input[name="pay"]:checked').value;
    btn.disabled = true;
    btn.textContent = '⏳ در حال ثبت سفارش...';
    try {
      const r = await API.post('/orders', {
        customer: { full_name: name, phone, postal_code: postalCode },
        address,
        items: Cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, image: i.image })),
        coupon_code: coupon?.code,
        use_coupon: !!coupon,
        payment_method: payment,
        note: el.querySelector('[data-c-note]').value.trim(),
      });

      // پرداخت آنلاین
      if (r.needsPayment) {
        Cart.clear();
        if (r.paymentUrl) {
          window.location.href = r.paymentUrl;
          return; // منتظر ریدایرکت بانک باش
        }
        // درگاه پرداخت فعال نیست — سفارش ثبت شده ولی پرداخت pending
        renderSuccess(el, r.order, payment);
        return;
      }

      // پرداخت در محل: ثبت سفارش موفق
      Cart.clear();
      renderSuccess(el, r.order, payment);
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = 'ثبت نهایی سفارش ←';
    }
  });
}

async function renderSuccess(el, order, payment) {
  let extra = '';
  if (payment === 'online') {
    extra = `<p style="font-size:13px;color:#92400E;background:#FEF3C7;padding:10px 14px;border-radius:10px;margin-bottom:14px">⚠️ پرداخت آنلاین در حال حاضر فعال نیست. سفارش شما ثبت شده و در انتظار پرداخت است. لطفاً با پشتیبانی تماس بگیرید.</p>`;
  }
  const root = el.querySelector('.container') || el;
  root.innerHTML = `
  <div class="success-box">
    <div class="success-ic">${ic('check', 44)}</div>
    <h2 style="font-size:21px;font-weight:800">سفارش شما با موفقیت ثبت شد!</h2>
    <p style="color:var(--muted);font-size:13.5px;margin-top:8px">از اعتماد شما به پت‌شاپ سپاسگزاریم.</p>
    <div class="success-code">کد پیگیری: ${order.code}</div>
    ${extra}
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <a class="btn btn-primary" href="#/account?tab=orders">پیگیری سفارش</a>
      <a class="btn btn-outline" href="#/shop">ادامه خرید</a>
    </div>
  </div>`;
  window.scrollTo({ top: 0 });
}
