// store.js — مدیریت state: سبد خرید، نشست کاربر، علاقه‌مندی، تنظیمات
import { API, currentPrice } from './api.js';

const Cart = {
  items: JSON.parse(localStorage.getItem('ps_cart') || '[]'),
  _listeners: [],

  subscribe(fn) { this._listeners.push(fn); },
  _emit() {
    localStorage.setItem('ps_cart', JSON.stringify(this.items));
    this._listeners.forEach(fn => fn(this));
  },

  count() { return this.items.reduce((s, i) => s + i.quantity, 0); },
  subtotal() { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); },

  find(id) { return this.items.find(i => i.product_id === id); },

  add(product, qty = 1) {
    const ex = this.find(product.id);
    if (ex) ex.quantity = Math.min(99, ex.quantity + qty);
    else this.items.push({
      product_id: product.id,
      name: product.name,
      slug: product.slug,
      image: product.image,
      price: currentPrice(product),
      old_price: product.price,
      stock: product.stock,
      quantity: qty,
    });
    this._emit();
  },

  setQty(id, qty) {
    const it = this.find(id);
    if (!it) return;
    it.quantity = Math.max(1, Math.min(99, qty));
    if (it.quantity > it.stock) it.quantity = it.stock;
    this._emit();
  },

  remove(id) {
    this.items = this.items.filter(i => i.product_id !== id);
    this._emit();
  },

  clear() { this.items = []; this._emit(); },
};

const Session = {
  user: JSON.parse(localStorage.getItem('ps_user') || 'null'),
  wishlist: new Set(JSON.parse(localStorage.getItem('ps_wish') || '[]')),
  _listeners: [],

  subscribe(fn) { this._listeners.push(fn); },
  _emit() {
    localStorage.setItem('ps_user', JSON.stringify(this.user));
    localStorage.setItem('ps_wish', JSON.stringify([...this.wishlist]));
    this._listeners.forEach(fn => fn(this));
  },

  get isLoggedIn() { return !!this.user; },
  get isAdmin() { return !!(this.user && this.user.is_admin); },

  setUser(u) {
    this.user = u;
    this._emit();
  },
  logout() {
    this.user = null;
    this.wishlist = new Set();
    API.clearToken();
    this._emit();
  },

  toggleWish(id) {
    if (this.wishlist.has(id)) {
      this.wishlist.delete(id);
      if (this.isLoggedIn) API.del('/auth/wishlist/' + id).catch(() => {});
    } else {
      this.wishlist.add(id);
      if (this.isLoggedIn) API.post('/auth/wishlist', { product_id: id }).catch(() => {});
    }
    this._emit();
  },
  isWished(id) { return this.wishlist.has(id); },

  async loadWishlist() {
    if (!this.isLoggedIn) return;
    try {
      const { ids } = await API.get('/auth/wishlist');
      this.wishlist = new Set(ids);
      this._emit();
    } catch (e) {}
  },
};

// کش تنظیمات عمومی (تماس، فوتر...)
const Settings = {
  data: null,
  async get() {
    if (this.data) return this.data;
    try {
      this.data = await API.get('/settings/public');
      return this.data;
    } catch (e) { return {}; }
  },
};

export { Cart, Session, Settings };
