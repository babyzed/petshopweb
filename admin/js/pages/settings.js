// admin/pages/settings.js — تنظیمات فروشگاه: تماس، شبکه‌های اجتماعی، فوتر، ارسال
import { AdminAPI } from '../api.js';
import { toast } from '../components.js';
import { ic } from '../icons.js';

export async function render() {
  const s = await AdminAPI.get('/admin/settings');
  const c = s.contact || {}, soc = s.socials || {}, f = s.footer || {}, sh = s.shipping || {}, site = s.site || {}, pay = s.payment || { online_enabled: true, cod_enabled: true };
  return `
  <div class="a-card">
    <h3>${ic('store', 18)} اطلاعات پایه</h3>
    <div class="form-grid">
      <div class="field"><label>نام فروشگاه</label><input data-site-name value="${site.name || ''}"></div>
      <div class="field"><label>شعار</label><input data-site-slogan value="${site.slogan || ''}"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('phone', 18)} اطلاعات تماس</h3>
    <div class="form-grid">
      <div class="field"><label>تلفن ثابت</label><input data-phone value="${c.phone || ''}" dir="ltr"></div>
      <div class="field"><label>موبایل</label><input data-mobile value="${c.mobile || ''}" dir="ltr"></div>
      <div class="field"><label>ایمیل</label><input data-email value="${c.email || ''}" dir="ltr"></div>
      <div class="field"><label>ساعات کاری</label><input data-hours value="${c.work_hours || ''}"></div>
      <div class="field full"><label>آدرس</label><input data-address value="${c.address || ''}"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('externalLink', 18)} شبکه‌های اجتماعی</h3>
    <div class="form-grid">
      <div class="field"><label>اینستاگرام</label><input data-instagram value="${soc.instagram || ''}" dir="ltr"></div>
      <div class="field"><label>تلگرام</label><input data-telegram value="${soc.telegram || ''}" dir="ltr"></div>
      <div class="field"><label>واتساپ</label><input data-whatsapp value="${soc.whatsapp || ''}" dir="ltr"></div>
      <div class="field"><label>یوتیوب</label><input data-youtube value="${soc.youtube || ''}" dir="ltr"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('truck', 18)} هزینه ارسال</h3>
    <div class="form-grid">
      <div class="field"><label>هزینه ارسال (تومان)</label><input type="number" min="0" data-ship-cost value="${sh.cost || 0}"></div>
      <div class="field"><label>ارسال رایگان برای خرید بالای (تومان)</label><input type="number" min="0" data-ship-free value="${sh.free_over || 0}"></div>
      <div class="field full"><label>پیام ارسال</label><input data-ship-msg value="${sh.message || ''}"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('creditCard', 18)} تنظیمات پرداخت</h3>
    ${!pay.saman_configured ? `<p style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400E;margin-bottom:14px">⚠️ درگاه پرداخت سامان (SAMAN_TERMINAL_ID) تنظیم نشده است. پرداخت آنلاین غیرفعال است.</p>` : ''}
    <div class="form-grid">
      <div class="field">
        <label class="sf-check"><input type="checkbox" data-pay-online ${pay.online_enabled ? 'checked' : ''} ${!pay.saman_configured ? 'disabled' : ''}> پرداخت آنلاین (درگاه بانکی)</label>
        <p class="hint" style="margin-top:4px">${pay.saman_configured ? 'فعال‌سازی امکان پرداخت از طریق درگاه بانکی سامان' : 'برای فعال‌سازی، ابتدا SAMAN_TERMINAL_ID را در فایل .env تنظیم کنید'}</p>
      </div>
      <div class="field">
        <label class="sf-check"><input type="checkbox" data-pay-cod ${pay.cod_enabled ? 'checked' : ''}> پرداخت در محل (COD)</label>
        <p class="hint" style="margin-top:4px">فعال‌سازی پرداخت نقدی هنگام تحویل سفارش</p>
      </div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('home', 18)} فوتر</h3>
    <div class="form-grid">
      <div class="field full"><label>متن معرفی فوتر</label><textarea data-footer-desc rows="3">${f.description || ''}</textarea></div>
      <div class="field full">
        <label>نشان‌های اعتماد (فرمت: آیکون | عنوان)</label>
        <div data-badges>
          ${(f.badges || []).map((b, i) => `
            <div class="feat-row">
              <input placeholder="آیکون" data-b-icon value="${b.icon}" style="width:70px">
              <input placeholder="عنوان" data-b-title value="${b.title}">
              <button class="btn btn-ghost" data-badge-del style="color:var(--danger)">${ic('x', 14)}</button>
            </div>`).join('')}
        </div>
        <button class="btn btn-ghost" data-badge-add style="margin-top:6px">${ic('plus', 14)} نشان</button>
      </div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('barChart3', 18)} آمار اولیه سایت</h3>
    <p class="hint" style="margin-bottom:12px">آمار قبلی سایت را اینجا وارد کنید. این آمار با آمار واقعی جمع می‌شوند.</p>
    <div class="form-grid">
      <div class="field"><label>سال فعالیت (قبل از راه‌اندازی آنلاین)</label><input type="number" min="0" data-is-years value="${s.initialStats?.years || 0}"></div>
      <div class="field"><label>تعداد مشتریان قبلی</label><input type="number" min="0" data-is-customers value="${s.initialStats?.customers || 0}"></div>
      <div class="field"><label>درصد رضایت مشتری (۰ تا ۱۰۰)</label><input type="number" min="0" max="100" data-is-satisfaction value="${s.initialStats?.satisfaction || 0}"></div>
      <div class="field"><label>سال تاسیس</label><input type="number" min="1300" max="1500" data-is-founded value="${s.initialStats?.founded_year || 1402}"></div>
    </div>
  </div>

  <button class="btn btn-primary btn-lg" data-save style="width:100%">${ic('settings', 16)} ذخیره همه تنظیمات</button>`;
}

export function after() {
  document.querySelector('[data-badge-add]').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'feat-row';
    row.innerHTML = `
      <input placeholder="آیکون" data-b-icon style="width:70px">
      <input placeholder="عنوان" data-b-title>
      <button class="btn btn-ghost" data-badge-del style="color:var(--danger)">${ic('x', 14)}</button>`;
    document.querySelector('[data-badges]').appendChild(row);
    row.querySelector('[data-badge-del]').addEventListener('click', () => row.remove());
  });
  document.querySelectorAll('[data-badge-del]').forEach(b => b.addEventListener('click', () => b.closest('.feat-row').remove()));

  document.querySelector('[data-save]').addEventListener('click', async (btn) => {
    const badges = [...document.querySelectorAll('[data-badges] .feat-row')].map(r => ({
      icon: r.querySelector('[data-b-icon]').value.trim(),
      title: r.querySelector('[data-b-title]').value.trim(),
    })).filter(b => b.title);
    const body = {
      site: { name: document.querySelector('[data-site-name]').value.trim(), slogan: document.querySelector('[data-site-slogan]').value.trim() },
      contact: {
        phone: document.querySelector('[data-phone]').value.trim(),
        mobile: document.querySelector('[data-mobile]').value.trim(),
        email: document.querySelector('[data-email]').value.trim(),
        work_hours: document.querySelector('[data-hours]').value.trim(),
        address: document.querySelector('[data-address]').value.trim(),
      },
      socials: {
        instagram: document.querySelector('[data-instagram]').value.trim(),
        telegram: document.querySelector('[data-telegram]').value.trim(),
        whatsapp: document.querySelector('[data-whatsapp]').value.trim(),
        youtube: document.querySelector('[data-youtube]').value.trim(),
      },
      shipping: {
        cost: Number(document.querySelector('[data-ship-cost]').value) || 0,
        free_over: Number(document.querySelector('[data-ship-free]').value) || 0,
        message: document.querySelector('[data-ship-msg]').value.trim(),
      },
      payment: {
        online_enabled: document.querySelector('[data-pay-online]').checked,
        cod_enabled: document.querySelector('[data-pay-cod]').checked,
      },
      footer: { description: document.querySelector('[data-footer-desc]').value.trim(), badges },
    };
    // آمار اولیه
    const initialStats = {
      years: Number(document.querySelector('[data-is-years]').value) || 0,
      customers: Number(document.querySelector('[data-is-customers]').value) || 0,
      satisfaction: Number(document.querySelector('[data-is-satisfaction]').value) || 0,
      founded_year: Number(document.querySelector('[data-is-founded]').value) || 1402,
    };
    btn.disabled = true;
    try {
      await AdminAPI.put('/admin/settings', body);
      await AdminAPI.put('/admin/initial-stats', initialStats);
      toast('تنظیمات ذخیره شد ✅');
      btn.disabled = false;
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
}
