// admin/js/app.js — نقطه ورود پنل مدیریت
import { AdminAPI } from './api.js';
import { renderSidebar, renderTopbar, closeSidebar } from './components.js';
import { init } from './router.js';

function bootstrap() {
  if (AdminAPI.token && AdminAPI.user) {
    renderSidebar();
    renderTopbar();
    document.body.classList.add('logged-in');
    // بستن سایدبار موبایل با کلیک روی لینک، کلید Escape یا تغییر مسیر
    document.addEventListener('click', (e) => {
      if (e.target.closest('.as-link')) {
        closeSidebar();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSidebar();
    });
    window.addEventListener('hashchange', () => closeSidebar());
  } else {
    document.getElementById('admin-sidebar').innerHTML = '';
    document.getElementById('admin-topbar').innerHTML = '';
  }

  // CSP-safe image fallback (replaces onerror inline handlers)
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && !e.target.dataset.fallback) {
      e.target.dataset.fallback = '1';
      e.target.src = '/assets/img/placeholder.webp';
    }
  }, true);

  // CSP-safe click delegation (replaces onclick inline handlers)
  document.addEventListener('click', (e) => {
    const href = e.target.closest('[data-href]');
    if (href) { e.preventDefault(); location.hash = href.dataset.href; }
    if (e.target.closest('[data-reload]')) { location.reload(); }
  });

  init();
}

bootstrap();
