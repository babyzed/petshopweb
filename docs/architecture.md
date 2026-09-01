# 🐾 پت‌شاپ حرفه‌ای — سند معماری پروژه

> نسخه: ۱.۰ — تاریخ: ۱۴۰۵/۰۶/۰۷
> این سند، نقشه‌ی کامل پروژه است: ساختار صفحات، کامپوننت‌ها، دیتابیس، نقش‌ها و دسترسی‌ها.

---

## ۱. چشم‌انداز کلی

یک فروشگاه اینترنتی کامل برای محصولات حیوانات خانگی با دو اپلیکیشن مجزا:

| بخش | توضیح |
|---|---|
| **فروشگاه (Storefront)** | سایت اصلی مشتری‌ها — فارسی، RTL، با UI اختصاصی موبایل و دسکتاپ |
| **پنل مدیریت (Admin Panel)** | مدیریت کامل فروشگاه بدون حتی یک خط تغییر کد |

**اصل طلایی:** هیچ محتوای قابل‌تغییر (محصول، قیمت، بنر، متن، تصویر، سفارش، نقش) در کد Hard Code نشده است؛ همه‌چیز Database Driven است.

---

## ۲. تکنولوژی‌ها

| لایه | انتخاب | دلیل |
|---|---|---|
| Backend | Node.js + Express (REST API) | سبک، سریع، قابل توسعه |
| Database | SQLite (better-sqlite3) | بدون نیاز به سرویس جدا، فایل‌محور، امن برای مقیاس این پروژه |
| Auth | JWT + bcryptjs | توکن‌محور، رمزنگاری شده |
| Frontend | Vanilla JS (ES Modules) + SPA با Hash Router | بدون بیلد، فوق‌سریع، کاملاً Modular |
| فونت | Vazirmatn (self-hosted woff2) | فونت فارسی مدرن و خوانا |
| آپلود | Multer → پوشه uploads | آپلود تصویر محصول/مقاله/بنر توسط مدیر |

**تفکیک فرانت و بک‌اند:** فرانت‌اند فقط از REST API (`/api/*`) داده می‌گیرد؛ هیچ داده‌ای در فرانت Hard Code نیست.

---

## ۳. ساختار پوشه‌ها

```
petshop/
├── server/
│   ├── index.js            # راه‌اندازی Express، static، mount مسیرها
│   ├── db.js               # اتصال SQLite + ساخت جداول (Schema)
│   ├── seed.js             # داده‌های اولیه (محصول، بنر، مقاله، تنظیمات...)
│   ├── auth.js             # JWT + میدل‌ور احراز هویت و دسترسی
│   ├── permissions.js      # کاتالوگ دسترسی‌ها (Permission Catalog)
│   ├── upload.js           # کانفیگ Multer
│   └── routes/
│       ├── auth.js         # ورود/ثبت‌نام/فراموشی رمز/پروفایل
│       ├── public.js       # API عمومی فروشگاه (خانه، محصولات، مقالات...)
│       ├── orders.js       # سبد، سفارش، کد تخفیف، آدرس، علاقه‌مندی
│       └── admin.js        # همه CRUD های پنل مدیریت + آمار داشبورد
├── public/                 # اپلیکیشن فروشگاه
│   ├── index.html
│   ├── css/store.css
│   ├── js/ (api, router, components, pages/*)
│   └── assets/ (fonts, img)
├── admin/                  # اپلیکیشن پنل مدیریت
│   ├── index.html
│   ├── css/admin.css
│   └── js/ (api, router, pages/*)
├── uploads/                # تصاویر آپلودی مدیر
├── data/petshop.db         # دیتابیس
├── docs/architecture.md    # همین سند
└── README.md
```

---

## ۴. نقشه صفحات — فروشگاه (Storefront)

مسیرها Hash-based هستند (`/#/...`) تا رفرش در هر صفحه‌ای کار کند:

| مسیر | صفحه | نکته‌ها |
|---|---|---|
| `#/` | خانه | Hero Slider، بنر تبلیغاتی، دسته‌ها، پرفروش‌ها (محاسبه از سفارش‌ها)، جدیدترین‌ها، تخفیف‌دارها، ویژه‌ها، برندها، معرفی، مزایا، مقالات، نظرات، خبرنامه |
| `#/shop` | فروشگاه | فیلتر: دسته، برند، قیمت، موجودی، تخفیف، ویژگی؛ مرتب‌سازی؛ صفحه‌بندی |
| `#/category/:slug` | لیست دسته | همان فروشگاه با دسته پیش‌انتخاب |
| `#/product/:slug` | جزئیات محصول | گالری، ویژگی‌ها، امتیاز، نظرات، مرتبط‌ها، افزودن به سبد |
| `#/cart` (Drawer) | سبد خرید | Drawer داینامیک + صفحه چک‌اوت |
| `#/checkout` | تسویه | فرم سریع، کد تخفیف، هزینه ارسال، ثبت سفارش |
| `#/auth` | ورود/ثبت‌نام/فراموشی | طراحی اختصاصی پت‌شاپ با انیمیشن |
| `#/account` | پنل کاربر | پروفایل، آدرس‌ها، سفارش‌ها، علاقه‌مندی‌ها، رمز عبور |
| `#/order/:id` | جزئیات و پیگیری سفارش | روند وضعیت سفارش |
| `#/blog` و `#/blog/:slug` | مجله پت | مقالات پنل‌مدیریتی |
| `#/page/about` | درباره ما | محتوای پنل |
| `#/page/contact` | تماس با ما | اطلاعات تماس از پنل |
| `#/page/faq` | سوالات متداول | از جدول FAQ |
| `#/page/rules` | قوانین | محتوای پنل |
| `#/search/:q` | جستجو | نتایج زنده + صفحه نتایج |

### تفاوت اختصاصی Mobile و Desktop (نه صرفاً Responsive)

| المان | دسکتاپ | موبایل |
|---|---|---|
| هدر | هدر کامل ۳ ردیفه + Mega Menu + نوار جستجو | App Bar فشرده + دکمه جستجوی تمام‌صفحه |
| ناوبری | منوی افقی بالای صفحه | **Bottom Navigation** با ۵ آیتم + دکمه مرکزی سبد |
| کارت محصول | Grid ۴ ستونه، Hover با دکمه سریع | کارت افقی (تصویر راست، اطلاعات چپ) + دکمه بزرگ «+» |
| فیلترها | سایدبار ثابت کنار صفحه | Bottom Sheet از پایین + چیپ‌های دسته |
| سبد | Drawer از راست | صفحه تمام‌صفحه با دکمه بزرگ |
| صفحه محصول | گالری + دکمه‌های کناری | دکمه ثابت (Sticky) افزودن به سبد پایین صفحه |
| تاچ | Hover و هاور منو | اهداف لمسی ≥۴۸px، بدون Hover |

---

## ۵. نقشه صفحات — پنل مدیریت

| مسیر | صفحه | دسترسی |
|---|---|---|
| `#/login` | ورود مدیر | عمومی |
| `#/dashboard` | داشبورد: نمودار فروش ۳۰ روز، درآمد، سفارش‌ها، کاربران جدید، پرفروش‌ها، سفارش‌های اخیر، کم‌موجودی‌ها | dashboard.view |
| `#/products` (+new/edit) | CRUD کامل محصول: قیمت، تخفیف، موجودی، تصاویر، SKU، ویژگی‌ها، وضعیت، ویژه | products.manage |
| `#/categories` | درخت دسته‌ها: ساخت/ویرایش/حذف + ترتیب + تصویر | categories.manage |
| `#/brands` | برندها | brands.manage |
| `#/orders` (+:id) | سفارش‌ها، جزئیات، تغییر وضعیت، اطلاعات مشتری | orders.manage |
| `#/users` (+:id) | کاربران، فعال/غیرفعال، تغییر نقش، مشاهده سفارش‌های کاربر | users.manage |
| `#/reviews` | تایید/رد/حذف نظرات | reviews.manage |
| `#/coupons` | کدهای تخفیف: درصدی/مبلغی، سقف، انقضا | coupons.manage |
| `#/banners` | بنرهای Hero و تبلیغاتی + ترتیب | banners.manage |
| `#/articles` (+new/edit) | مقالات مجله پت + آپلود تصویر | articles.manage |
| `#/home` | **ویرایشگر کامل صفحه اصلی**: تیتر بخش‌ها، نمایش/عدم نمایش، اسلایدهای Hero، بنرها، مزایا، متن معرفی، انتخاب محصولات ویژه | home.manage |
| `#/faq` | سوالات متداول | faq.manage |
| `#/testimonials` | نظرات مشتریان | testimonials.manage |
| `#/pages` | درباره ما / قوانین (متن + تصویر) | pages.manage |
| `#/settings` | اطلاعات تماس، شبکه‌های اجتماعی، فوتر، هزینه ارسال، سقف ارسال رایگان | settings.manage |
| `#/roles` | **ساخت نقش جدید + تعیین دسترسی‌ها** | roles.manage |
| `#/profile` | تغییر رمز مدیر | auth |

### چرخهٔ وضعیت سفارش (Order Status Flow)

وضعیت سفارش بسته به **روش پرداخت** دو مسیر متفاوت دارد:

| روش پرداخت | مسیر وضعیت‌ها | نکته |
|---|---|---|
| **پرداخت در محل (cod)** | `pending` (در انتظار تایید) → `confirmed` (تایید شده) → `shipped` → `delivered` | وجه هنگام تحویل دریافت و `payment_status` روی `paid` ثبت می‌شود |
| **پرداخت آنلاین (online)** | `pending` (در انتظار پرداخت) → `paid` → `shipped` → `delivered` | پرداخت موفق، خودش سفارش را تایید می‌کند؛ مرحلهٔ تایید جداگانه ندارد |

`cancelled` در هر دو مسیر تا پیش از تحویل ممکن است و موجودی انبار + کد تخفیف را برمی‌گرداند.

قانون‌هایی که **سمت سرور** (`PUT /api/admin/orders/:id/status`) اجرا می‌شوند:

- سفارش «پرداخت در محل» فقط از `pending` قابل تایید است (`confirmed`).
- ثبت **ارسال** برای سفارش در محل، پیش از تایید سفارش رد می‌شود.
- سفارش در محل وضعیت `paid` جداگانه نمی‌گیرد (با `delivered` ثبت می‌شود).
- سفارش آنلاین پیش از پرداخت موفق، `shipped`/`delivered` نمی‌شود و `confirmed` هم نمی‌گیرد.
- سفارش `cancelled` یا `delivered` قفل است.

هر تغییر وضعیت در `order_status_history` با نام کاربر تغییردهنده ثبت و در صفحهٔ جزئیات سفارش نمایش داده می‌شود؛ برای تایید، ارسال، تحویل و لغو پیامک اطلاع‌رسانی ارسال می‌شود.

**نمایش در پنل مدیریت:** داشبورد کارت «سفارش‌های در انتظار تایید» با دکمهٔ تایید/لغو سریع دارد، منوی کناری نشان تعداد آن‌ها را نشان می‌دهد و در لیست سفارش‌ها هم دکمهٔ «تایید» روی هر ردیف در انتظار تایید هست. مشتری همان وضعیت را با برچسب «در انتظار تایید» و مرحلهٔ «تایید فروشگاه» در تایم‌لاین سفارش می‌بیند.

---

## ۶. دیتابیس — جداول

```
users            (id, name, email, phone, password_hash, role_id, status, avatar, created_at)
roles            (id, name, title, permissions_json, is_system, created_at)
categories       (id, name, slug, parent_id, image, icon, sort_order, is_active)
brands           (id, name, slug, logo, is_active)
products         (id, name, slug, sku, category_id, brand_id, price, sale_price,
                  stock, weight, description, features_json, status, is_special,
                  views, created_at)
product_images   (id, product_id, image, sort_order)
product_reviews  (id, product_id, user_id, rating, title, comment, status, created_at)
orders           (id, code, user_id, customer_json, status, subtotal, discount,
                  shipping, total, coupon_code, payment_method, note, created_at)
order_items      (id, order_id, product_id, name, image, price, quantity, total)
addresses        (id, user_id, title, full_name, phone, province, city, address, postal_code, is_default)
wishlist         (id, user_id, product_id)
coupons          (id, code, type[percent|fixed], value, min_amount, max_usage, used_count, expires_at, is_active)
banners          (id, title, subtitle, image, link, position[hero|promo], sort_order, is_active)
articles         (id, title, slug, excerpt, content, image, category, status, created_at)
faqs             (id, question, answer, sort_order, is_active)
testimonials     (id, name, role, text, rating, is_active)
settings         (key, value_json)   ← home_settings / contact / socials / footer /
                                       shipping / about_page / rules_page
```

**محاسبه‌های داینامیک (بدون Hard Code):**
- پرفروش‌ها ← مجموع تعداد در `order_items`
- جدیدترین‌ها ← `created_at` محصول
- تخفیف‌دارها ← `sale_price < price`
- ویژه‌ها ← پرچم `is_special` (انتخاب مدیر در پنل)
- کم‌موجودی ← `stock <= threshold`

---

## ۷. نقش‌ها و دسترسی‌ها (Role & Permission)

کاتالوگ دسترسی‌ها (Permission Catalog):

```
dashboard.view · products.manage · categories.manage · brands.manage
orders.manage · users.manage · reviews.manage · coupons.manage
banners.manage · articles.manage · home.manage · faq.manage
testimonials.manage · pages.manage · settings.manage · roles.manage
```

| نقش | دسترسی‌ها |
|---|---|
| **Super Admin** | همه دسترسی‌ها |
| **Admin** | محصولات، دسته‌ها، برندها، سفارش‌ها، کاربران، نظرات، کد تخفیف |
| **Content Manager** | بنرها، مقالات، محتوای خانه، FAQ، نظرات مشتریان، صفحات |
| **Support** | مشاهده سفارش‌ها، کاربران، نظرات (فقط نمایشی) |

مدیر (با دسترسی roles.manage) می‌تواند نقش جدید بسازد و هر ترکیبی از دسترسی‌ها را تعیین کند. دسترسی‌ها در میدل‌ور بک‌اند بررسی می‌شوند — نه فقط در UI.

---

## ۸. کامپوننت‌های مشترک

**فروشگاه:** Header (Desktop/Mobile جدا) · Footer · ProductCard (Grid/Horizontal) · MegaMenu · SearchOverlay · CartDrawer · BottomNav · FilterSheet · Toast · Modal · StarRating · PriceTag · Badge · Breadcrumb · EmptyState · SkeletonLoader

**پنل مدیریت:** Sidebar · Topbar · DataTable · Pagination · FormField · ImageUploader · ConfirmDialog · Toast · StatCard · Chart (SVG: Line/Bar/Donut) · StatusBadge · Modal

---

## ۹. طراحی سیستم (Design System)

| توکن | مقدار |
|---|---|
| رنگ اصلی | نارنجی گرم `#F97316` (دوستانه، اشتها) |
| رنگ ثانویه | سبز طبیعت `#059669` |
| پس‌زمینه | کرم گرم `#FFF9F2` |
| متن | قهوه‌ای تیره `#292524` |
| گوشه‌ها | ۱۶–۲۴px |
| فونت | Vazirmatn (Regular→ExtraBold) |
| آیکون‌ها | SVG اینلاین + ایموجی دسته‌ها |
| انیمیشن | فقط transform/opacity، ≤۲۵۰ms |

**Performance & SEO:** Lazy-load تصاویر، تصاویر بهینه، بدون کتابخانه سنگین، HTML معنایی (header/main/section/article/nav)، متاتگ داینامیک، JSON-LD محصولات، sitemap.xml خودکار، ARIA و ناوبری کیبورد.

---

## ۱۰. مراحل پیاده‌سازی

1. ✅ زیرساخت + فونت + دیتابیس + Seed (محصولات، دسته‌ها، نقش‌ها، تنظیمات)
2. ✅ بک‌اند: REST API کامل + احراز هویت + دسترسی‌ها
3. ✅ فروشگاه: صفحه خانه + فروشگاه + محصول + سبد + چک‌اوت
4. ✅ حساب کاربری + ورود/ثبت‌نام اختصاصی
5. ✅ پنل مدیریت: داشبورد + محصولات + سفارشات + کاربران
6. ✅ پنل مدیریت: محتوا (بنر، مقاله، خانه، صفحات، FAQ، نظرات)
7. ✅ تنظیمات + نقش‌ها و دسترسی‌ها
8. ✅ تست سراسری + رفع خطا + بهینه‌سازی
