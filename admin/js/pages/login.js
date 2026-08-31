// admin/pages/login.js — ورود مدیر
import { AdminAPI } from '../api.js';
import { toast } from '../components.js';
import { ic } from '../icons.js';

export function render() {
  return `
  <div class="admin-login">
    <span class="al-paw p1">🐾</span>
    <span class="al-paw p2">🐾</span>
    <div class="admin-login-box">
      <div class="logo-icon">${ic('paw', 30)}</div>
      <h1>ورود به پنل مدیریت</h1>
      <p class="sub">پت‌شاپ — پنل مدیریت فروشگاه</p>
      <form data-login-form>
        <div class="field">
          <label>ایمیل</label>
          <input type="email" name="email" dir="ltr" placeholder="admin@petshop.ir" required value="admin@petshop.ir">
        </div>
        <div class="field">
          <label>رمز عبور</label>
          <input type="password" name="password" dir="ltr" placeholder="••••••••" required>
        </div>
        <button class="btn btn-primary btn-block btn-lg" type="submit">${ic('lock', 16)} ورود به پنل</button>
      </form>
    </div>
  </div>`;
}

export function after() {
  const form = document.querySelector('[data-login-form]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '⏳ در حال بررسی...';
    try {
      const r = await AdminAPI.post('/auth/login', { email: form.email.value.trim(), password: form.password.value });
      if (!r.user.is_admin) throw new Error('این حساب دسترسی مدیریت ندارد.');
      AdminAPI.setSession(r.token, r.user);
      toast('خوش آمدید! 🎉');
      location.hash = '#/dashboard';
      location.reload();
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.textContent = 'ورود به پنل';
    }
  });
}
