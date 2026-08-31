// pages/auth.js — ورود / ثبت‌نام / فراموشی رمز — طراحی اختصاصی پت‌شاپ
import { API } from '../api.js';
import { Session } from '../store.js';
import { toast } from '../components.js';
import { ic } from '../icons.js';

let mode = 'login'; // login | register | forgot

export function title() { return 'ورود | پت‌شاپ'; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function render() {
  return `
  <div class="auth-page">
    <span class="auth-bg-paw p1">${ic('paw', 90)}</span>
    <span class="auth-bg-paw p2">${ic('paw', 64)}</span>
    <span class="auth-bg-paw p3">${ic('paw', 76)}</span>

    <div class="auth-card" data-auth-card>
      <div class="auth-pet" data-auth-pet>${ic('paw', 56)}</div>
      <h1 class="auth-title" data-auth-title>${mode === 'login' ? 'خوش برگشتید!' : mode === 'register' ? 'به خانواده پت‌شاپ بپیوندید' : 'بازیابی رمز عبور'}</h1>
      <p class="auth-sub" data-auth-sub>
        ${mode === 'login' ? 'برای ادامه، وارد حساب‌تان شوید' : mode === 'register' ? 'ثبت‌نام فقط ۳۰ ثانیه طول می‌کشد' : 'کد بازیابی را به ایمیل‌تان ارسال می‌کنیم'}
      </p>

      <div class="auth-tabs" data-auth-tabs>
        <button class="auth-tab ${mode === 'login' ? 'active' : ''}" data-mode="login">ورود</button>
        <button class="auth-tab ${mode === 'register' ? 'active' : ''}" data-mode="register">ثبت‌نام</button>
      </div>

      <form class="auth-form" data-auth-form novalidate>
        <div data-fields></div>
        <button class="btn btn-primary btn-block btn-lg auth-submit" type="submit" data-submit>
          ${mode === 'login' ? 'ورود به حساب' : mode === 'register' ? 'ساخت حساب جدید' : 'ارسال کد بازیابی'}
        </button>
      </form>

      <div class="auth-alt" data-auth-alt></div>
    </div>
  </div>`;
}

function fieldsHtml(m) {
  if (m === 'register') return `
    <div class="field">
      <label>نام و نام خانوادگی *</label>
      <input type="text" name="name" placeholder="مثلاً: سارا محمدی" autocomplete="name">
      <span class="err-msg" data-err="name"></span>
    </div>
    <div class="field">
      <label>شماره موبایل</label>
      <input type="tel" name="phone" dir="ltr" placeholder="09xxxxxxxxx" autocomplete="tel">
      <span class="err-msg" data-err="phone"></span>
    </div>
    <div class="field">
      <label>ایمیل *</label>
      <input type="email" name="email" dir="ltr" placeholder="you@example.com" autocomplete="email">
      <span class="err-msg" data-err="email"></span>
    </div>
    <div class="field">
      <label>رمز عبور * (حداقل ۶ کاراکتر)</label>
      <input type="password" name="password" dir="ltr" placeholder="••••••••" autocomplete="new-password">
      <span class="err-msg" data-err="password"></span>
    </div>`;
  if (m === 'forgot') return `
    <div class="field">
      <label>ایمیل حساب شما *</label>
      <input type="email" name="email" dir="ltr" placeholder="you@example.com">
      <span class="err-msg" data-err="email"></span>
    </div>`;
  return `
    <div class="field">
      <label>ایمیل *</label>
      <input type="email" name="email" dir="ltr" placeholder="you@example.com" autocomplete="email">
      <span class="err-msg" data-err="email"></span>
    </div>
    <div class="field">
      <label>رمز عبور *</label>
      <input type="password" name="password" dir="ltr" placeholder="••••••••" autocomplete="current-password">
      <span class="err-msg" data-err="password"></span>
    </div>`;
}

function altHtml(m) {
  if (m === 'login') return `رمز عبور را فراموش کرده‌اید؟ <button type="button" data-mode="forgot">بازیابی رمز</button>`;
  if (m === 'forgot') return `<button type="button" data-mode="login">بازگشت به ورود</button>`;
  return `قبلاً ثبت‌نام کرده‌اید؟ <button type="button" data-mode="login">وارد شوید</button>`;
}

export function mount(el) {
  const card = el.querySelector('[data-auth-card]');
  let petFlip = 0;

  const setMode = (m) => {
    mode = m;
    const title = { login: 'خوش برگشتید!', register: 'به خانواده پت‌شاپ بپیوندید', forgot: 'بازیابی رمز عبور' }[m];
    const sub = { login: 'برای ادامه، وارد حساب‌تان شوید', register: 'ثبت‌نام فقط ۳۰ ثانیه طول می‌کشد', forgot: 'کد بازیابی را به ایمیل‌تان ارسال می‌کنیم' }[m];
    card.querySelector('[data-auth-title]').textContent = title;
    card.querySelector('[data-auth-sub]').textContent = sub;
    card.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    card.querySelector('[data-fields]').innerHTML = fieldsHtml(m);
    card.querySelector('[data-auth-alt]').innerHTML = altHtml(m);
    card.querySelector('[data-submit]').textContent = m === 'login' ? 'ورود به حساب' : m === 'register' ? 'ساخت حساب جدید' : 'ارسال کد بازیابی';
    card.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); animatePet(); }));
    // انیمیشن کوچک هنگام تغییر تب
    card.style.animation = 'none';
    requestAnimationFrame(() => { card.style.animation = 'cardIn .4s cubic-bezier(.34,1.3,.64,1)'; });
  };

  const animatePet = () => {
    const pets = ['paw', 'heart', 'star', 'sparkles', 'flame'];
    const pet = card.querySelector('[data-auth-pet]');
    petFlip = (petFlip + 1) % pets.length;
    pet.innerHTML = ic(pets[petFlip], 56);
    pet.style.transform = 'scale(1.25) rotate(-8deg)';
    setTimeout(() => { pet.style.transform = ''; pet.style.transition = 'transform .3s'; }, 120);
  };

  setMode(mode);

  // چرخش پت با کلیک (Micro interaction)
  const pet = card.querySelector('[data-auth-pet]');
  pet.style.cursor = 'pointer';
  pet.title = 'کلیک کن!';
  pet.addEventListener('click', animatePet);

  const form = card.querySelector('[data-auth-form]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = Object.fromEntries(fd);
    const errs = {};

    // اعتبارسنجی
    if (mode !== 'forgot') {
      if (!body.email || !EMAIL_RE.test(body.email)) errs.email = 'ایمیل معتبر وارد کنید.';
      if (!body.password || body.password.length < 6) errs.password = 'رمز عبور حداقل ۶ کاراکتر باشد.';
    } else {
      if (!body.email || !EMAIL_RE.test(body.email)) errs.email = 'ایمیل معتبر وارد کنید.';
    }
    if (mode === 'register') {
      if (!body.name?.trim()) errs.name = 'نام و نام خانوادگی را وارد کنید.';
      if (body.phone && !/^09\d{9}$/.test(body.phone)) errs.phone = 'شماره موبایل معتبر نیست (09...).';
    }
    Object.entries(errs).forEach(([k, v]) => {
      const el = form.querySelector(`[data-err="${k}"]`);
      if (el) { el.textContent = v; el.style.display = 'block'; }
    });
    if (Object.keys(errs).length) return;

    // پاک کردن خطاها
    form.querySelectorAll('[data-err]').forEach(el => { el.textContent = ''; el.style.display = 'none'; });

    const btn = form.querySelector('[data-submit]');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = '⏳ ...';

    try {
      if (mode === 'login') {
        const r = await API.post('/auth/login', { email: body.email, password: body.password });
        API.setToken(r.token);
        Session.setUser(r.user);
        toast('خوش آمدید!');
        location.hash = r.user.is_admin ? '#/account' : '#/account';
        if (r.user.is_admin) setTimeout(() => { if (confirm('به پنل مدیریت بروید؟')) location.hash = '/admin/'; }, 600);
      } else if (mode === 'register') {
        const r = await API.post('/auth/register', body);
        API.setToken(r.token);
        Session.setUser(r.user);
        toast('حساب شما ساخته شد؛ خوش آمدید!');
        location.hash = '#/account';
      } else {
        const r = await API.post('/auth/forgot', { email: body.email });
        // نمایش کد دمو
        card.querySelector('[data-fields]').innerHTML = `
          <div class="field">
            <label>کد بازیابی (ارسال‌شده به ایمیل) *</label>
            <input type="text" name="code" dir="ltr" placeholder="۶ رقم">
            <span class="err-msg" data-err="code"></span>
          </div>
          <div class="field">
            <label>رمز عبور جدید *</label>
            <input type="password" name="password" dir="ltr" placeholder="••••••••">
            <span class="err-msg" data-err="password"></span>
          </div>`;
        card.querySelector('[data-submit]').textContent = 'تغییر رمز عبور';
        const resetSubmit = async () => {
          const code = form.code.value.trim();
          const pass = form.password.value;
          if (code.length !== 6) { toast('کد ۶ رقمی را وارد کنید', 'err'); return; }
          if (pass.length < 6) { toast('رمز جدید حداقل ۶ کاراکتر باشد', 'err'); return; }
          try {
            await API.post('/auth/reset', { email: body.email, code, password: pass });
            toast('رمز عبور با موفقیت تغییر کرد');
            setMode('login');
          } catch (err) { toast(err.message, 'err'); }
        };
        form.onsubmit = (e) => { e.preventDefault(); resetSubmit(); };
        if (r.demo_code) { toast('کد بازیابی ایمیل شد', 'info'); }
      }
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = original;
    }
  });
}
