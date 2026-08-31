// auth.js — JWT + میدل‌ورهای احراز هویت و دسترسی
const jwt = require('jsonwebtoken');
const { db } = require('./db');
const { hasPermission } = require('./permissions');

const JWT_SECRET = process.env.JWT_SECRET || 'petshop-secret-key-1405';
const TOKEN_EXPIRY = '7d';

// در production با secret پیش‌فرض، توکن‌ها قابل جعل‌اند — جلوی بالا آمدن سرور گرفته شود
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'petshop-secret-key-1405') {
  throw new Error(
    'JWT_SECRET تنظیم نشده است. در محیط production باید یک مقدار تصادفی در .env قرار دهید:\n' +
    'node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  );
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role_name, role_id: user.role_id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function getRolePerms(roleId) {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
  if (!role) return [];
  try { return JSON.parse(role.permissions); } catch { return []; }
}

// افزودن اطلاعات نقش به کاربر
function withRole(user) {
  const role = db.prepare('SELECT id, name, title, permissions FROM roles WHERE id = ?').get(user.role_id);
  let perms = [];
  if (role) {
    try { perms = JSON.parse(role.permissions); } catch { perms = []; }
  }
  return {
    ...user,
    role_name: role ? role.name : 'user',
    role_title: role ? role.title : 'کاربر',
    permissions: perms,
    is_admin: !!(role && (perms.includes('*') || perms.length > 0)),
  };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'برای این عملیات باید وارد حساب شوید.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'حساب کاربری شما غیرفعال است.' });
    }
    req.user = withRole(user);
    next();
  } catch {
    return res.status(401).json({ error: 'نشست شما منقضی شده است. دوباره وارد شوید.' });
  }
}

// بررسی دسترسی — کاربرد: requirePerm('products.manage')
function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'ابتدا وارد شوید.' });
    if (!hasPermission(req.user.permissions, perm)) {
      return res.status(403).json({ error: 'شما دسترسی لازم برای این عملیات را ندارید.' });
    }
    next();
  };
}

// میدل‌ور اختیاری: اگر توکن معتبر باشد کاربر را متصل می‌کند، در غیر این صورت ادامه می‌دهد
// (کاربرد: ثبت سفارش مهمان — پردازش بدون لاگین مجاز است)
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (user && user.status === 'active') {
      req.user = withRole(user);
    }
  } catch {
    // توکن نامعتبر/منقضی — کاربر مهمان در نظر گرفته می‌شود
  }
  next();
}

module.exports = { signToken, authRequired, requirePerm, optionalAuth, withRole, getRolePerms };
