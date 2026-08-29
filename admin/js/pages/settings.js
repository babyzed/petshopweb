// admin/pages/settings.js — تنظیمات فروشگاه: تماس، شبکه‌های اجتماعی، فوتر، ارسال
import { AdminAPI } from '../api.js';
import { toast } from '../components.js';

export async function render() {
  const s = await AdminAPI.get('/admin/settings');
  const c = s.contact || {}, soc = s.socials || {}, f = s.footer || {}, sh = s.shipping || {}, site = s.site || {};
  return `
  <div class="a-card">
    <h3>🏪 اطلاعات پایه</h3>
    <div class="form-grid">
      <div class="field"><label>نام فروشگاه</label><input data-site-name value="${site.name || ''}"></div>
      <div class="field"><label>شعار</label><input data-site-slogan value="${site.slogan || ''}"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>📞 اطلاعات تماس</h3>
    <div class="form-grid">
      <div class="field"><label>تلفن ثابت</label><input data-phone value="${c.phone || ''}" dir="ltr"></div>
      <div class="field"><label>موبایل</label><input data-mobile value="${c.mobile || ''}" dir="ltr"></div>
      <div class="field"><label>ایمیل</label><input data-email value="${c.email || ''}" dir="ltr"></div>
      <div class="field"><label>ساعات کاری</label><input data-hours value="${c.work_hours || ''}"></div>
      <div class="field full"><label>آدرس</label><input data-address value="${c.address || ''}"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>🌐 شبکه‌های اجتماعی</h3>
    <div class="form-grid">
      <div class="field"><label>اینستاگرام</label><input data-instagram value="${soc.instagram || ''}" dir="ltr"></div>
      <div class="field"><label>تلگرام</label><input data-telegram value="${soc.telegram || ''}" dir="ltr"></div>
      <div class="field"><label>واتساپ</label><input data-whatsapp value="${soc.whatsapp || ''}" dir="ltr"></div>
      <div class="field"><label>یوتیوب</label><input data-youtube value="${soc.youtube || ''}" dir="ltr"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>📦 هزینه ارسال</h3>
    <div class="form-grid">
      <div class="field"><label>هزینه ارسال (تومان)</label><input type="number" min="0" data-ship-cost value="${sh.cost || 0}"></div>
      <div class="field"><label>ارسال رایگان برای خرید بالای (تومان)</label><input type="number" min="0" data-ship-free value="${sh.free_over || 0}"></div>
      <div class="field full"><label>پیام ارسال</label><input data-ship-msg value="${sh.message || ''}"></div>
    </div>
  </div>

  <div class="a-card">
    <h3>🦶 فوتر</h3>
    <div class="form-grid">
      <div class="field full"><label>متن معرفی فوتر</label><textarea data-footer-desc rows="3">${f.description || ''}</textarea></div>
      <div class="field full">
        <label>نشان‌های اعتماد (فرمت: آیکون | عنوان)</label>
        <div data-badges>
          ${(f.badges || []).map((b, i) => `
            <div class="feat-row">
              <input placeholder="آیکون" data-b-icon value="${b.icon}" style="width:70px">
              <input placeholder="عنوان" data-b-title value="${b.title}">
              <button class="btn btn-ghost" data-badge-del style="color:var(--danger)">✕</button>
            </div>`).join('')}
        </div>
        <button class="btn btn-ghost" data-badge-add style="margin-top:6px">+ نشان</button>
      </div>
    </div>
  </div>

  <button class="btn btn-primary btn-lg" data-save style="width:100%">💾 ذخیره همه تنظیمات</button>`;
}

export function after() {
  document.querySelector('[data-badge-add]').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'feat-row';
    row.innerHTML = `
      <input placeholder="آیکون" data-b-icon style="width:70px">
      <input placeholder="عنوان" data-b-title>
      <button class="btn btn-ghost" data-badge-del style="color:var(--danger)">✕</button>`;
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
      footer: { description: document.querySelector('[data-footer-desc]').value.trim(), badges },
    };
    btn.disabled = true;
    try {
      await AdminAPI.put('/admin/settings', body);
      toast('تنظیمات ذخیره شد ✅');
      btn.disabled = false;
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
}
