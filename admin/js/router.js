// admin/js/router.js — روتر پنل مدیریت
import { AdminAPI } from './api.js';
import * as login from './pages/login.js';
import * as dashboard from './pages/dashboard.js';
import * as products from './pages/products.js';
import * as categories from './pages/categories.js';
import * as brands from './pages/brands.js';
import * as orders from './pages/orders.js';
import * as users from './pages/users.js';
import * as reviews from './pages/reviews.js';
import * as coupons from './pages/coupons.js';
import * as banners from './pages/banners.js';
import * as articles from './pages/articles.js';
import * as home from './pages/home.js';
import * as faq from './pages/faq.js';
import * as testimonials from './pages/testimonials.js';
import * as pages from './pages/pages.js';
import * as settings from './pages/settings.js';
import * as roles from './pages/roles.js';
import * as profile from './pages/profile.js';
import { toast } from './components.js';

const routes = {
  'login': { title: 'ورود مدیر', render: () => login.render(), after: () => login.after() },
  'dashboard': { title: 'داشبورد', perm: 'dashboard.view', render: () => dashboard.render() },
  'products': { title: 'محصولات', perm: 'products.manage', render: () => products.render(), after: () => products.after() },
  'products/new': { title: 'محصول جدید', perm: 'products.manage', render: () => products.formRender(), after: () => products.formAfter(null) },
  'products/:id': { title: 'ویرایش محصول', perm: 'products.manage', render: (p) => products.formRender(p.id), after: (p) => products.formAfter(p.id) },
  'categories': { title: 'دسته‌بندی‌ها', perm: 'categories.manage', render: () => categories.render(), after: () => categories.after() },
  'brands': { title: 'برندها', perm: 'brands.manage', render: () => brands.render(), after: () => brands.after() },
  'orders': { title: 'سفارش‌ها', perm: 'orders.manage', render: () => orders.render(), after: () => orders.after() },
  'orders/:id': { title: 'جزئیات سفارش', perm: 'orders.manage', render: (p) => orders.detailRender(p.id), after: (p) => orders.detailAfter(p.id) },
  'users': { title: 'کاربران', perm: 'users.manage', render: () => users.render(), after: () => users.after() },
  'users/:id': { title: 'پروفایل کاربر', perm: 'users.manage', render: (p) => users.detailRender(p.id) },
  'reviews': { title: 'نظرات', perm: 'reviews.manage', render: () => reviews.render(), after: () => reviews.after() },
  'coupons': { title: 'کدهای تخفیف', perm: 'coupons.manage', render: () => coupons.render(), after: () => coupons.after() },
  'banners': { title: 'بنرها', perm: 'banners.manage', render: () => banners.render(), after: () => banners.after() },
  'articles': { title: 'مقالات', perm: 'articles.manage', render: () => articles.render(), after: () => articles.after() },
  'articles/new': { title: 'مقاله جدید', perm: 'articles.manage', render: () => articles.formRender(), after: () => articles.formAfter(null) },
  'articles/:id': { title: 'ویرایش مقاله', perm: 'articles.manage', render: (p) => articles.formRender(p.id), after: (p) => articles.formAfter(p.id) },
  'home': { title: 'ویرایش صفحه اصلی', perm: 'home.manage', render: () => home.render(), after: () => home.after() },
  'faq': { title: 'سوالات متداول', perm: 'faq.manage', render: () => faq.render(), after: () => faq.after() },
  'testimonials': { title: 'نظرات مشتریان', perm: 'testimonials.manage', render: () => testimonials.render(), after: () => testimonials.after() },
  'pages': { title: 'صفحات', perm: 'pages.manage', render: () => pages.render(), after: () => pages.after() },
  'settings': { title: 'تنظیمات', perm: 'settings.manage', render: () => settings.render(), after: () => settings.after() },
  'roles': { title: 'نقش‌ها و دسترسی‌ها', perm: 'roles.manage', render: () => roles.render(), after: () => roles.after() },
  'profile': { title: 'پروفایل', render: () => profile.render(), after: () => profile.after() },
};

export async function navigate() {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const segs = raw.split('/').filter(Boolean);
  const view = document.getElementById('admin-view');

  let def = null, params = {};
  for (const [path, d] of Object.entries(routes)) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length !== segs.length) continue;
    let ok = true; const prm = {};
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) prm[parts[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (parts[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) { def = d; params = prm; break; }
  }

  if (!AdminAPI.token || !AdminAPI.user) {
    if (raw === 'login') def = routes.login;
    else { location.hash = '#/login'; return; }
  }

  if (!def) { view.innerHTML = '<div class="page-error"><h2>صفحه پیدا نشد</h2><a class="btn btn-primary" href="#/dashboard">داشبورد</a></div>'; return; }

  if (def.perm && !AdminAPI.hasPerm(def.perm)) {
    view.innerHTML = `
      <div class="page-error" style="background:#fff;border-radius:20px;border:1px solid #EFE9E2;padding:60px 30px;text-align:center">
        <div class="pe-ic" style="font-size:60px">🔒</div>
        <h2>دسترسی ندارید</h2>
        <p style="color:var(--muted);margin:8px 0 16px">نقش شما اجازه مشاهده این بخش را ندارد. با مدیر کل تماس بگیرید.</p>
        <a class="btn btn-primary" href="#/dashboard">بازگشت به داشبورد</a>
      </div>`;
    return;
  }

  view.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div>در حال بارگذاری...</div></div>';
  try {
    view.innerHTML = await def.render(params);
    if (def.after) def.after(params);
  } catch (e) {
    console.error(e);
    toast(e.message, 'err');
    view.innerHTML = '<div class="page-error" style="background:#fff;border-radius:20px;padding:50px"><h2>خطا</h2><p style="color:var(--muted)">' + e.message + '</p></div>';
  }
  renderActiveNav(raw);
}

function renderActiveNav(raw) {
  document.querySelectorAll('.as-link').forEach(a => {
    a.classList.toggle('active', a.dataset.route === raw || (a.dataset.match && raw.startsWith(a.dataset.match)));
  });
  const title = document.querySelector('.at-title');
  const sub = document.querySelector('.at-sub');
  if (title) {
    const entry = Object.entries(routes).find(([k, v]) => k === raw || (k.includes(':') && raw.startsWith(k.split('/')[0])));
    title.textContent = entry ? entry[1].title : 'پنل مدیریت';
  }
}

export function init() {
  window.addEventListener('hashchange', navigate);
  navigate();
}
