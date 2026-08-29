// permissions.js — کاتالوگ مرکزی دسترسی‌ها (Role & Permission)
// هر دسترسی جدید که به سیستم اضافه شود، باید در همین کاتالوگ ثبت شود.

const PERMISSION_CATALOG = [
  { key: 'dashboard.view',   label: 'مشاهده داشبورد',       group: 'داشبورد' },
  { key: 'products.manage',  label: 'مدیریت محصولات',       group: 'فروشگاه' },
  { key: 'categories.manage',label: 'مدیریت دسته‌بندی‌ها',   group: 'فروشگاه' },
  { key: 'brands.manage',    label: 'مدیریت برندها',         group: 'فروشگاه' },
  { key: 'orders.manage',    label: 'مدیریت سفارش‌ها',       group: 'فروشگاه' },
  { key: 'users.manage',     label: 'مدیریت کاربران',        group: 'فروشگاه' },
  { key: 'reviews.manage',   label: 'مدیریت نظرات محصولات',  group: 'فروشگاه' },
  { key: 'coupons.manage',   label: 'مدیریت کدهای تخفیف',    group: 'فروشگاه' },
  { key: 'banners.manage',   label: 'مدیریت بنرها',          group: 'محتوا' },
  { key: 'articles.manage',  label: 'مدیریت مقالات',         group: 'محتوا' },
  { key: 'home.manage',      label: 'مدیریت محتوای صفحه اصلی', group: 'محتوا' },
  { key: 'faq.manage',       label: 'مدیریت سوالات متداول',  group: 'محتوا' },
  { key: 'testimonials.manage', label: 'مدیریت نظرات مشتریان', group: 'محتوا' },
  { key: 'pages.manage',     label: 'مدیریت صفحات (درباره ما، قوانین)', group: 'محتوا' },
  { key: 'settings.manage',  label: 'مدیریت تنظیمات و اطلاعات تماس', group: 'تنظیمات' },
  { key: 'roles.manage',     label: 'مدیریت نقش‌ها و دسترسی‌ها', group: 'تنظیمات' },
];

// نقش‌های سیستمی پیش‌فرض
const DEFAULT_ROLES = [
  { name: 'super_admin', title: 'مدیر کل',        is_system: 1, permissions: ['*'] },
  { name: 'admin',       title: 'مدیر فروشگاه',  is_system: 0, permissions: [
      'dashboard.view','products.manage','categories.manage','brands.manage',
      'orders.manage','users.manage','reviews.manage','coupons.manage',
  ]},
  { name: 'content',     title: 'مدیر محتوا',    is_system: 0, permissions: [
      'dashboard.view','banners.manage','articles.manage','home.manage',
      'faq.manage','testimonials.manage','pages.manage',
  ]},
  { name: 'support',     title: 'پشتیبانی',      is_system: 0, permissions: [
      'dashboard.view','orders.manage','users.manage',
  ]},
];

function hasPermission(perms, required) {
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(required);
}

module.exports = { PERMISSION_CATALOG, DEFAULT_ROLES, hasPermission };
