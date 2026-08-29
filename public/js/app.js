// app.js — نقطه ورود اپلیکیشن فروشگاه
import { register, initRouter } from './router.js';
import { renderHeader, renderMobileHeader, renderFooter, renderBottomNav, updateCartBadges, bindGlobalEvents, closeCart } from './components.js';
import { Cart, Session } from './store.js';
import * as home from './pages/home.js';
import * as shop from './pages/shop.js';
import * as product from './pages/product.js';
import * as checkout from './pages/checkout.js';
import * as auth from './pages/auth.js';
import * as account from './pages/account.js';
import * as blog from './pages/blog.js';
import * as pages from './pages/pages.js';
import * as order from './pages/order.js';
import * as search from './pages/search.js';

async function bootstrap() {
  try { await renderHeader(); } catch (e) { console.error(e); }
  renderMobileHeader();
  renderFooter();
  renderBottomNav();

  // ---------- ثبت مسیرها ----------
  register('/', {
    title: () => 'فروشگاه اینترنتی محصولات حیوانات خانگی',
    render: (p, q) => home.render(p, q),
    mount: (el) => { home.mount(el); return () => home.cleanup && home.cleanup(); },
  });
  register('shop', { render: (p, q) => shop.render(p, q), mount: (el, p, q) => shop.mount(el, p, q) });
  register('category/:slug', {
    render: (p, q) => { const q2 = new URLSearchParams(q); q2.set('category', p.slug); return shop.render(p, q2); },
    mount: (el, p, q) => { const q2 = new URLSearchParams(q); q2.set('category', p.slug); return shop.mount(el, p, q2); },
  });
  register('product/:slug', { render: (p, q) => product.render(p, q), mount: (el, p, q) => product.mount(el, p, q) });
  register('checkout', { render: () => checkout.render(), mount: (el) => checkout.mount(el) });
  register('auth', { render: () => auth.render(), mount: (el) => auth.mount(el) });
  register('account', { render: (p, q) => account.render(p, q), mount: (el, p, q) => account.mount(el, p, q) });
  register('order/:id', { render: (p) => order.render(p), mount: (el, p) => order.mount(el, p) });
  register('blog', { render: () => blog.render({}) });
  register('blog/:slug', { render: (p) => blog.render(p) });
  register('page/:key', { render: (p) => pages.render(p), mount: (el, p) => pages.mount(el, p) });
  register('search/:q', { render: (p) => search.render(p) });

  // ---------- رویدادهای سراسری ----------
  bindGlobalEvents();
  updateCartBadges();
  Cart.subscribe(updateCartBadges);

  initRouter();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const ov = document.getElementById('search-overlay');
      if (!ov.hidden) ov.hidden = true;
      closeCart();
    }
  });

  if (Session.isLoggedIn) Session.loadWishlist();

  console.log('%c🐾 پت‌شاپ', 'font-size:18px;font-weight:bold;color:#F97316');
}

bootstrap().catch(e => console.error('bootstrap error', e));
