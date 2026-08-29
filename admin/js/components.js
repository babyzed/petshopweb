// admin/js/components.js — کامپوننت‌های مشترک پنل مدیریت
import { AdminAPI, faNum, faDate } from './api.js';

export function toast(message, type = 'ok') {
  const root = document.getElementById('admin-toast-root');
  const t = document.createElement('div');
  t.className = 'a-toast ' + (type === 'err' ? 'err' : 'ok');
  t.textContent = (type === 'err' ? '⚠️ ' : '✅ ') + message;
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 2800);
}

export function openModal(html, opts = {}) {
  const root = document.getElementById('admin-modal-root');
  const m = document.createElement('div');
  m.className = 'admin-modal-backdrop';
  m.innerHTML = `<div class="admin-modal-box ${opts.wide ? 'wide' : ''}">${html}</div>`;
  root.appendChild(m);
  const close = () => m.remove();
  if (!opts.static) m.addEventListener('click', (e) => { if (e.target === m) close(); });
  return { el: m, close, body: m.querySelector('.admin-modal-box') };
}

export function confirmModal(title, text, onYes) {
  const { close, body } = openModal(`
    <h3 style="font-size:16px;font-weight:800;margin-bottom:10px">${title}</h3>
    <p style="font-size:13px;color:#57534E;margin-bottom:20px">${text}</p>
    <div style="display:flex;gap:10px;justify-content:flex-start">
      <button class="btn btn-danger" data-yes style="background:var(--danger);color:#fff;border:none;padding:10px 24px;border-radius:12px;font-weight:700">بله، حذف کن</button>
      <button class="btn btn-ghost" data-no style="padding:10px 24px;border-radius:12px;font-weight:700">انصراف</button>
    </div>`, { static: true });
  body.querySelector('[data-yes]').addEventListener('click', () => { close(); onYes(); });
  body.querySelector('[data-no]').addEventListener('click', close);
}

export function statCard(icon, cls, value, label) {
  return `
    <div class="stat-card">
      <div class="stat-ic ${cls}">${icon}</div>
      <div><div class="stat-v">${value}</div><div class="stat-l">${label}</div></div>
    </div>`;
}

export function statusBadge(status) {
  const labels = {
    pending: 'در انتظار پرداخت', paid: 'پرداخت شده', shipped: 'ارسال شده',
    delivered: 'تحویل شده', cancelled: 'لغو شده',
    approved: 'تایید شده', rejected: 'رد شده', active: 'فعال', inactive: 'غیرفعال',
    draft: 'پیش‌نویس',
  };
  return `<span class="s-badge s-${status}">${labels[status] || status}</span>`;
}

export function initials(name) {
  const parts = String(name || '؟').trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

export function toggleHtml(checked, id) {
  return `<button class="toggle ${checked ? 'on' : ''}" data-toggle="${id}" role="switch" aria-checked="${checked}"></button>`;
}

export function renderSidebar() {
  const el = document.getElementById('admin-sidebar');
  const u = AdminAPI.user;
  const p = (perm) => AdminAPI.hasPerm(perm);
  const groups = [
    { label: 'مدیریت', items: [
      { route: 'dashboard', match: 'dashboard', icon: '📊', label: 'داشبورد', perm: 'dashboard.view' },
      { route: 'products', match: 'products', icon: '📦', label: 'محصولات', perm: 'products.manage' },
      { route: 'categories', icon: '🗂️', label: 'دسته‌بندی‌ها', perm: 'categories.manage' },
      { route: 'brands', icon: '🏷️', label: 'برندها', perm: 'brands.manage' },
      { route: 'orders', match: 'orders', icon: '🧾', label: 'سفارش‌ها', perm: 'orders.manage' },
      { route: 'users', match: 'users', icon: '👥', label: 'کاربران', perm: 'users.manage' },
      { route: 'reviews', icon: '💬', label: 'نظرات محصولات', perm: 'reviews.manage' },
      { route: 'coupons', icon: '🎟️', label: 'کدهای تخفیف', perm: 'coupons.manage' },
    ]},
    { label: 'محتوا', items: [
      { route: 'home', icon: '🏠', label: 'صفحه اصلی', perm: 'home.manage' },
      { route: 'banners', icon: '🖼️', label: 'بنرها', perm: 'banners.manage' },
      { route: 'articles', match: 'articles', icon: '📰', label: 'مقالات', perm: 'articles.manage' },
      { route: 'faq', icon: '❓', label: 'سوالات متداول', perm: 'faq.manage' },
      { route: 'testimonials', icon: '💬', label: 'نظرات مشتریان', perm: 'testimonials.manage' },
      { route: 'pages', icon: '📄', label: 'صفحات (درباره ما/قوانین)', perm: 'pages.manage' },
    ]},
    { label: 'تنظیمات', items: [
      { route: 'settings', icon: '⚙️', label: 'تنظیمات فروشگاه', perm: 'settings.manage' },
      { route: 'roles', icon: '🛡️', label: 'نقش‌ها و دسترسی‌ها', perm: 'roles.manage' },
    ]},
  ];
  el.innerHTML = `
    <div class="as-logo">
      <span class="al-ic">🐾</span>
      <div><span class="al-t">پت‌شاپ</span><span class="al-s">پنل مدیریت</span></div>
    </div>
    <nav class="as-nav">
      ${groups.map(g => `
        <div class="as-group-label">${g.label}</div>
        ${g.items.filter(i => i.perm ? p(i.perm) : true).map(i => `
          <a class="as-link" href="#/${i.route}" data-route="${i.route}" data-match="${i.match || ''}">
            <span>${i.icon}</span> ${i.label}
          </a>`).join('')}
      `).join('')}
    </nav>
    <div class="as-foot">
      <a href="#/profile"><span>👤</span> ${u?.name || ''}</a>
      <a href="/" target="_blank"><span>🌐</span> مشاهده فروشگاه</a>
    </div>`;
}

export function renderTopbar() {
  const el = document.getElementById('admin-topbar');
  const u = AdminAPI.user;
  el.innerHTML = `
    <button class="icon-btn at-burger" data-burger aria-label="منو" style="background:var(--bg)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
    <div>
      <div class="at-title">پنل مدیریت پت‌شاپ</div>
      <div class="at-sub">${u?.role_title || ''} — ${faDate(new Date().toISOString())}</div>
    </div>
    <div class="at-user">
      <div style="text-align:end">
        <div class="at-name">${u?.name || ''}</div>
        <div class="at-role">${u?.role_title || ''}</div>
      </div>
      <span class="at-avatar">${initials(u?.name)}</span>
    </div>`;
  el.querySelector('[data-burger]').addEventListener('click', () => {
    document.getElementById('admin-sidebar').classList.toggle('open');
  });
}
