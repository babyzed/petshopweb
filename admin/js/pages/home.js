// admin/pages/home.js — ویرایشگر محتوای صفحه اصلی (بدون کد!)
import { AdminAPI, uploadImage } from '../api.js';
import { toast, openModal } from '../components.js';

export async function render() {
  const d = await AdminAPI.get('/admin/home');
  const hs = d.home_settings || { sections: {} };
  const feats = d.features || [];
  const at = d.about_teaser || {};

  const sectionToggle = (key, label, icon) => {
    const s = hs.sections?.[key] || {};
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed #F1EDE7">
      <span style="font-size:20px">${icon}</span>
      <div style="flex:1">
        <b style="font-size:13px">${label}</b>
        <input class="sec-title-inp" data-sec-title="${key}" value="${s.title || ''}" placeholder="تیتر بخش (خالی = پیش‌فرض)" style="width:100%;margin-top:4px;padding:7px 10px;border:1.5px solid #E7E0D8;border-radius:9px;font-size:12px;outline:none">
      </div>
      <button class="toggle ${s.enabled !== false ? 'on' : ''}" data-sec-toggle="${key}"></button>
    </div>`;
  };

  return `
  <div class="a-card">
    <h3>🏠 نمایش و تیتر بخش‌های صفحه اصلی</h3>
    <p class="hint" style="margin-bottom:10px">هر بخش را می‌توانید نمایش/عدم نمایش کنید و تیتر اختصاصی بدهید.</p>
    ${sectionToggle('hero', 'اسلایدر Hero (بالای صفحه)', '🎠')}
    ${sectionToggle('categories', 'دسته‌بندی محصولات', '🗂️')}
    ${sectionToggle('bestsellers', 'پرفروش‌ترین‌ها', '🔥')}
    ${sectionToggle('new', 'جدیدترین محصولات', '✨')}
    ${sectionToggle('sales', 'تخفیف‌های ویژه', '💥')}
    ${sectionToggle('special', 'پیشنهاد پت‌شاپ (محصولات ویژه)', '🌟')}
    ${sectionToggle('brands', 'برندهای معتبر', '🏷️')}
    ${sectionToggle('about', 'معرفی پت‌شاپ', '🏆')}
    ${sectionToggle('features', 'مزایای خرید', '🎁')}
    ${sectionToggle('blog', 'مجله پت', '📰')}
    ${sectionToggle('testimonials', 'نظر مشتریان', '💬')}
    ${sectionToggle('newsletter', 'خبرنامه', '✉️')}
  </div>

  <div class="a-card">
    <h3>🎁 مزایای خرید (۶ مورد)</h3>
    <div data-feats>
      ${feats.map((f, i) => `
        <div class="feat-row" data-feat-row>
          <input placeholder="آیکون (ایموجی)" data-fi value="${f.icon || ''}" style="width:70px">
          <input placeholder="عنوان (مثلاً: ارسال سریع)" data-ft value="${f.title || ''}">
          <button class="btn btn-ghost" data-feat-del style="color:var(--danger)">✕</button>
          <input placeholder="توضیح کوتاه" data-fx value="${f.text || ''}" style="grid-column:1/-1">
        </div>`).join('')}
    </div>
    <button class="btn btn-ghost" data-feat-add style="margin-top:8px">+ افزودن مزیت</button>
  </div>

  <div class="a-card">
    <h3>🏆 بخش معرفی پت‌شاپ</h3>
    <div class="form-grid">
      <div class="field"><label>نشان (بج)</label><input data-at-badge value="${at.badge || ''}"></div>
      <div class="field"><label>عنوان</label><input data-at-title value="${at.title || ''}"></div>
      <div class="field full"><label>متن معرفی</label><textarea data-at-text rows="3">${at.text || ''}</textarea></div>
      <div class="field full"><label>تصویر</label>
        <div class="img-uploader">
          ${at.image ? `<div class="iu-item" style="width:150px;height:90px"><img src="${at.image}" alt=""></div>` : ''}
          <label class="iu-item iu-add" data-at-img>+<input type="file" accept="image/*"></label>
        </div>
      </div>
      <div class="field full">
        <label>آمارها (۴ مورد — فرمت: مقدار | برچسب)</label>
        <div data-at-stats>
          ${(at.stats || []).map((s, i) => `
            <div class="feat-row">
              <input placeholder="مقدار (مثلاً: ۱۲+)" data-sv value="${s.value}" style="width:90px">
              <input placeholder="برچسب (مثلاً: سال تجربه)" data-sl value="${s.label}">
              <button class="btn btn-ghost" data-stat-del style="color:var(--danger)">✕</button>
            </div>`).join('')}
        </div>
        <button class="btn btn-ghost" data-stat-add style="margin-top:6px">+ آمار</button>
      </div>
    </div>
  </div>

  <button class="btn btn-primary btn-lg" data-save style="width:100%">💾 ذخیره همه تغییرات صفحه اصلی</button>`;
}

export function after() {
  let atImage = document.querySelector('.img-uploader .iu-item img')?.src || '';
  const imgLabel = document.querySelector('[data-at-img]');
  imgLabel?.querySelector('input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      atImage = await uploadImage(file);
      const box = document.createElement('div');
      box.className = 'iu-item';
      box.style.cssText = 'width:150px;height:90px';
      box.innerHTML = `<img src="${atImage}" alt="">`;
      imgLabel.before(box);
      toast('تصویر آپلود شد');
    } catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  });

  document.querySelector('[data-feat-add]').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'feat-row';
    row.dataset.featRow = '';
    row.innerHTML = `
      <input placeholder="آیکون" data-fi style="width:70px">
      <input placeholder="عنوان" data-ft>
      <button class="btn btn-ghost" data-feat-del style="color:var(--danger)">✕</button>
      <input placeholder="توضیح" data-fx style="grid-column:1/-1">`;
    document.querySelector('[data-feats]').appendChild(row);
    row.querySelector('[data-feat-del]').addEventListener('click', () => row.remove());
  });
  document.querySelectorAll('[data-feat-del]').forEach(b => b.addEventListener('click', () => b.closest('[data-feat-row]').remove()));

  document.querySelector('[data-stat-add]').addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'feat-row';
    row.innerHTML = `
      <input placeholder="مقدار" data-sv style="width:90px">
      <input placeholder="برچسب" data-sl>
      <button class="btn btn-ghost" data-stat-del style="color:var(--danger)">✕</button>`;
    document.querySelector('[data-at-stats]').appendChild(row);
    row.querySelector('[data-stat-del]').addEventListener('click', () => row.remove());
  });
  document.querySelectorAll('[data-stat-del]').forEach(b => b.addEventListener('click', () => b.closest('.feat-row').remove()));

  document.querySelectorAll('[data-sec-toggle]').forEach(b => b.addEventListener('click', function () { this.classList.toggle('on'); }));

  document.querySelector('[data-save]').addEventListener('click', async (btn) => {
    const sections = {};
    document.querySelectorAll('[data-sec-toggle]').forEach(t => {
      sections[t.dataset.secToggle] = { enabled: t.classList.contains('on'), title: document.querySelector(`[data-sec-title="${t.dataset.secToggle}"]`).value.trim() };
    });
    const features = [...document.querySelectorAll('[data-feat-row]')].map(r => ({
      icon: r.querySelector('[data-fi]').value.trim(),
      title: r.querySelector('[data-ft]').value.trim(),
      text: r.querySelector('[data-fx]').value.trim(),
    })).filter(f => f.title);
    const stats = [...document.querySelectorAll('[data-at-stats] .feat-row')].map(r => ({
      value: r.querySelector('[data-sv]').value.trim(),
      label: r.querySelector('[data-sl]').value.trim(),
    })).filter(s => s.value || s.label);

    btn.disabled = true;
    try {
      await AdminAPI.put('/admin/home', {
        home_settings: { hero: { enabled: true }, sections },
        features,
        about_teaser: {
          badge: document.querySelector('[data-at-badge]').value.trim(),
          title: document.querySelector('[data-at-title]').value.trim(),
          text: document.querySelector('[data-at-text]').value.trim(),
          image: atImage,
          stats,
        },
      });
      toast('صفحه اصلی به‌روزرسانی شد ✅');
      btn.disabled = false;
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
}
