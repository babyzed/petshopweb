// admin/js/components.js — کامپوننت‌های مشترک پنل مدیریت
import { AdminAPI, faNum, faDate } from './api.js';
import { ic } from './icons.js';

export function toast(message, type = 'ok') {
  const root = document.getElementById('admin-toast-root');
  const t = document.createElement('div');
  t.className = 'a-toast ' + (type === 'err' ? 'err' : 'ok');
  t.innerHTML = (type === 'err' ? ic('alertTriangle', 16) + ' ' : ic('check', 16) + ' ') + message;
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
    <h3 style="font-size:16px;font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:8px">${ic('alertTriangle', 20)} ${title}</h3>
    <p style="font-size:13px;color:#57534E;margin-bottom:20px">${text}</p>
    <div style="display:flex;gap:10px;justify-content:flex-start">
      <button class="btn btn-danger" data-yes style="background:var(--danger);color:#fff;border:none;padding:10px 24px;border-radius:12px;font-weight:700;display:flex;align-items:center;gap:6px">${ic('trash', 15)} بلی، حذف کن</button>
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
    delivered: 'تحویل شده', cancelled: 'لغو شده', approved: 'تایید شده', rejected: 'رد شده', active: 'فعال', inactive: 'غیرفعال',
    draft: 'پیش‌نویس',
  };
  return `<span class="s-badge s-${status}">${labels[status] || status}</span>`;
}

// نشان پرداخت — وضعیت پرداخت آنلاین/در محل
export function paymentBadge(paymentMethod, paymentStatus) {
  if (paymentMethod === 'online') {
    if (paymentStatus === 'paid') return `<span class="s-badge s-paid">پرداخت آنلاین (موفق)</span>`;
    if (paymentStatus === 'unpaid') return `<span class="s-badge s-pending">پرداخت آنلاین (پرداخت نشده)</span>`;
    if (paymentStatus === 'failed') return `<span class="s-badge s-cancelled">پرداخت ناموفق</span>`;
    return `<span class="s-badge s-draft">پرداخت آنلاین</span>`;
  }
  // پرداخت در محل: وجه هنگام تحویل دریافت می‌شود
  if (paymentStatus === 'paid') return `<span class="s-badge s-paid">در محل (دریافت شده)</span>`;
  return `<span class="s-badge s-pending">در محل (دریافت نشده)</span>`;
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
      { route: 'dashboard', match: 'dashboard', icon: ic('barChart3', 18), label: 'داشبورد', perm: 'dashboard.view' },
      { route: 'products', match: 'products', icon: ic('package', 18), label: 'محصولات', perm: 'products.manage' },
      { route: 'categories', icon: ic('grid', 18), label: 'دسته‌بندی‌ها', perm: 'categories.manage' },
      { route: 'brands', icon: ic('tag', 18), label: 'برندها', perm: 'brands.manage' },
      { route: 'orders', match: 'orders', icon: ic('receipt', 18), label: 'سفارش‌ها', perm: 'orders.manage' },
      { route: 'users', match: 'users', icon: ic('users', 18), label: 'کاربران', perm: 'users.manage' },
      { route: 'reviews', icon: ic('star', 18), label: 'نظرات محصولات', perm: 'reviews.manage' },
      { route: 'coupons', icon: ic('percent', 18), label: 'کدهای تخفیف', perm: 'coupons.manage' },
    ]},
    { label: 'محتوا', items: [
      { route: 'home', icon: ic('home', 18), label: 'صفحه اصلی', perm: 'home.manage' },
      { route: 'banners', icon: ic('image', 18), label: 'بنرها', perm: 'banners.manage' },
      { route: 'articles', match: 'articles', icon: ic('newspaper', 18), label: 'مقالات', perm: 'articles.manage' },
      { route: 'faq', icon: ic('helpCircle', 18), label: 'سوالات متداول', perm: 'faq.manage' },
      { route: 'testimonials', icon: ic('chat', 18), label: 'نظرات مشتریان', perm: 'testimonials.manage' },
      { route: 'pages', icon: ic('file', 18), label: 'صفحات (درباره ما/قوانین)', perm: 'pages.manage' },
    ]},
    { label: 'تنظیمات', items: [
      { route: 'settings', icon: ic('settings', 18), label: 'تنظیمات فروشگاه', perm: 'settings.manage' },
      { route: 'roles', icon: ic('shield', 18), label: 'نقش‌ها و دسترسی‌ها', perm: 'roles.manage' },
    ]},
  ];
  el.innerHTML = `
    <div class="as-logo">
      <span class="al-ic">${ic('paw', 22)}</span>
      <div><span class="al-t">پت‌شاپ</span><span class="al-s">پنل مدیریت</span></div>
      <button class="as-close" data-sidebar-close aria-label="بستن منو">${ic('x', 18)}</button>
    </div>
    <nav class="as-nav">
      ${groups.map(g => `
        <div class="as-group-label">${g.label}</div>
        ${g.items.filter(i => i.perm ? p(i.perm) : true).map(i => `
          <a class="as-link" href="#/${i.route}" data-route="${i.route}" data-match="${i.match || ''}">
            <span class="as-link-icon">${i.icon}</span> ${i.label}
          </a>`).join('')}
      `).join('')}
    </nav>
    <div class="as-foot">
      <a href="#/profile"><span class="as-link-icon">${ic('user', 16)}</span> ${u?.name || ''}</a>
      <a href="/" target="_blank"><span class="as-link-icon">${ic('externalLink', 16)}</span> مشاهده فروشگاه</a>
    </div>`;
  el.querySelector('[data-sidebar-close]')?.addEventListener('click', closeSidebar);
}

// ---------- سایدبار موبایل ----------
let sidebarBackdrop = null;
function ensureSidebarBackdrop() {
  if (!sidebarBackdrop) {
    sidebarBackdrop = document.createElement('div');
    sidebarBackdrop.id = 'admin-sidebar-backdrop';
    sidebarBackdrop.className = 'admin-sidebar-backdrop';
    document.body.appendChild(sidebarBackdrop);
  }
  return sidebarBackdrop;
}
export function openSidebar() {
  document.getElementById('admin-sidebar').classList.add('open');
  ensureSidebarBackdrop().classList.add('open');
  document.body.classList.add('no-scroll');
}
export function closeSidebar() {
  document.getElementById('admin-sidebar').classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('open');
  document.body.classList.remove('no-scroll');
}

export function renderTopbar() {
  const el = document.getElementById('admin-topbar');
  const u = AdminAPI.user;
  el.innerHTML = `
    <button class="icon-btn at-burger" data-burger aria-label="منو" style="background:var(--bg)">
      ${ic('menu', 20)}
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
    const sidebar = document.getElementById('admin-sidebar');
    if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  ensureSidebarBackdrop().addEventListener('click', closeSidebar);
}
