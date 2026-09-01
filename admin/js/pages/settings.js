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
    ${!pay.online_available ? `<p style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400E;margin-bottom:14px">⚠️ هیچ درگاه پرداختی پیکربندی نشده است. تا زمانی که اطلاعات یکی از درگاه‌های زیر تکمیل نشود، پرداخت آنلاین در فروشگاه نمایش داده نمی‌شود.</p>` : ''}
    <div class="form-grid">
      <div class="field">
        <label class="sf-check"><input type="checkbox" data-pay-online ${pay.online_enabled ? 'checked' : ''}> پرداخت آنلاین (درگاه بانکی)</label>
        <p class="hint" style="margin-top:4px">نمایش گزینهٔ پرداخت آنلاین در تسویه حساب</p>
      </div>
      <div class="field">
        <label class="sf-check"><input type="checkbox" data-pay-cod ${pay.cod_enabled ? 'checked' : ''}> پرداخت در محل (COD)</label>
        <p class="hint" style="margin-top:4px">فعال‌سازی پرداخت نقدی هنگام تحویل سفارش</p>
      </div>
      <div class="field">
        <label>درگاه فعال</label>
        <select data-pay-gateway>
          ${(pay.gateways || []).map(g => `<option value="${g.key}" ${g.key === pay.gateway ? 'selected' : ''}>${g.label}${g.configured ? '' : ' — تنظیم نشده'}</option>`).join('')}
        </select>
        <p class="hint" style="margin-top:4px">همهٔ سفارش‌های آنلاین از این درگاه پرداخت می‌شوند.</p>
      </div>
      <div class="field">
        <label>آدرس بازگشت از بانک (Callback)</label>
        <input data-pay-callback value="${pay.callback_url || ''}" dir="ltr" placeholder="https://yourdomain.com/api/payments/callback">
        <p class="hint" style="margin-top:4px">همین آدرس را در پنل پذیرندگی بانک ثبت کنید.</p>
      </div>
    </div>

    <h4 style="margin:18px 0 10px;font-size:14px;font-weight:800">اطلاعات درگاه‌ها</h4>
    ${(pay.gateways || []).map(g => `
      <div class="a-card" style="box-shadow:none;border:1px solid var(--line);margin-bottom:12px" data-gw-card="${g.key}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <b style="font-size:13.5px">${g.label} ${g.configured ? '<span style="color:#059669;font-size:11.5px">● پیکربندی شده</span>' : '<span style="color:#B45309;font-size:11.5px">● تنظیم نشده</span>'}</b>
          <button class="btn btn-ghost" data-gw-test="${g.key}" type="button">${ic('refreshCw', 14)} تست اتصال</button>
        </div>
        <div class="form-grid" style="margin-top:10px">
          ${g.fields.map(f => f.type === 'boolean'
            ? `<div class="field"><label class="sf-check"><input type="checkbox" data-gw-field="${g.key}.${f.key}" ${g.values[f.key] ? 'checked' : ''}> ${f.label}</label></div>`
            : `<div class="field"><label>${f.label}</label><input ${f.secret ? 'type="password"' : ''} data-gw-field="${g.key}.${f.key}" value="${f.secret ? '' : (g.values[f.key] || '')}" dir="ltr" placeholder="${f.secret && g.values[f.key] ? '••••••••' : ''}">${f.secret ? `<p class="hint" style="margin-top:4px">${g.values[f.key] ? 'مقدار قبلی ذخیره شده؛ برای تغییر مقدار جدید وارد کنید.' : ''}</p>` : ''}</div>`
          ).join('')}
        </div>
        <div data-gw-result="${g.key}" style="font-size:12.5px;color:var(--muted);margin-top:6px"></div>
      </div>`).join('')}
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
    <h3>${ic('chat', 18)} اتصال سرویس پیامکی (آموت — AmootSMS)</h3>
    <p class="hint" style="margin-bottom:14px">توکن REST را از پنل آموت (وب‌سرویس ← توکن‌ها) بسازید. سه سرویس زیر از همین اتصال استفاده می‌کنند: <b>ارسال کد تایید</b>، <b>پیامک تستی/خدماتی</b> و <b>پیامک تبلیغاتی</b>.</p>
    ${sms.has_key ? '<p style="background:#D1FAE5;border:1px solid #A7F3D0;border-radius:10px;padding:10px 14px;font-size:12px;color:#065F46;margin-bottom:14px">✅ سرویس پیامک آموت متصل است.</p>' : '<p style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 14px;font-size:12px;color:#92400E;margin-bottom:14px">⚠️ توکن آموت تنظیم نشده است؛ پیامک‌ها فقط در لاگ سرور ثبت می‌شوند.</p>'}
    <div class="form-grid">
      <div class="field full"><label>توکن وب‌سرویس آموت (Token)</label><input type="password" data-sms-token value="" dir="ltr" placeholder="••••••••"><p class="hint" style="margin-top:4px">${sms.has_key ? 'توکن قبلی ذخیره شده است؛ فقط برای تغییر، مقدار جدید وارد کنید.' : 'توکن را از پنل آموت دریافت کنید.'}</p></div>
      <div class="field"><label>خط خدماتی (پیامک سفارش‌ها)</label><input data-sms-line-service value="${sms.line_service || ''}" dir="ltr" placeholder="public"></div>
      <div class="field"><label>خط ارسال کد تایید</label><input data-sms-line-otp value="${sms.line_otp || ''}" dir="ltr" placeholder="public"></div>
      <div class="field"><label>خط تبلیغاتی</label><input data-sms-line-ads value="${sms.line_ads || ''}" dir="ltr" placeholder="خط تبلیغاتی اختصاصی"></div>
      <div class="field"><label>کد الگوی کد تایید (اختیاری)</label><input data-sms-pattern value="${sms.otp_pattern_id || ''}" dir="ltr" placeholder="مثلاً 1234"><p class="hint" style="margin-top:4px">در صورت تنظیم، کد تایید با متد SendWithPattern ارسال می‌شود.</p></div>
      <div class="field"><button class="btn btn-ghost" data-sms-status-btn style="margin-top:22px">${ic('refreshCw', 15)} بررسی اتصال و اعتبار</button></div>
    </div>
    <div data-sms-status style="font-size:12.5px;color:var(--muted);margin-top:6px"></div>

    <h4 style="margin:20px 0 10px;font-size:14px;font-weight:800">آزمایش سرویس‌ها</h4>
    <div class="form-grid">
      <div class="field"><label>شماره موبایل برای آزمایش</label><input data-sms-test dir="ltr" placeholder="09123456789"></div>
      <div class="field" style="align-items:flex-start;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" data-sms-test-btn style="margin-top:22px">${ic('mail', 15)} پیامک تستی</button>
        <button class="btn btn-ghost" data-sms-otp-btn style="margin-top:22px">${ic('shield', 15)} ارسال کد تایید</button>
      </div>
    </div>
  </div>

  <div class="a-card">
    <h3>${ic('megaphone', 18)} ارسال پیامک تبلیغاتی</h3>
    <p class="hint" style="margin-bottom:14px">پیام تبلیغاتی روی <b>خط تبلیغاتی</b> آموت ارسال می‌شود و عبارت «لغو۱۱» به‌صورت خودکار به انتهای متن اضافه می‌گردد.</p>
    <div class="form-grid">
      <div class="field">
        <label>مخاطبان</label>
        <select data-ads-audience>
          <option value="customers">همه مشتریان دارای شماره موبایل</option>
          <option value="manual">شماره‌های دلخواه</option>
        </select>
        <p class="hint" style="margin-top:4px" data-ads-count>در حال محاسبه تعداد مخاطبان…</p>
      </div>
      <div class="field" data-ads-manual-wrap style="display:none"><label>شماره‌ها (با کاما یا خط جدید)</label><textarea data-ads-numbers rows="3" dir="ltr" placeholder="09120000000, 09150000000"></textarea></div>
      <div class="field full"><label>متن پیامک تبلیغاتی</label><textarea data-ads-text rows="3" maxlength="600" placeholder="جشنواره تخفیف غذای سگ و گربه تا ۳۰٪ ..."></textarea></div>
    </div>
    <button class="btn btn-primary" data-ads-send>${ic('mail', 15)} ارسال پیامک تبلیغاتی</button>
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

  // ---------- تست اتصال درگاه‌های پرداخت ----------
  document.querySelectorAll('[data-gw-test]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.getAttribute('data-gw-test');
      const box = document.querySelector(`[data-gw-result="${key}"]`);
      btn.disabled = true;
      box.textContent = 'در حال بررسی…';
      try {
        const r = await AdminAPI.get('/payments/test?gateway=' + encodeURIComponent(key));
        box.textContent = (r.ok ? '✅ ' : '⚠️ ') + (r.message || '');
      } catch (err) { box.textContent = '⚠️ ' + err.message; }
      btn.disabled = false;
    });
  });

  // ---------- سرویس پیامک آموت ----------
  const testNumber = () => document.querySelector('[data-sms-test]').value.trim();

  // بررسی اتصال و اعتبار
  document.querySelector('[data-sms-status-btn]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const box = document.querySelector('[data-sms-status]');
    btn.disabled = true;
    box.textContent = 'در حال بررسی…';
    try {
      const r = await AdminAPI.get('/admin/sms/status');
      box.innerHTML = r.ok
        ? `✅ ${r.message}${r.credit != null ? ` — اعتبار: <b>${r.credit}</b>` : ''}<br>خطوط: خدماتی «${r.lines?.service || '-'}» | کد تایید «${r.lines?.otp || '-'}» | تبلیغاتی «${r.lines?.ads || '-'}»`
        : `⚠️ ${r.message}`;
    } catch (err) { box.textContent = err.message; }
    btn.disabled = false;
  });

  // ۱) پیامک تستی
  document.querySelector('[data-sms-test-btn]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const to = testNumber();
    if (!/^09\d{9}$/.test(to)) { toast('شماره موبایل معتبر وارد کنید', 'err'); return; }
    btn.disabled = true;
    try {
      const r = await AdminAPI.post('/admin/sms/test', { to });
      toast(r.simulated ? 'حالت نمایشی: توکن آموت تنظیم نشده — پیامک در لاگ ثبت شد' : 'پیامک آزمایشی ارسال شد ✅');
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false;
  });

  // ۲) ارسال کد تایید
  document.querySelector('[data-sms-otp-btn]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const to = testNumber();
    if (!/^09\d{9}$/.test(to)) { toast('شماره موبایل معتبر وارد کنید', 'err'); return; }
    btn.disabled = true;
    try {
      const r = await AdminAPI.post('/admin/sms/verify-code', { to });
      toast(r.simulated ? 'حالت نمایشی: کد تایید در لاگ سرور ثبت شد' : 'کد تایید ارسال شد ✅');
    } catch (err) { toast(err.message, 'err'); }
    btn.disabled = false;
  });

  // ۳) پیامک تبلیغاتی
  const audienceSel = document.querySelector('[data-ads-audience]');
  const manualWrap = document.querySelector('[data-ads-manual-wrap]');
  audienceSel?.addEventListener('change', () => {
    manualWrap.style.display = audienceSel.value === 'manual' ? '' : 'none';
  });
  AdminAPI.get('/admin/sms/audience')
    .then(r => { const el = document.querySelector('[data-ads-count]'); if (el) el.textContent = `${r.count} مخاطب با شماره موبایل معتبر`; })
    .catch(() => { const el = document.querySelector('[data-ads-count]'); if (el) el.textContent = ''; });

  document.querySelector('[data-ads-send]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const audience = audienceSel?.value || 'customers';
    const message = document.querySelector('[data-ads-text]').value.trim();
    const numbers = document.querySelector('[data-ads-numbers]')?.value || '';
    if (!message) { toast('متن پیامک تبلیغاتی را وارد کنید', 'err'); return; }
    if (audience === 'manual' && !numbers.trim()) { toast('شماره‌های مقصد را وارد کنید', 'err'); return; }
    if (!confirm('پیامک تبلیغاتی برای مخاطبان انتخاب‌شده ارسال شود؟')) return;
    btn.disabled = true;
    try {
      const r = await AdminAPI.post('/admin/sms/campaign', { audience, numbers, message });
      toast(r.message || 'ارسال شد ✅');
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
      payment: (() => {
        const gateways = {};
        document.querySelectorAll('[data-gw-field]').forEach(inp => {
          const [gw, field] = inp.getAttribute('data-gw-field').split('.');
          gateways[gw] = gateways[gw] || {};
          gateways[gw][field] = inp.type === 'checkbox' ? inp.checked : inp.value.trim();
        });
        return {
          online_enabled: document.querySelector('[data-pay-online]').checked,
          cod_enabled: document.querySelector('[data-pay-cod]').checked,
          gateway: document.querySelector('[data-pay-gateway]').value,
          callback_url: document.querySelector('[data-pay-callback]').value.trim(),
          gateways,
        };
      })(),
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
        token: document.querySelector('[data-sms-token]').value.trim(),
        line_service: document.querySelector('[data-sms-line-service]').value.trim(),
        line_otp: document.querySelector('[data-sms-line-otp]').value.trim(),
        line_ads: document.querySelector('[data-sms-line-ads]').value.trim(),
        otp_pattern_id: document.querySelector('[data-sms-pattern]').value.trim(),
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
