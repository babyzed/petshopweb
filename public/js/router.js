// router.js — روتر Hash ساده با پشتیبانی از mount/cleanup
const routes = [];
let current = null;

export function register(path, def) {
  routes.push({ path, def });
}

function match(hash) {
  const clean = hash.replace(/^#\/?/, '');
  const [pathPart, queryStr = ''] = clean.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = new URLSearchParams(queryStr);

  for (const r of routes) {
    const parts = r.path.split('/').filter(Boolean);
    if (parts.length !== segments.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(segments[i]);
      else if (parts[i] !== segments[i]) { ok = false; break; }
    }
    if (ok) return { def: r.def, params, query, path: pathPart };
  }
  return { def: routes.find(r => r.path === '*')?.def || null, params: {}, query, path: pathPart };
}

export async function navigate() {
  // بستن المان‌های شناور هنگام ناوبری
  const drawer = document.getElementById('cart-drawer');
  if (drawer && drawer.classList.contains('open')) {
    drawer.classList.remove('open');
    setTimeout(() => { drawer.hidden = true; }, 320);
  }
  const ov = document.getElementById('search-overlay');
  if (ov && !ov.hidden) { ov.hidden = true; ov.innerHTML = ''; }

  const m = match(location.hash || '#/');
  if (!m.def) {
    document.getElementById('view').innerHTML = '<div class="page-error"><div class="pe-ic">🐾</div><h2>صفحه پیدا نشد</h2><p>صفحه مورد نظر شما وجود ندارد.</p><a class="btn btn-primary" href="#/">بازگشت به خانه</a></div>';
    document.title = 'صفحه پیدا نشد | پت‌شاپ';
    return;
  }
  if (current && current.cleanup) { try { current.cleanup(); } catch (e) {} }
  const view = document.getElementById('view');
  view.scrollTop = 0;
  window.scrollTo({ top: 0 });

  if (m.def.title) document.title = m.def.title(m.params, m.query) + ' | پت‌شاپ';

  // skeleton
  view.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div>در حال بارگذاری...</div></div>';

  try {
    const html = await m.def.render(m.params, m.query);
    view.innerHTML = html;
    current = null;
    if (m.def.mount) {
      const ret = m.def.mount(view, m.params, m.query);
      if (typeof ret === 'function') current = { cleanup: ret };
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = '<div class="page-error"><div class="pe-ic">😿</div><h2>خطا در بارگذاری</h2><p>' + (e.message || 'خطای ناشناخته') + '</p><button class="btn btn-primary" onclick="location.reload()">تلاش دوباره</button></div>';
  }
  document.querySelectorAll('#bottom-nav .bn-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === (m.path || '/'));
  });
  document.querySelectorAll('#bottom-nav .bn-item').forEach(el => {
    if (m.path.startsWith(el.dataset.match || '___')) el.classList.add('active');
  });
}

export function initRouter() {
  window.addEventListener('hashchange', navigate);
  navigate();
}
