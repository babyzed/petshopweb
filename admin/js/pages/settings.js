// admin/pages/settings.js — تنظیمات فروشگاه: تماس، شبکه‌های اجتماعی، فوتر، ارسال
import { AdminAPI } from '../api.js';
import { toast } from '../components.js';
import { ic } from '../icons.js';

export async function render() {
  const s = await AdminAPI.get('/admin/settings');
  const c = s.contact || {}, soc = s.socials || {}, f = s.footer || {}, sh = s.shipping || {}, site = s.site || {}, pay = s.payment || { online_enabled: true, cod_enabled: true };
  const seo = s.seo || {}, torob = s.torob || {}, sms = s.sms || {};
  const feedBase = window.location.origin;
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

  <div class="a-card">
    <h3>${ic('megaphone', 18)} سئو (متاتگ‌ها و کلمات کلیدی)</h3>
    <p class="hint" style="margin-bottom:14px">این مقادیر در <b>متاتگ‌های صفحه اصلی</b> (title، description، keywords، Open Graph و لینک canonical) تزریق می‌شوند. محصولات و مقالات هم به‌صورت خودکار متاتگ اختصاصی می‌گیرند.</p>
    <div class="form-grid">
      <div class="field full"><label>عنوان سایت (title)</label><input data-seo-title value="${seo.title || ''}"></div>
      <div class="field full"><label>توضیحات متا (meta description)</label><textarea data-seo-desc rows="2">${seo.description || ''}</textarea></div>
      <div class="field full"><label>کلمات کلیدی (با کاما جدا کنید)</label><input data-seo-keywords value="${seo.keywords || ''}"></div>
      <div class="field"><label>نام سایت (og:site_name)</label><input data-seo-sitename value="${seo.site_name || ''}"></div>
      <div class="field"><label>تصویر اشتراک‌گذاری (og:image)</label><input data-seo-ogimage value="${seo.og_image || ''}" dir="ltr" placeholder="/assets/img/og-cover.webp"></div>
      <div class="field"><label>آدرس اصلی سایت (canonical)</label><input data-seo-canonical value="${seo.canonical_url || ''}" dir="ltr" placeholder="https://petshop.ir"></div>
      <div class="field"><label>شناسه گوگل آنالیتیکس (GA4)</label><input data-seo-ga value="${seo.ga_measurement_id || ''}" dir="ltr" placeholder="G-XXXXXXXXXX"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('chat', 18)} اتصال سرویس پیامکی (کاوه‌نگار)</h3>
    <p class="hint" style="margin-bottom:14px">با تنظیم کلید API، پیامک‌های تأیید سفارش، ارسال و تغییر وضعیت از همین سرویس ارسال می‌شوند.</p>
    ${sms.has_key ? '<p style="background:#D1FAE5;border:1px solid #A7F3D0;border-radius:10px;padding:10px 14px;font-size:12px;color:#065F46;margin-bottom:14px">✅ سرویس پیامکی متصل است.</p>' : '<p style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400E;margin-bottom:14px">⚠️ کلید API تنظیم نشده است.</p>'}
    <div class="form-grid">
      <div class="field"><label>کلید API کاوه‌نگار</label><input type="password" data-sms-key value="" dir="ltr" placeholder="••••••••"><p class="hint" style="margin-top:4px">${sms.has_key ? 'کلید قبلی ذخیره شده است؛ فقط برای تغییر، مقدار جدید وارد کنید.' : 'کلید را از پنل کاوه‌نگار دریافت کنید.'}</p></div>
      <div class="field"><label>شماره خط فرستنده</label><input data-sms-sender value="${sms.sender || ''}" dir="ltr" placeholder="1000xxx"></div>
      <div class="field"><label>شماره برای پیامک آزمایشی</label><input data-sms-test dir="ltr" placeholder="09123456789"></div>
      <div class="field" style="align-items:flex-start"><button class="btn btn-ghost" data-sms-test-btn style="margin-top:22px">${ic('mail', 15)} ارسال پیامک آزمایشی</button></div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('shoppingBag', 18)} اتصال به فروشگاه ترب (Torob)</h3>
    <p class="hint" style="margin-bottom:14px">آدرس فید محصولات را در پنل ترب ثبت کنید تا محصولات به‌صورت خودکار همگام شوند.</p>
    <div class="form-grid">
      <div class="field"><label class="sf-check"><input type="checkbox" data-torob-enabled ${torob.enabled === false ? '' : 'checked'}> فید ترب فعال باشد</label></div>
      <div class="field"><label>عنوان فروشگاه در فید</label><input data-torob-title value="${torob.title || ''}"></div>
      <div class="field full">
        <label>آدرس فید XML</label>
        <div style="display:flex;gap:8px">
          <input value="${feedBase}/api/torob/feed.xml" dir="ltr" readonly data-torob-url>
          <button class="btn btn-ghost" data-copy-torob type="button">${ic('clipboard', 15)} کپی</button>
        </div>
      </div>
    </div>
  </div>

  <button class="btn btn-primary btn-lg" data-save style="width:100%">${ic('settings', 16)} ذخیره همه تنظیمات</button>`;
}

export function after() {
  // کپی لینک فید ترب
  document.querySelector('[data-copy-torob]')?.addEventListener('click', () => {
    const input = document.querySelector('[data-torob-url]');
    navigator.clipboard?.writeText(input.value).then(() => toast('لینک فید کپی شد'));
  });

  // ارسال پیامک آزمایشی
  document.querySelector('[data-sms-test-btn]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const to = document.querySelector('[data-sms-test]').value.trim();
    if (!/^09\d{9}$/.test(to)) { toast('شماره موبایل معتبر وارد کنید', 'err'); return; }
    btn.disabled = true;
    try {
      await AdminAPI.post('/admin/sms/test', { to });
      toast('پیامک آزمایشی ارسال شد ✅');
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false;
  });

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
      seo: {
        title: document.querySelector('[data-seo-title]').value.trim(),
        description: document.querySelector('[data-seo-desc]').value.trim(),
        keywords: document.querySelector('[data-seo-keywords]').value.trim(),
        site_name: document.querySelector('[data-seo-sitename]').value.trim(),
        og_image: document.querySelector('[data-seo-ogimage]').value.trim(),
        canonical_url: document.querySelector('[data-seo-canonical]').value.trim(),
        ga_measurement_id: document.querySelector('[data-seo-ga]').value.trim(),
      },
      torob: {
        enabled: document.querySelector('[data-torob-enabled]').checked,
        title: document.querySelector('[data-torob-title]').value.trim(),
      },
      sms: {
        sender: document.querySelector('[data-sms-sender]').value.trim(),
        api_key: document.querySelector('[data-sms-key]').value.trim(),
      },
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
