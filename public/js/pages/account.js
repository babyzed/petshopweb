// pages/account.js — پنل کاربری: پروفایل، آدرس‌ها، سفارش‌ها، علاقه‌مندی‌ها، رمز
import { API, price, faNum, dateFa, timeFa } from '../api.js';
import { Session, Cart } from '../store.js';
import { toast, initials, productCard, productCardH } from '../components.js';

export function title() { return 'حساب کاربری | پت‌شاپ'; }

export async function render(params, query) {
  if (!Session.isLoggedIn) {
    return `
    <div class="container">
      <div class="empty-state" style="background:var(--card);border:1px solid var(--line);border-radius:24px;margin:40px auto;max-width:520px">
        <div class="es-ic">🔒</div>
        <h3>ابتدا وارد حساب شوید</h3>
        <p>برای مشاهده سفارش‌ها، آدرس‌ها و علاقه‌مندی‌ها وارد شوید.</p>
        <a class="btn btn-primary" href="#/auth" style="margin-top:14px">ورود / ثبت‌نام</a>
      </div>
    </div>`;
  }

  const tab = query.get('tab') || 'profile';
  const u = Session.user;

  let tabContent = '';
  if (tab === 'orders') {
    const { orders } = await API.get('/orders/my');
    tabContent = orders.length ? orders.map(o => `
      <a class="order-card" href="#/order/${o.id}">
        <div>
          <div class="order-code">${o.code}</div>
          <div class="order-date">${timeFa(o.created_at)} — ${faNum(o.item_count)} کالا</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="order-total">${price(o.total)} تومان</span>
          <span class="order-status os-${o.status}">${o.status_label}</span>
        </div>
      </a>`).join('') : emptyState('🧾', 'هنوز سفارشی ثبت نکرده‌اید', 'از فروشگاه شروع کنید!');
  } else if (tab === 'wishlist') {
    const { ids } = await API.get('/auth/wishlist');
    let products = [];
    for (const id of ids) {
      try {
        const { product } = await API.get('/products/' + id);
        if (product) products.push(product);
      } catch (e) {}
    }
    tabContent = products.length
      ? `<div class="wish-grid">${products.map(p => window.innerWidth <= 560 ? productCardH(p) : productCard(p)).join('')}</div>`
      : emptyState('🤍', 'علاقه‌مندی‌ها خالی است', 'روی قلب محصولات بزنید تا اینجا ذخیره شوند');
  } else if (tab === 'addresses') {
    const { addresses } = await API.get('/auth/addresses');
    tabContent = `
      <div id="addr-box">
        ${addresses.length ? addresses.map(a => `
          <div class="order-card" style="align-items:flex-start">
            <div>
              <div style="font-weight:800;font-size:13.5px">${a.title || 'آدرس'} ${a.is_default ? '<span class="order-status os-delivered" style="margin-inline-start:8px">پیش‌فرض</span>' : ''}</div>
              <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${a.full_name} — ${a.phone}</div>
              <div style="font-size:12.5px;color:var(--muted)">${a.province} ${a.city} — ${a.address} — ${a.postal_code}</div>
            </div>
            <button class="btn btn-ghost" data-del-addr="${a.id}" style="font-size:12px;padding:8px 14px">حذف</button>
          </div>`).join('') : emptyState('📍', 'آدرسی ثبت نشده', 'آدرس جدید اضافه کنید')}
      </div>
      <button class="btn btn-primary" data-new-addr style="margin-top:10px">+ آدرس جدید</button>
      <div class="form-grid" id="addr-form" style="display:none;margin-top:14px">
        <div class="field"><label>عنوان</label><input data-a-title placeholder="منزل"></div>
        <div class="field"><label>کد پستی</label><input data-a-postal dir="ltr"></div>
        <div class="field"><label>استان</label><input data-a-province></div>
        <div class="field"><label>شهر</label><input data-a-city></div>
        <div class="field full"><label>آدرس کامل *</label><textarea data-a-address rows="2"></textarea></div>
        <div class="field full"><button class="btn btn-primary" data-save-addr>ذخیره آدرس</button></div>
      </div>`;
  } else if (tab === 'password') {
    tabContent = `
      <div class="form-grid" style="max-width:480px">
        <div class="field full"><label>رمز عبور فعلی *</label><input type="password" dir="ltr" data-p-current></div>
        <div class="field full"><label>رمز عبور جدید *</label><input type="password" dir="ltr" data-p-new></div>
        <div class="field full"><button class="btn btn-primary" data-save-pass>تغییر رمز عبور</button></div>
      </div>`;
  } else {
    tabContent = `
      <div class="form-grid" style="max-width:520px">
        <div class="field"><label>نام و نام خانوادگی *</label><input value="${u.name || ''}" data-p-name></div>
        <div class="field"><label>شماره موبایل</label><input value="${u.phone || ''}" dir="ltr" data-p-phone></div>
        <div class="field"><label>ایمیل</label><input value="${u.email || ''}" dir="ltr" disabled style="opacity:.6"></div>
        <div class="field full"><button class="btn btn-primary" data-save-profile>ذخیره تغییرات</button></div>
      </div>
      <div class="auth-note" style="margin-top:18px">
        <span class="an-ic">🐾</span>
        <span>عضو پت‌شاپ از ${dateFa(u.created_at)} — ممنون که با ما هستید!</span>
      </div>`;
  }

  const tabs = [
    ['profile', '👤', 'اطلاعات حساب'],
    ['orders', '🧾', 'سفارش‌های من'],
    ['wishlist', '🤍', 'علاقه‌مندی‌ها'],
    ['addresses', '📍', 'آدرس‌ها'],
    ['password', '🔑', 'تغییر رمز'],
  ];

  return `
  <div class="container">
    <nav class="breadcrumb"><a href="#/">خانه</a><span class="sep">/</span><span>حساب کاربری</span></nav>
    <div class="account-layout">
      <aside class="acct-nav">
        <div class="acct-user">
          <span class="acct-avatar">${initials(u.name)}</span>
          <div style="min-width:0">
            <div style="font-weight:800;font-size:14px;overflow:hidden;text-overflow:ellipsis">${u.name}</div>
            <div style="font-size:11px;color:var(--muted)" dir="ltr">${u.email}</div>
          </div>
        </div>
        ${tabs.map(([k, ic, l]) => `<a href="#/account?tab=${k}" class="${tab === k ? 'active' : ''}"><span>${ic}</span>${l}</a>`).join('')}
        <a href="#" data-logout style="color:var(--danger)"><span>🚪</span>خروج از حساب</a>
      </aside>
      <div class="acct-panel">
        <h2>${tabs.find(t => t[0] === tab)?.[1]} ${tabs.find(t => t[0] === tab)?.[2]}</h2>
        ${tabContent}
      </div>
    </div>
  </div>`;
}

function emptyState(ic, title, text) {
  return `<div class="empty-state"><div class="es-ic">${ic}</div><h3>${title}</h3><p>${text}</p></div>`;
}

export function mount(el, params, query) {
  const tab = query.get('tab') || 'profile';

  el.querySelector('[data-logout]')?.addEventListener('click', (e) => {
    e.preventDefault();
    Session.logout();
    toast('از حساب خارج شدید');
    location.hash = '#/';
  });

  if (tab === 'profile') {
    el.querySelector('[data-save-profile]')?.addEventListener('click', async () => {
      try {
        const r = await API.put('/auth/profile', {
          name: el.querySelector('[data-p-name]').value.trim(),
          phone: el.querySelector('[data-p-phone]').value.trim(),
        });
        Session.setUser(r.user);
        toast('پروفایل به‌روزرسانی شد ✅');
      } catch (err) { toast(err.message, 'err'); }
    });
  }
  if (tab === 'password') {
    el.querySelector('[data-save-pass]')?.addEventListener('click', async () => {
      const current = el.querySelector('[data-p-current]').value;
      const password = el.querySelector('[data-p-new]').value;
      if (!current || !password) { toast('هر دو فیلد را پر کنید', 'err'); return; }
      try {
        await API.put('/auth/password', { current, password });
        toast('رمز عبور تغییر کرد ✅');
        el.querySelector('[data-p-current]').value = '';
        el.querySelector('[data-p-new]').value = '';
      } catch (err) { toast(err.message, 'err'); }
    });
  }
  if (tab === 'addresses') {
    el.querySelector('[data-new-addr]')?.addEventListener('click', () => {
      el.querySelector('#addr-form').style.display = 'grid';
    });
    el.querySelector('[data-save-addr]')?.addEventListener('click', async () => {
      const address = el.querySelector('[data-a-address]').value.trim();
      if (!address) { toast('آدرس را وارد کنید', 'err'); return; }
      try {
        await API.post('/auth/addresses', {
          title: el.querySelector('[data-a-title]').value.trim(),
          province: el.querySelector('[data-a-province]').value.trim(),
          city: el.querySelector('[data-a-city]').value.trim(),
          address,
          postal_code: el.querySelector('[data-a-postal]').value.trim(),
        });
        toast('آدرس ذخیره شد ✅');
        setTimeout(() => location.reload(), 500);
      } catch (err) { toast(err.message, 'err'); }
    });
    el.querySelectorAll('[data-del-addr]').forEach(b => b.addEventListener('click', async () => {
      await API.del('/auth/addresses/' + b.dataset.delAddr);
      toast('آدرس حذف شد');
      setTimeout(() => location.reload(), 400);
    }));
  }
}
