// pages/account.js — پنل کاربری: پروفایل، آدرس‌ها، سفارش‌ها، علاقه‌مندی‌ها، رمز
import { API, price, faNum, dateFa, timeFa } from '../api.js';
import { Session, Cart } from '../store.js';
import { toast, initials, productCard, productCardH } from '../components.js';
import { ic } from '../icons.js';
import { hasPlaceholderEmail, openAccountCompletionModal } from '../account-complete.js';

export function title() { return 'حساب کاربری | پت‌شاپ'; }

// نگه‌داری موقت آدرس‌ها برای ویرایش (بین render و mount)
let addrStore = [];
let editingAddrId = null;

export async function render(params, query) {
  if (!Session.isLoggedIn) {
    return `
    <div class="container">
      <div class="empty-state" style="background:var(--card);border:1px solid var(--line);border-radius:24px;margin:40px auto;max-width:520px">
        <div class="es-ic">${ic('lock', 34)}</div>
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
      </a>`).join('') : emptyState(ic('receipt', 34), 'هنوز سفارشی ثبت نکرده‌اید', 'از فروشگاه شروع کنید!');
  } else if (tab === 'wishlist') {
    const { ids } = await API.get('/auth/wishlist');
    let products = [];
    for (const id of ids) {
      try {
        const { product } = await API.get('/products/by-id/' + id);
        if (product) products.push(product);
      } catch (e) {}
    }
    tabContent = products.length
      ? `<div class="wish-grid">${products.map(p => window.innerWidth <= 900 ? productCardH(p) : productCard(p)).join('')}</div>`
      : emptyState(ic('heart', 30), 'علاقه‌مندی‌ها خالی است', 'روی قلب محصولات بزنید تا اینجا ذخیره شوند');
  } else if (tab === 'addresses') {
    const { addresses } = await API.get('/auth/addresses');
    addrStore = addresses;
    tabContent = `
      <div id="addr-box">
        ${addresses.length ? addresses.map(a => `
          <div class="order-card" style="align-items:flex-start">
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:13.5px">${a.title || 'آدرس'} ${a.is_default ? '<span class="order-status os-delivered" style="margin-inline-start:8px">پیش‌فرض</span>' : ''}</div>
              <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${a.full_name} — ${a.phone}</div>
              <div style="font-size:12.5px;color:var(--muted)">${a.province} ${a.city} — ${a.address} — ${a.postal_code}</div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0">
              <button class="btn btn-outline" data-edit-addr="${a.id}" style="font-size:12px;padding:8px 14px">ویرایش</button>
              <button class="btn btn-ghost" data-del-addr="${a.id}" style="font-size:12px;padding:8px 14px;color:var(--danger)">حذف</button>
            </div>
          </div>`).join('') : emptyState(ic('pin', 30), 'آدرسی ثبت نشده', 'آدرس جدید اضافه کنید')}
      </div>
      <button class="btn btn-primary" data-new-addr style="margin-top:10px">+ آدرس جدید</button>
      <div class="form-grid" id="addr-form" style="display:none;margin-top:14px">
        <div class="field"><label>نام و نام خانوادگی *</label><input data-a-fullname placeholder="نام گیرنده"></div>
        <div class="field"><label>شماره تلفن *</label><input data-a-phonenum dir="ltr" placeholder="09xxxxxxxxx"></div>
        <div class="field"><label>عنوان</label><input data-a-title placeholder="منزل"></div>
        <div class="field"><label>کد پستی</label><input data-a-postal dir="ltr" placeholder="1234567890"></div>
        <div class="field"><label>استان</label><input data-a-province placeholder="مثلاً: تهران"></div>
        <div class="field"><label>شهر</label><input data-a-city placeholder="مثلاً: تهران"></div>
        <div class="field full"><label>آدرس کامل *</label><textarea data-a-address rows="2" placeholder="خیابان، کوچه، پلاک..."></textarea></div>
        <div class="field full" style="display:flex;gap:10px">
          <button class="btn btn-primary" data-save-addr>ذخیره آدرس</button>
          <button class="btn btn-ghost" data-cancel-addr style="display:none">انصراف</button>
        </div>
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
      ${hasPlaceholderEmail(u) ? `
      <div class="auth-note" style="margin-bottom:14px;border:1px solid #FED7AA;background:#FFF7ED">
        <span class="an-ic">${ic('userPlus', 14)}</span>
        <span>حساب شما هنوز ناقص است. ایمیل و رمز واقعی را مشخص کنید تا واردهای بعدی راحت‌تر شود.</span>
        <button class="btn btn-primary" data-open-account-complete style="padding:7px 14px;font-size:12px;margin-inline-start:auto;flex-shrink:0">تکمیل ثبت‌نام</button>
      </div>
      ` : ''}
      <div class="form-grid" style="max-width:520px">
        <div class="field"><label>نام و نام خانوادگی *</label><input value="${u.name || ''}" data-p-name></div>
        <div class="field"><label>شماره موبایل</label><input value="${u.phone || ''}" dir="ltr" data-p-phone></div>
        <div class="field"><label>ایمیل</label><input type="email" value="${u.email || ''}" dir="ltr" data-p-email placeholder="you@example.com"><span class="err-msg" data-err="email"></span></div>
        <div class="field full"><button class="btn btn-primary" data-save-profile>ذخیره تغییرات</button></div>
      </div>
      <div class="auth-note" style="margin-top:18px">
        <span class="an-ic">${ic('paw', 14)}</span>
        <span>عضو پت‌شاپ از ${dateFa(u.created_at)} — ممنون که با ما هستید!</span>
      </div>`;
  }

  const tabs = [
    ['profile', ic('user', 17), 'اطلاعات حساب'],
    ['orders', ic('package', 17), 'سفارش‌های من'],
    ['wishlist', ic('heart', 17), 'علاقه‌مندی‌ها'],
    ['addresses', ic('pin', 17), 'آدرس‌ها'],
    ['password', ic('lock', 17), 'تغییر رمز'],
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
        <a href="#" data-logout style="color:var(--danger)"><span>${ic('logout', 17)}</span>خروج از حساب</a>
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
    el.querySelector('[data-open-account-complete]')?.addEventListener('click', () => openAccountCompletionModal({ onDone: () => setTimeout(() => location.reload(), 300) }));
    el.querySelector('[data-save-profile]')?.addEventListener('click', async () => {
      const email = el.querySelector('[data-p-email]')?.value.trim() || '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast('ایمیل معتبر وارد کنید', 'err');
        return;
      }
      try {
        const r = await API.put('/auth/profile', {
          name: el.querySelector('[data-p-name]').value.trim(),
          phone: el.querySelector('[data-p-phone]').value.trim(),
          email,
        });
        Session.setUser(r.user);
        toast('پروفایل به‌روزرسانی شد');
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
        toast('رمز عبور تغییر کرد');
        el.querySelector('[data-p-current]').value = '';
        el.querySelector('[data-p-new]').value = '';
      } catch (err) { toast(err.message, 'err'); }
    });
  }
  if (tab === 'addresses') {
    const form = el.querySelector('#addr-form');
    const saveBtn = el.querySelector('[data-save-addr]');
    const cancelBtn = el.querySelector('[data-cancel-addr]');
    const fields = {
      fullname: el.querySelector('[data-a-fullname]'),
      phone: el.querySelector('[data-a-phonenum]'),
      title: el.querySelector('[data-a-title]'),
      postal: el.querySelector('[data-a-postal]'),
      province: el.querySelector('[data-a-province]'),
      city: el.querySelector('[data-a-city]'),
      address: el.querySelector('[data-a-address]'),
    };

    const fillForm = (a) => {
      fields.fullname.value = a.full_name || '';
      fields.phone.value = a.phone || '';
      fields.title.value = a.title || '';
      fields.postal.value = a.postal_code || '';
      fields.province.value = a.province || '';
      fields.city.value = a.city || '';
      fields.address.value = a.address || '';
    };
    const resetForm = () => {
      Object.values(fields).forEach(f => f.value = '');
      editingAddrId = null;
      saveBtn.textContent = 'ذخیره آدرس';
      cancelBtn.style.display = 'none';
    };

    el.querySelector('[data-new-addr]')?.addEventListener('click', () => {
      resetForm();
      form.style.display = 'grid';
      window.scrollTo({ top: form.offsetTop - 90, behavior: 'smooth' });
    });

    el.querySelectorAll('[data-edit-addr]').forEach(b => b.addEventListener('click', () => {
      const a = addrStore.find(x => String(x.id) === String(b.dataset.editAddr));
      if (!a) return;
      editingAddrId = a.id;
      fillForm(a);
      form.style.display = 'grid';
      saveBtn.textContent = 'ذخیره تغییرات';
      cancelBtn.style.display = 'inline-flex';
      window.scrollTo({ top: form.offsetTop - 90, behavior: 'smooth' });
    }));

    cancelBtn?.addEventListener('click', () => { form.style.display = 'none'; resetForm(); });

    saveBtn?.addEventListener('click', async () => {
      const full_name = fields.fullname.value.trim();
      const phone = fields.phone.value.trim();
      const address = fields.address.value.trim();
      if (!full_name) { toast('نام و نام خانوادگی را وارد کنید', 'err'); return; }
      if (!phone) { toast('شماره تلفن را وارد کنید', 'err'); return; }
      if (!address) { toast('آدرس را وارد کنید', 'err'); return; }
      const payload = {
        full_name,
        phone,
        title: fields.title.value.trim(),
        province: fields.province.value.trim(),
        city: fields.city.value.trim(),
        address,
        postal_code: fields.postal.value.trim(),
      };
      try {
        if (editingAddrId) {
          await API.put('/auth/addresses/' + editingAddrId, payload);
          toast('آدرس ویرایش شد');
        } else {
          await API.post('/auth/addresses', payload);
          toast('آدرس ذخیره شد');
        }
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
