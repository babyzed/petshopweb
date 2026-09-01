// api.js — کلاینت REST API
export const API = {
  token: localStorage.getItem('ps_token') || null,

  get tokenHeader() {
    return this.token ? { Authorization: 'Bearer ' + this.token } : {};
  },

  async request(method, url, body = null) {
    const opts = { method, headers: { ...this.tokenHeader } };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api' + url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'خطا در ارتباط با سرور');
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get: (u) => API.request('GET', u),
  post: (u, b) => API.request('POST', u, b),
  put: (u, b) => API.request('PUT', u, b),
  del: (u) => API.request('DELETE', u),

  setToken(t) { this.token = t; localStorage.setItem('ps_token', t); },
  clearToken() { this.token = null; localStorage.removeItem('ps_token'); },
};

// ---------- ابزار فرمت فارسی ----------
// escape امن برای متن‌های کاربرمحور (جلوگیری از XSS هنگام تزریق در HTML)
export const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const faNum = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
export const price = (n) => faNum(Number(n || 0).toLocaleString('en-US'));
export const dateFa = (iso) => {
  try { return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return iso; }
};
export const timeFa = (iso) => {
  try { return new Date(iso).toLocaleString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};
export const discountPct = (p) => p.sale_price && p.sale_price < p.price ? Math.round((1 - p.sale_price / p.price) * 100) : 0;
export const currentPrice = (p) => (p.sale_price && p.sale_price < p.price) ? p.sale_price : p.price;
export const faDigits = (s) => faNum(s);
