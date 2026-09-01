// account-complete.js — تکمیل ثبت‌نام حساب مهمان (ساخته‌شده هنگام خرید)
// وقتی کاربر بدون ساخت حساب خرید می‌کند، فروشگاه برایش حساب خودکار می‌سازد.
// بعد از خرید یک پنجره باز می‌شود تا نام، شماره موبایل، ایمیل و رمز عبور را کامل کند.
import { API, escHtml } from './api.js';
import { Session } from './store.js';
import { toast, openModal } from './components.js';
import { ic } from './icons.js';

const PLACEHOLDER_DOMAIN = 'petshop.local';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^09\d{9}$/;
const PENDING_KEY = 'ps_pending_account_complete';

export function hasPlaceholderEmail(user = Session.user) {
  return !!user && String(user.email || '').trim().toLowerCase().endsWith('@' + PLACEHOLDER_DOMAIN);
}

export function hasPendingAccountCompletion() {
  return sessionStorage.getItem(PENDING_KEY) === '1';
}

export function markPendingAccountCompletion() {
  sessionStorage.setItem(PENDING_KEY, '1');
}

export function clearPendingAccountCompletion() {
  sessionStorage.removeItem(PENDING_KEY);
}

// اگر حساب مهمان هنوز ایمیل واقعی ندارد، پنجره تکمیل را باز کن
export function openAccountCompletionModal({ onDone } = {}) {
  if (!hasPlaceholderEmail()) {
    clearPendingAccountCompletion();
    return null;
  }

  const user = Session.user || {};
  const modal = openModal(`
    <div style="text-align:center;margin-bottom:14px">
      <div style="width:62px;height:62px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;border-radius:22px;background:var(--brand-soft,#FFF1E6);color:var(--brand-dark)">${ic('userPlus', 30)}</div>
      <h2 style="font-size:17px;font-weight:800;color:var(--ink)">تکمیل ثبت‌نام حساب شما</h2>
      <p style="font-size:12.5px;color:var(--muted);margin-top:6px">حساب شما برای پیگیری سفارش ساخته شد؛ برای ورودهای بعدی فقط این مشخصات را کامل کنید.</p>
    </div>
    <form class="form-grid" data-ac-form novalidate>
      <div class="field full">
        <label>نام و نام خانوادگی *</label>
        <input type="text" value="${escHtml(user.name || '')}" data-ac-name placeholder="مثلاً: سارا محمدی">
      </div>
      <div class="field full">
        <label>شماره موبایل *</label>
        <input type="tel" dir="ltr" value="${user.phone || ''}" data-ac-phone placeholder="09xxxxxxxxx">
      </div>
      <div class="field full">
        <label>ایمیل *</label>
        <input type="email" dir="ltr" value="${user.email || ''}" data-ac-email placeholder="you@example.com">
        <span class="err-msg" data-ac-email-err></span>
      </div>
      <div class="field full">
        <label>رمز عبور * (حداقل ۶ کاراکتر)</label>
        <input type="password" dir="ltr" data-ac-password placeholder="••••••••">
        <span class="err-msg" data-ac-pass-err></span>
      </div>
      <button class="btn btn-primary btn-block btn-lg full" type="submit" data-ac-submit style="grid-column:1/-1">${ic('check', 18)} تکمیل ثبت‌نام</button>
      <button class="btn btn-ghost full" type="button" data-ac-skip style="grid-column:1/-1">بعداً تکمیل می‌کنم</button>
    </form>
    <p style="font-size:11.5px;color:var(--muted);text-align:center;margin-top:12px">با این ایمیل و رمز می‌توانید دفعات بعد وارد حساب‌تان شوید.</p>
  `, { static: true });

  const body = modal.body;
  const form = body.querySelector('[data-ac-form]');
  body.querySelector('[data-ac-skip]')?.addEventListener('click', () => {
    clearPendingAccountCompletion();
    modal.close();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = body.querySelector('[data-ac-name]').value.trim();
    const phone = body.querySelector('[data-ac-phone]').value.trim();
    const email = body.querySelector('[data-ac-email]').value.trim();
    const password = body.querySelector('[data-ac-password]').value;

    if (!name) { toast('نام و نام خانوادگی را وارد کنید', 'err'); return; }
    if (!PHONE_RE.test(phone)) { toast('شماره موبایل معتبر وارد کنید (09...)', 'err'); return; }
    if (!EMAIL_RE.test(email)) { toast('ایمیل معتبر وارد کنید', 'err'); return; }
    if (password.length < 6) { toast('رمز عبور حداقل ۶ کاراکتر باشد', 'err'); return; }

    const btn = body.querySelector('[data-ac-submit]');
    btn.disabled = true;
    btn.textContent = '⏳ در حال ذخیره...';
    try {
      const r = await API.put('/auth/complete', { name, phone, email, password });
      if (r.user) Session.setUser(r.user);
      clearPendingAccountCompletion();
      toast('ثبت‌نام حساب شما کامل شد ✅');
      modal.close();
      if (typeof onDone === 'function') onDone(r.user);
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
      btn.innerHTML = ic('check', 18) + ' تکمیل ثبت‌نام';
    }
  });

  return modal;
}
