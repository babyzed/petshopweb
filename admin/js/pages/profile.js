// admin/pages/profile.js — پروفایل مدیر
import { AdminAPI } from '../api.js';
import { toast } from '../components.js';
import { ic } from '../icons.js';

export function render() {
  const u = AdminAPI.user;
  return `
  <div class="a-card" style="max-width:560px">
    <h3>${ic('user', 18)} پروفایل مدیر</h3>
    <div class="form-grid">
      <div class="field full"><label>نام</label><input value="${u?.name || ''}" disabled></div>
      <div class="field full"><label>ایمیل</label><input value="${u?.email || ''}" dir="ltr" disabled></div>
      <div class="field full"><label>نقش</label><input value="${u?.role_title || ''}" disabled></div>
      <div class="field full"><label>رمز عبور فعلی *</label><input type="password" dir="ltr" data-current></div>
      <div class="field full"><label>رمز عبور جدید * (حداقل ۶ کاراکتر)</label><input type="password" dir="ltr" data-new></div>
    </div>
    <button class="btn btn-primary" data-save style="margin-top:14px">${ic('settings', 16)} تغییر رمز عبور</button>
  </div>`;
}

export function after() {
  document.querySelector('[data-save]').addEventListener('click', async () => {
    const current = document.querySelector('[data-current]').value;
    const password = document.querySelector('[data-new]').value;
    if (!current || !password) { toast('هر دو فیلد را پر کنید', 'err'); return; }
    try {
      await AdminAPI.put('/admin/profile/password', { current, password });
      toast('رمز عبور تغییر کرد ✅');
      document.querySelector('[data-current]').value = '';
      document.querySelector('[data-new]').value = '';
    } catch (err) { toast(err.message, 'err'); }
  });
}
