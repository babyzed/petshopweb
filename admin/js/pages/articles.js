// admin/pages/articles.js — مدیریت مقالات مجله پت
import { AdminAPI, faDate, uploadImage } from '../api.js';
import { toast, confirmModal } from '../components.js';

export async function render() {
  const { articles } = await AdminAPI.get('/admin/articles');
  return `
  <div class="toolbar">
    <h3 style="font-size:15px;font-weight:800">📰 مقالات</h3>
    <a class="btn btn-primary" href="#/articles/new" style="padding:10px 22px;font-size:13px">+ مقاله جدید</a>
  </div>
  <table class="data-table">
    <thead><tr><th>مقاله</th><th>دسته</th><th>تاریخ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>
      ${articles.map(a => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              ${a.image ? `<img class="t-img" src="${a.image}" style="width:52px;height:40px;border-radius:8px">` : '<span style="font-size:22px">📄</span>'}
              <div><div class="t-name">${a.title}</div><div class="t-sub" dir="ltr">/${a.slug}</div></div>
            </div>
          </td>
          <td>${a.category || '—'}</td>
          <td style="font-size:11px">${faDate(a.created_at)}</td>
          <td>${a.status === 'active' ? '<span class="s-badge s-active">فعال</span>' : '<span class="s-badge s-inactive">پیش‌نویس</span>'}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-ghost" href="#/articles/${a.id}" style="padding:7px 12px;font-size:11.5px">ویرایش</a>
            <button class="btn btn-ghost" data-del="${a.id}" style="padding:7px 12px;font-size:11.5px;color:var(--danger)">حذف</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

export function after() {
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    confirmModal('حذف مقاله', 'این مقاله برای همیشه حذف شود؟', async () => {
      try { await AdminAPI.del('/admin/articles/' + b.dataset.del); toast('حذف شد'); setTimeout(() => location.reload(), 350); }
      catch (err) { toast(err.message, 'err'); }
    });
  }));
}

// ---------- فرم مقاله ----------
export async function formRender(params) {
  let a = { status: 'active', content: '' };
  if (params) a = (await AdminAPI.get('/admin/articles')).articles.find(x => x.id == params) || a;
  return `
  <div class="a-card">
    <h3>📰 ${params ? 'ویرایش مقاله' : 'مقاله جدید'}</h3>
    <div class="form-grid">
      <div class="field full"><label>عنوان مقاله *</label><input data-title value="${a.title || ''}"></div>
      <div class="field"><label>دسته (مثلاً: تغذیه، بهداشت)</label><input data-category value="${a.category || ''}"></div>
      <div class="field"><label>وضعیت</label>
        <select data-status>
          <option value="active" ${a.status === 'active' ? 'selected' : ''}>فعال (نمایش در سایت)</option>
          <option value="draft" ${a.status === 'draft' ? 'selected' : ''}>پیش‌نویس</option>
        </select>
      </div>
      <div class="field full"><label>خلاصه مقاله</label><textarea data-excerpt rows="2">${a.excerpt || ''}</textarea></div>
      <div class="field full"><label>متن کامل (HTML پشتیبانی می‌شود: تیتر h3، پاراگراف p، لیست ul)</label>
        <textarea data-content rows="12" dir="rtl">${a.content || ''}</textarea>
      </div>
      <div class="field full"><label>تصویر شاخص</label>
        <div class="img-uploader">
          ${a.image ? `<div class="iu-item" style="width:150px;height:90px"><img src="${a.image}" alt=""></div>` : ''}
          <label class="iu-item iu-add" data-img>+<input type="file" accept="image/*"></label>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn btn-primary" data-save style="flex:1">💾 ذخیره مقاله</button>
      <a class="btn btn-ghost" href="#/articles">انصراف</a>
    </div>
  </div>`;
}

export function formAfter(params) {
  let image = '';
  const imgLabel = document.querySelector('[data-img]');
  if (imgLabel) {
    imgLabel.querySelector('input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        image = await uploadImage(file);
        const box = document.createElement('div');
        box.className = 'iu-item';
        box.style.cssText = 'width:150px;height:90px';
        box.innerHTML = `<img src="${image}" alt="">`;
        imgLabel.before(box);
        toast('تصویر آپلود شد');
      } catch (err) { toast(err.message, 'err'); }
      e.target.value = '';
    });
  }
  document.querySelector('[data-save]').addEventListener('click', async (btn) => {
    const payload = {
      title: document.querySelector('[data-title]').value.trim(),
      category: document.querySelector('[data-category]').value.trim(),
      status: document.querySelector('[data-status]').value,
      excerpt: document.querySelector('[data-excerpt]').value.trim(),
      content: document.querySelector('[data-content]').value,
      image,
    };
    if (!payload.title || !payload.content) { toast('عنوان و متن مقاله الزامی است', 'err'); return; }
    btn.disabled = true;
    try {
      if (params) await AdminAPI.put('/admin/articles/' + params, payload);
      else await AdminAPI.post('/admin/articles', payload);
      toast('مقاله ذخیره شد ✅');
      location.hash = '#/articles';
      setTimeout(() => location.reload(), 300);
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  });
}
