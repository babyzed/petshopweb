// admin/js/app.js — نقطه ورود پنل مدیریت
import { AdminAPI } from './api.js';
import { renderSidebar, renderTopbar } from './components.js';
import { init } from './router.js';

function bootstrap() {
  if (AdminAPI.token && AdminAPI.user) {
    renderSidebar();
    renderTopbar();
    document.body.classList.add('logged-in');
    // بستن سایدبار موبایل با کلیک روی لینک
    document.addEventListener('click', (e) => {
      if (e.target.closest('.as-link')) {
        document.getElementById('admin-sidebar').classList.remove('open');
      }
    });
  } else {
    document.getElementById('admin-sidebar').innerHTML = '';
    document.getElementById('admin-topbar').innerHTML = '';
  }
  init();
}

bootstrap();
