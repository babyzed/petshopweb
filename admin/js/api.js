// admin/js/api.js — کلاینت API پنل مدیریت
export const AdminAPI = {
  token: localStorage.getItem('ps_admin_token') || null,
  user: JSON.parse(localStorage.getItem('ps_admin_user') || 'null'),

  async request(method, url, body = null) {
    const opts = { method, headers: {} };
    if (this.token) opts.headers['Authorization'] = 'Bearer ' + this.token;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api' + url, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/auth/login') {
      this.logout();
      location.hash = '#/login';
      throw new Error('نشست شما منقضی شده است');
    }
    if (!res.ok) throw new Error(data.error || 'خطا در ارتباط با سرور');
    return data;
  },
  get: (u) => AdminAPI.request('GET', u),
  post: (u, b) => AdminAPI.request('POST', u, b),
  put: (u, b) => AdminAPI.request('PUT', u, b),
  del: (u) => AdminAPI.request('DELETE', u),

  setSession(token, user) { this.token = token; this.user = user; localStorage.setItem('ps_admin_token', token); localStorage.setItem('ps_admin_user', JSON.stringify(user)); },
  logout() { this.token = null; this.user = null; localStorage.removeItem('ps_admin_token'); localStorage.removeItem('ps_admin_user'); },

  hasPerm(p) { return !!(this.user && (this.user.permissions?.includes('*') || this.user.permissions?.includes(p))); },
  isSuper() { return !!(this.user && this.user.permissions?.includes('*')); },
};

export const faNum = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
// escape امن برای متن‌های کاربرمحور (جلوگیری از XSS هنگام تزریق در HTML)
export const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const price = (n) => faNum(Number(n || 0).toLocaleString('en-US'));
export const faDate = (iso) => { try { return new Date(iso).toLocaleString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };

export async function uploadImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + AdminAPI.token }, body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'خطا در آپلود');
  return data.url;
}
