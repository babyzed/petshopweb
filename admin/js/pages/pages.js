// admin/pages/pages.js — ویرایش صفحات درباره ما و قوانین
import { AdminAPI, uploadImage } from '../api.js';
import { toast } from '../components.js';

export async function render() {
  const about = (await AdminAPI.get('/admin/pages/about_page')).page;
  const rules = (await AdminAPI.get('/admin/pages/rules_page')).page;
  return `
  <div class="a-card">
    <h3>🐾 صفحه «درباره ما»</h3>
    <div class="form-grid">
      <div class="field full"><label>عنوان صفحه</label><input data-about-title value="${about.title || ''}"></div>
      <div class="field full"><label>تصویر</label>
        <div class="img-uploader">
          ${about.image ? `<div class="iu-item" style="width:170px;height:100px"><img src="${about.image}" alt=""></div>` : ''}
          <label class="iu-item iu-add" data-about-img>+<input type="file" accept="image/*"></label>
        </div>
      </div>
      <div class="field full"><label>محتوا (HTML)</label>
        <textarea data-about-content rows="12">${about.content || ''}</textarea>
        <span class="hint">می‌توانید از تگ‌های p ،h3 ،ul ،li استفاده کنید.</span>
      </div>
    </div>
    <button class="btn btn-primary" data-save-about style="margin-top:14px">💾 ذخیره درباره ما</button>
  </div>

  <div class="a-card">
    <h3>📜 صفحه «قوانین و مقررات»</h3>
    <div class="form-grid">
      <div class="field full"><label>عنوان صفحه</label><input data-rules-title value="${rules.title || ''}"></div>
      <div class="field full"><label>محتوا (HTML)</label>
        <textarea data-rules-content rows="12">${rules.content || ''}</textarea>
      </div>
    </div>
    <button class="btn btn-primary" data-save-rules style="margin-top:14px">💾 ذخیره قوانین</button>
  </div>`;
}

export function after() {
  let aboutImage = '';
  const ai = document.querySelector('[data-about-img]');
  ai?.querySelector('input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      aboutImage = await uploadImage(file);
      const box = document.createElement('div');
      box.className = 'iu-item';
      box.style.cssText = 'width:170px;height:100px';
      box.innerHTML = `<img src="${aboutImage}" alt="">`;
      ai.before(box);
      toast('تصویر آپلود شد');
    } catch (err) { toast(err.message, 'err'); }
    e.target.value = '';
  });

  document.querySelector('[data-save-about]').addEventListener('click', async () => {
    try {
      await AdminAPI.put('/admin/pages/about_page', {
        title: document.querySelector('[data-about-title]').value.trim(),
        content: document.querySelector('[data-about-content]').value,
        image: aboutImage || undefined,
      });
      toast('درباره ما ذخیره شد ✅');
    } catch (err) { toast(err.message, 'err'); }
  });
  document.querySelector('[data-save-rules]').addEventListener('click', async () => {
    try {
      await AdminAPI.put('/admin/pages/rules_page', {
        title: document.querySelector('[data-rules-title]').value.trim(),
        content: document.querySelector('[data-rules-content]').value,
      });
      toast('قوانین ذخیره شد ✅');
    } catch (err) { toast(err.message, 'err'); }
  });
}
