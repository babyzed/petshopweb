// seed.js — داده‌های اولیه دیتابیس (فقط اولین اجرا)
const bcrypt = require('bcryptjs');
const { db, setSetting } = require('./db');
const { DEFAULT_ROLES } = require('./permissions');

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (existing > 0) return false;

  // ---------- نقش‌ها ----------
  const roleIds = {};
  DEFAULT_ROLES.forEach(r => {
    const info = db.prepare('INSERT INTO roles (name, title, permissions, is_system) VALUES (?,?,?,?)')
      .run(r.name, r.title, JSON.stringify(r.permissions), r.is_system);
    roleIds[r.name] = info.lastInsertRowid;
  });
  // نقش مشتری
  roleIds.customer = db.prepare('INSERT INTO roles (name, title, permissions, is_system) VALUES (?,?,?,0)')
    .run('customer', 'مشتری', '[]').lastInsertRowid;

  const hash = p => bcrypt.hashSync(p, 10);
  const addUser = (name, email, phone, pass, roleId) =>
    db.prepare('INSERT INTO users (name, email, phone, password_hash, role_id) VALUES (?,?,?,?,?)')
      .run(name, email, phone, hash(pass), roleId).lastInsertRowid;

  // ---------- کاربران ----------
  const uAdmin = addUser('مدیر سیستم', 'admin@petshop.ir', '09120000001', 'admin123', roleIds.super_admin);
  const uManager = addUser('مدیر فروشگاه', 'manager@petshop.ir', '09120000002', 'admin123', roleIds.admin);
  const uContent = addUser('مدیر محتوا', 'content@petshop.ir', '09120000003', 'admin123', roleIds.content);
  const uSupport = addUser('پشتیبانی', 'support@petshop.ir', '09120000004', 'admin123', roleIds.support);
  const u1 = addUser('سارا محمدی', 'sara@gmail.com', '09121111111', '123456', roleIds.customer);
  const u2 = addUser('علی رضایی', 'ali@gmail.com', '09122222222', '123456', roleIds.customer);
  const u3 = addUser('نگار کریمی', 'negar@gmail.com', '09123333333', '123456', roleIds.customer);
  const u4 = addUser('امیر حسینی', 'amir@gmail.com', '09124444444', '123456', roleIds.customer);
  const u5 = addUser('مینا احمدی', 'mina@gmail.com', '09125555555', '123456', roleIds.customer);
  const u6 = addUser('حسین قاسمی', 'hossein@gmail.com', '09126666666', '123456', roleIds.customer);
  const u7 = addUser('لیلا مرادی', 'leila@gmail.com', '09127777777', '123456', roleIds.customer);

  // ---------- دسته‌بندی‌ها ----------
  const cat = (name, slug, image, icon, parent = null, sort = 0) =>
    db.prepare('INSERT INTO categories (name, slug, parent_id, image, icon, sort_order, is_active) VALUES (?,?,?,?,?,?,1)')
      .run(name, slug, parent, image, icon, sort).lastInsertRowid;

  const cDogFood = cat('غذای سگ', 'dog-food', '/assets/img/categories/dog-food.jpg', '🐕', null, 1);
  const cCatFood = cat('غذای گربه', 'cat-food', '/assets/img/categories/cat-food.jpg', '🐈', null, 2);
  const cTreats = cat('تشویقی', 'treats', '/assets/img/categories/treats.jpg', '🦴', null, 3);
  const cHygiene = cat('لوازم بهداشتی', 'hygiene', '/assets/img/categories/hygiene.jpg', '🧴', null, 4);
  const cToys = cat('اسباب‌بازی', 'toys', '/assets/img/categories/toys.jpg', '🧸', null, 5);
  const cCare = cat('لوازم نگهداری', 'care', '/assets/img/categories/care.jpg', '✂️', null, 6);
  const cCollars = cat('قلاده و بند', 'collars', '/assets/img/categories/collars.webp', '🎗️', cCare, 1);
  const cBedding = cat('جای خواب', 'bedding', '/assets/img/categories/bedding.jpg', '🛏️', cCare, 2);
  const cTravel = cat('لوازم سفر', 'travel', '/assets/img/categories/travel.jpg', '🎒', cCare, 3);
  const cSupp = cat('مکمل‌ها', 'supplements', '/assets/img/categories/supplements.jpg', '💊', null, 7);
  const cOther = cat('سایر محصولات', 'others', '/assets/img/categories/other.jpg', '🎁', null, 8);
  const cBirds = cat('محصولات پرندگان', 'birds', '/assets/img/categories/birds.jpg', '🐦', cOther, 1);
  const cRodents = cat('محصولات جوندگان', 'rodents', '/assets/img/categories/rodents.jpg', '🐹', cOther, 2);
  const cFish = cat('محصولات ماهی', 'fish', '/assets/img/categories/fish.jpg', '🐠', cOther, 3);

  // ---------- برندها ----------
  const brand = (name, slug) =>
    db.prepare('INSERT INTO brands (name, slug, is_active) VALUES (?,?,1)').run(name, slug).lastInsertRowid;
  const bPetLife = brand('پت‌لایف', 'petlife');
  const bPetPars = brand('پت پارس', 'petpars');
  const bMaster = brand('مستر پت', 'masterpet');
  const bPetCare = brand('پت‌کر', 'petcare');
  const bNature = brand('طبیعت پت', 'naturepet');
  const bZoomart = brand('زومارت', 'zoomart');
  const bPetland = brand('پت‌لند', 'petland');
  const bAqua = brand('آکواپت', 'aquapet');

  // ---------- محصولات ----------
  const img = p => `/assets/img/products/${p}`;
  const catImg = c => c;
  const product = (name, slug, sku, category_id, brand_id, price, sale_price, stock, weight, description, features, is_special, status = 'active') =>
    db.prepare(`INSERT INTO products (name, slug, sku, category_id, brand_id, price, sale_price, stock, weight, description, features, is_special, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(name, slug, sku, category_id, brand_id, price, sale_price, stock, weight, description, JSON.stringify(features), is_special ? 1 : 0, status).lastInsertRowid;

  const gallery = (pid, ...imgs) => imgs.forEach((im, i) =>
    db.prepare('INSERT INTO product_images (product_id, image, sort_order) VALUES (?,?,?)').run(pid, im, i));

  // غذای گربه
  let pid = product('غذای خشک گربه بالغ با طعم مرغ', 'adult-cat-food-chicken', 'CF-1001', cCatFood, bPetLife, 1250000, 1050000, 24, '۲ کیلوگرم',
    'غذای کامل و متعادل برای گربه‌های بالغ با طعم مرغ؛ سرشار از پروتئین باکیفیت، تائورین و اسیدهای چرب امگا ۳ و ۶ برای سلامت پوست و مو. بدون رنگ‌های مصنوعی و نگهدارنده.',
    { 'سن': 'بالغ', 'طعم': 'مرغ', 'پروتئین': '۳۲٪', 'وزن بسته': '۲ کیلوگرم', 'مناسب برای': 'همه نژادها' }, true);
  gallery(pid, img('p28.jpg'), img('p01.jpg'), catImg('/assets/img/categories/cat-food.jpg'));

  pid = product('غذای خشک گربه بچه‌گربه با طعم ماهی', 'kitten-cat-food-fish', 'CF-1002', cCatFood, bPetPars, 890000, null, 30, '۱.۵ کیلوگرم',
    'فرموله‌شده مخصوص بچه‌گربه‌های ۲ تا ۱۲ ماه؛ با کلسیم و فسفر متعادل برای رشد استخوان‌ها و DHA برای رشد مغز و بینایی.',
    { 'سن': 'بچه‌گربه', 'طعم': 'ماهی', 'پروتئین': '۳۴٪', 'وزن بسته': '۱.۵ کیلوگرم' }, false);

  pid = product('غذای مرطوب گربه تن ماهی در سس — ۸۵ گرم ×۱۲', 'wet-cat-food-tuna-85g-x12', 'CF-2001', cCatFood, bPetLife, 850000, 740000, 40, '۱۲ عدد × ۸۵ گرم',
    'بسته ۱۲ عددی غذای مرطوب گربه با تکه‌های تن ماهی در سس خوش‌طعم؛ رطوبت بالا برای سلامت کلیه و دستگاه ادراری، مناسب برای گربه‌های حساس.',
    { 'نوع': 'غذای مرطوب', 'طعم': 'تن ماهی', 'تعداد': '۱۲ عدد', 'وزن هر عدد': '۸۵ گرم' }, false);
  gallery(pid, img('p03.webp'));

  // غذای سگ
  pid = product('غذای خشک سگ نژاد بزرگ با گوشت گوساله', 'large-breed-dog-food-beef', 'DF-1001', cDogFood, bPetPars, 1890000, 1650000, 18, '۳ کیلوگرم',
    'غذای کامل سگ‌های نژاد بزرگ (بالای ۲۵ کیلوگرم)؛ حاوی گلوکزامین و کندرویتین برای سلامت مفاصل و پروتئین بالا برای حفظ عضله. مناسب سگ‌های بالغ.',
    { 'نژاد': 'بزرگ', 'طعم': 'گوشت گوساله', 'پروتئین': '۲۶٪', 'وزن بسته': '۳ کیلوگرم', 'سن': 'بالغ' }, true);
  gallery(pid, img('p02.jpg'), catImg('/assets/img/categories/dog-food.jpg'));

  pid = product('غذای خشک سگ نژاد کوچک با مرغ', 'small-breed-dog-food-chicken', 'DF-1002', cDogFood, bPetLife, 980000, null, 26, '۱.۵ کیلوگرم',
    'مخصوص سگ‌های نژاد کوچک؛ دانه‌های کوچک برای جویدن آسان، با آنتی‌اکسیدان‌ها و امگا ۳ برای پوست و موی سالم.',
    { 'نژاد': 'کوچک', 'طعم': 'مرغ', 'پروتئین': '۲۸٪', 'وزن بسته': '۱.۵ کیلوگرم' }, false);

  pid = product('غذای خشک سگ پاپی با شیر', 'puppy-dog-food-milk', 'DF-1003', cDogFood, bMaster, 760000, 690000, 22, '۱ کیلوگرم',
    'غذای مخصوص توله‌سگ‌ها تا ۱۲ ماه؛ با کلسیم برای رشد استخوان، پروتئین بالا و طعم شیر برای اشتهای بهتر.',
    { 'سن': 'توله', 'طعم': 'شیر و مرغ', 'پروتئین': '۳۰٪', 'وزن بسته': '۱ کیلوگرم' }, false);

  // تشویقی
  pid = product('تشویقی استخوانی سگ با طعم مرغ — ۵۰۰ گرم', 'dog-bone-treats-chicken-500g', 'TR-1001', cTreats, bNature, 320000, 280000, 60, '۵۰۰ گرم',
    'تشویقی‌های استخوانی خوش‌طعم با بافت ترد؛ مناسب آموزش و پاداش. بدون شکر، نمک اضافه و مواد مصنوعی.',
    { 'نوع': 'استخوانی', 'طعم': 'مرغ', 'وزن': '۵۰۰ گرم' }, false);
  gallery(pid, img('p04.jpg'));

  pid = product('تشویقی مخصوص آموزش سگ — ۲۵۰ گرم', 'dog-training-treats-250g', 'TR-1002', cTreats, bPetCare, 480000, 399000, 35, '۲۵۰ گرم',
    'تشویقی نرم و خوش‌عطر در ابعاد کوچک؛ ایده‌آل برای آموزش و تقویت رفتارهای مثبت. مناسب همه نژادها.',
    { 'نوع': 'نرم', 'طعم': 'مرغ', 'وزن': '۲۵۰ گرم' }, false);
  gallery(pid, img('p05.jpg'));

  // لوازم بهداشتی
  pid = product('شامپو ضدحساسیت سگ و گربه — ۵۰۰ میلی‌لیتر', 'hypoallergenic-pet-shampoo-500ml', 'HY-1001', cHygiene, bPetCare, 390000, null, 50, '۵۰۰ میلی‌لیتر',
    'شامپوی ملایم و بدون بو برای پوست‌های حساس؛ با pH متعادل مخصوص حیوانات، پاک‌کننده ملایم و مرطوب‌کننده. مناسب سگ و گربه بالای ۳ ماه.',
    { 'حجم': '۵۰۰ میلی‌لیتر', 'نوع': 'ضدحساسیت', 'مناسب برای': 'سگ و گربه' }, false);
  gallery(pid, img('p06.jpg'), img('p07.jpg'));

  pid = product('شامپو جو دوسر و نارگیل سگ — ۱ لیتر', 'oatmeal-coconut-dog-shampoo-1l', 'HY-1002', cHygiene, bZoomart, 620000, 540000, 22, '۱ لیتر',
    'شامپوی مغذی با جو دوسر و روغن نارگیل؛ تسکین خارش و خشکی پوست، براقیت و نرمی موی سگ. رایحه ملایم و ماندگار.',
    { 'حجم': '۱ لیتر', 'نوع': 'مغذی', 'رایحه': 'جو دوسر و نارگیل' }, false);
  gallery(pid, img('p07.jpg'), img('p06.jpg'));

  pid = product('برس خودتمیزکننده موی سگ و گربه', 'self-cleaning-slicker-brush', 'HY-1003', cHygiene, bPetland, 450000, 380000, 30, '۲۰۰ گرم',
    'برس نرم با تیغه‌های ضدخش که با یک دکمه تمیز می‌شود؛ مناسب جداسازی موی مرده و گره مو، با دسته ارگونومیک ضدلغزش.',
    { 'نوع': 'برس نرم', 'رنگ': 'بنفش', 'مناسب برای': 'سگ و گربه' }, false);
  gallery(pid, img('p08.jpg'));

  pid = product('ناخنگیر فلزی گیلوتینی سگ و گربه', 'guillotine-pet-nail-clipper', 'HY-1004', cHygiene, bPetland, 280000, null, 45, '۱۵۰ گرم',
    'ناخنگیر فلزی مقاوم با تیغه فولادی تیز و دسته ضدلغزش؛ برش تمیز و بدون له‌شدگی ناخن، مناسب سگ و گربه متوسط و بزرگ.',
    { 'جنس': 'فلز ضدزنگ', 'مناسب برای': 'سگ و گربه', 'سایز': 'بزرگ' }, false);
  gallery(pid, img('p09.webp'));

  // اسباب‌بازی
  pid = product('توپ هوشمند تشویقی سگ (پازل)', 'dog-puzzle-treat-ball', 'TO-1001', cToys, bMaster, 690000, 590000, 15, '۳۰۰ گرم',
    'توپ پازلی تشویقی با دریچه‌های قابل تنظیم؛ تشویقی‌ها را هنگام بازی بیرون می‌دهد و ذهن سگ را درگیر می‌کند. لاستیک مقاوم و بی‌خطر.',
    { 'جنس': 'لاستیک طبیعی', 'نوع': 'پازلی', 'مناسب برای': 'سگ‌های کوچک و متوسط' }, true);
  gallery(pid, img('p10.jpg'), img('p11.jpg'));

  pid = product('توپ لاستیکی کندخوری سگ', 'slow-feeder-dog-ball', 'TO-1002', cToys, bPetCare, 540000, 460000, 20, '۲۵۰ گرم',
    'توپ تشویقی با شیارهای عمیق برای کندخوری؛ جلوگیری از بلع سریع غذا، سرگرمی طولانی و تقویت هوش سگ.',
    { 'جنس': 'لاستیک مقاوم', 'نوع': 'کندخوری', 'مناسب برای': 'همه نژادها' }, false);
  gallery(pid, img('p11.jpg'), img('p10.jpg'));

  pid = product('چوب بازی پر گربه (فیدر)', 'cat-feather-teaser-wand', 'TO-1003', cToys, bPetland, 260000, null, 80, '۱۰۰ گرم',
    'چوب بازی تعاملی با پرهای رنگی و زنگوله؛ ساعاتی سرگرمی و ورزش برای گربه‌ها، با میله انعطاف‌پذیر و دسته راحت.',
    { 'نوع': 'چوب پر', 'مناسب برای': 'گربه', 'طول': '۵۰ سانتی‌متر' }, false);
  gallery(pid, img('p12.jpg'));

  // قلاده و بند
  pid = product('قلاده چرمی سگ متوسط و بزرگ', 'leather-dog-collar', 'CO-1001', cCollars, bNature, 580000, 499000, 25, '۲۵۰ گرم',
    'قلاده چرم طبیعی با دوخت مقاوم و سگک فلزی ضدزنگ؛ راحت و بادوام، مناسب سگ‌های متوسط و بزرگ.',
    { 'جنس': 'چرم طبیعی', 'سایز': 'متوسط و بزرگ', 'رنگ': 'قهوه‌ای' }, true);
  gallery(pid, img('p13.webp'));

  pid = product('بند نایلونی دولایه سگ — ۱۲۰ سانتی‌متر', 'double-layer-nylon-dog-leash', 'CO-1002', cCollars, bPetPars, 340000, null, 40, '۲۰۰ گرم',
    'بند نایلونی ضخیم و دولایه با قلاب فلزی چرخان؛ مقاوم در برابر کشش، با دسته‌ای نرم و راحت برای پیاده‌روی روزانه.',
    { 'جنس': 'نایلون دولایه', 'طول': '۱۲۰ سانتی‌متر', 'رنگ': 'مشکی' }, false);
  gallery(pid, img('p14.webp'), img('p15.jpg'));

  pid = product('بند نایلونی با قلاب چرخان سگ — ۱۸۰ سانتی‌متر', 'swivel-nylon-dog-leash-180', 'CO-1003', cCollars, bZoomart, 290000, 250000, 38, '۱۸۰ گرم',
    'بند بلند و مقاوم با قلاب چرخان ۳۶۰ درجه که از گره‌خوردن جلوگیری می‌کند؛ مناسب آموزش فراخوانی در پارک.',
    { 'جنس': 'نایلون', 'طول': '۱۸۰ سانتی‌متر', 'رنگ': 'خاکستری' }, false);
  gallery(pid, img('p15.jpg'), img('p14.webp'));

  // جای خواب
  pid = product('جای خواب گرد مخملی سگ و گربه کوچک', 'plush-round-pet-bed', 'BD-1001', cBedding, bMaster, 1150000, 950000, 12, '۱.۲ کیلوگرم',
    'جای خواب گرد با پارچه مخمل نرم و لایه‌ای ضدضربه؛ گرم و راحت با کفی جداشدنی قابل شست‌وشو. مناسب پت‌های کوچک.',
    { 'جنس': 'مخمل', 'سایز': 'کوچک', 'قابل شست‌وشو': 'بله', 'رنگ': 'کرم' }, true);
  gallery(pid, img('p16.jpg'), img('p16b.jpg'));

  pid = product('غار گربه (Cat Cave) پشمی', 'cat-cave-bed', 'BD-1002', cBedding, bPetCare, 1390000, 1190000, 8, '۹۰۰ گرم',
    'غار دست‌بافت پشمی برای حس امنیت و آرامش گربه؛ ساختار فشرده و عایق، مناسب گربه‌های خجالتی و کم‌جمعیت‌دوست.',
    { 'جنس': 'پشم طبیعی', 'سایز': 'متوسط', 'رنگ': 'خاکستری' }, false);
  gallery(pid, img('p17.jpg'));

  // لوازم سفر
  pid = product('کیف حمل سگ و گربه (مناسب هواپیما)', 'soft-sided-pet-carrier', 'TRV-1001', cTravel, bPetland, 890000, 760000, 14, '۱.۸ کیلوگرم',
    'کیف حمل نرم با دیواره‌های توری تنفس‌پذیر از هر چهار طرف؛ مورد تأیید خطوط هوایی، با بند دوش و جیب جانبی.',
    { 'ظرفیت': 'تا ۹ کیلوگرم', 'نوع': 'نرم', 'مورد تایید هواپیما': 'بله', 'رنگ': 'خاکستری' }, false);
  gallery(pid, img('p18.jpg'), img('p18b.jpg'));

  pid = product('بطری آب سفر سگ و گربه — ۶۰۰ میلی‌لیتر', 'portable-pet-water-bottle-600ml', 'TRV-1002', cTravel, bZoomart, 380000, 320000, 33, '۳۰۰ گرم',
    'بطری آب با کاسه تاشو یک‌تکه؛ بدون نشتی، مناسب پیاده‌روی و سفر. با قفل ایمنی و جنس غذایی.',
    { 'حجم': '۶۰۰ میلی‌لیتر', 'نوع': 'سفری', 'جنس': 'پلاستیک غذایی' }, false);
  gallery(pid, img('p19.jpg'), img('p19b.jpg'));

  // مکمل‌ها
  pid = product('روغن سالمون امگا ۳ سگ و گربه — ۲۴۰ میلی‌لیتر', 'salmon-oil-omega3-240ml', 'SP-1001', cSupp, bNature, 720000, 620000, 26, '۲۴۰ میلی‌لیتر',
    'روغن سالمون خالص با امگا ۳ و ۶؛ سلامت پوست و مو، مفاصل و قلب. مناسب سگ و گربه در هر سنی، با طعم ماهی دوست‌داشتنی.',
    { 'حجم': '۲۴۰ میلی‌لیتر', 'مناسب برای': 'سگ و گربه', 'نوع': 'روغن سالمون' }, true);
  gallery(pid, img('p20.jpg'), img('p21.jpg'));

  pid = product('روغن امگا ۳ پوست و مو — ۴۷۵ میلی‌لیتر', 'omega3-skin-coat-475ml', 'SP-1002', cSupp, bPetCare, 1050000, 920000, 10, '۴۷۵ میلی‌لیتر',
    'نسخه بزرگ روغن امگا ۳ برای کاهش ریزش مو، رفع خشکی پوست و درخشش مو؛ مناسب سگ‌های نژاد موبلند.',
    { 'حجم': '۴۷۵ میلی‌لیتر', 'مناسب برای': 'سگ موبلند', 'نوع': 'روغن ماهی' }, false);
  gallery(pid, img('p21.jpg'), img('p20.jpg'));

  pid = product('خمیر مولتی‌ویتامین گربه — ۵۰ گرم', 'cat-multivitamin-paste-50g', 'SP-1003', cSupp, bPetCare, 415000, null, 28, '۵۰ گرم',
    'خمیر مولتی‌ویتامین با ۱۲ ویتامین و مواد معدنی؛ تقویت سیستم ایمنی و اشتهای گربه، با طعم ماهی سالمون.',
    { 'وزن': '۵۰ گرم', 'مناسب برای': 'گربه', 'طعم': 'سالمون' }, false);
  gallery(pid, img('p22.webp'));

  // پرندگان
  pid = product('غذای مخلوط قناری — ۱ کیلوگرم', 'canary-bird-seed-mix-1kg', 'BR-1001', cBirds, bNature, 260000, 220000, 55, '۱ کیلوگرم',
    'ترکیب متعادل دانه‌های قناری با ویتامین‌های افزوده؛ انرژی و شادابی پرنده را تضمین می‌کند.',
    { 'نوع': 'دانه مخلوط', 'مناسب برای': 'قناری', 'وزن': '۱ کیلوگرم' }, false);
  gallery(pid, img('p23.jpg'));

  pid = product('اسباب‌بازی چوبی طوطی با زنگوله', 'parrot-wooden-toy-bell', 'BR-1002', cBirds, bPetland, 490000, 420000, 18, '۲۵۰ گرم',
    'اسباب‌بازی چوبی تعاملی با زنگوله و چرخ؛ سرگرمی و جلوگیری از کسالت طوطی‌های کوچک و متوسط.',
    { 'جنس': 'چوب طبیعی', 'مناسب برای': 'طوطی و ملنگو', 'دارای زنگوله': 'بله' }, false);
  gallery(pid, img('p26.jpg'));

  // جوندگان
  pid = product('غذای مخلوط همستر — ۱ کیلوگرم', 'hamster-food-mix-1kg', 'RD-1001', cRodents, bMaster, 180000, 150000, 48, '۱ کیلوگرم',
    'ترکیب کامل دانه‌ها، غلات و میوه‌های خشک برای همستر و جربیل؛ تنوع بالا برای تغذیه متعادل.',
    { 'نوع': 'مخلوط', 'مناسب برای': 'همستر و جربیل', 'وزن': '۱ کیلوگرم' }, false);
  gallery(pid, img('p24.jpg'));

  // ماهی
  pid = product('غذای پولکی ماهیان گرمسیری — ۱۴۰ گرم', 'tropical-fish-flakes-140g', 'FS-1001', cFish, bAqua, 350000, 290000, 60, '۱۴۰ گرم',
    'غذای پولکی کامل برای ماهیان گرمسیری؛ تقویت رنگ طبیعی و رشد سالم، جذب بالا و کدرنکردن آب.',
    { 'نوع': 'پولکی', 'مناسب برای': 'ماهی گرمسیری', 'وزن': '۱۴۰ گرم' }, false);
  gallery(pid, img('p25.jpg'));

  pid = product('گیاه مصنوعی آکواریوم (ست ۱۱ تایی)', 'aquarium-artificial-plants-set', 'FS-1002', cFish, bAqua, 330000, 280000, 27, '۴۰۰ گرم',
    'ست گیاهان مصنوعی سبز و بنفش برای زیبایی آکواریوم؛ بی‌خطر برای ماهی، بدون تغییر شیمیایی آب.',
    { 'تعداد': '۱۱ عدد', 'جنس': 'پلاستیک ایمن', 'مناسب برای': 'آکواریوم آب شیرین' }, false);
  gallery(pid, img('p27.jpg'));

  // ---------- نظرات محصولات ----------
  const review = (productId, userId, rating, title, comment, status) =>
    db.prepare('INSERT INTO product_reviews (product_id, user_id, rating, title, comment, status) VALUES (?,?,?,?,?,?)')
      .run(productId, userId, rating, title, comment, status);

  review(1, u1, 5, 'عالی بود', 'کیفیت غذا عالیه، گربه‌م عاشقشه. بسته‌بندی هم خیلی تمیز بود.', 'approved');
  review(1, u3, 4, 'خوب', 'غذای خوبیه ولی کاش بسته بزرگ‌تر بود. کیفیت راضی‌کننده است.', 'approved');
  review(1, u5, 5, 'پیشنهاد می‌کنم', 'بعد از دو هفته موی گربه‌م براق‌تر شده. مرسی از پت‌شاپ.', 'approved');
  review(4, u2, 5, 'سگم عاشقشه', 'حیف که زود تموم می‌شه! بهترین غذا برای سگ ژرمن من بود.', 'approved');
  review(4, u6, 4, 'راضی هستم', 'قیمت نسبت به کیفیت مناسبه. ارسال هم سریع بود.', 'approved');
  review(10, u4, 5, 'سرگرم‌کننده', 'توپ پازلی خیلی خوبیه، سگم یک ساعت باهاش سرگرم می‌شه.', 'approved');
  review(14, u7, 3, 'متوسط', 'بند مقاومه ولی کمی سفت بود. بقیه‌اش خوبه.', 'pending');
  review(17, u1, 5, 'جای خواب عالی', 'خیلی نرم و باکیفیت، گربه‌م شب‌ها فقط اونجا می‌خوابه!', 'approved');

  // ---------- کدهای تخفیف ----------
  const coupon = (code, type, value, min, max, expires) =>
    db.prepare('INSERT INTO coupons (code, type, value, min_amount, max_usage, expires_at, is_active) VALUES (?,?,?,?,?,?,1)')
      .run(code, type, value, min, max, expires);
  coupon('WELCOME10', 'percent', 10, 500000, 500, null);
  coupon('SALE200', 'fixed', 200000, 1000000, 200, null);
  const exp = new Date(); exp.setDate(exp.getDate() - 5);
  coupon('OLD5', 'percent', 5, 0, 0, exp.toISOString().slice(0, 10));

  // ---------- بنرها ----------
  const banner = (title, subtitle, image, link, position, sort) =>
    db.prepare('INSERT INTO banners (title, subtitle, image, link, position, sort_order, is_active) VALUES (?,?,?,?,?,?,1)')
      .run(title, subtitle, image, link, position, sort);
  banner('هر آنچه حیوان خانگی‌تان می‌خواهد', 'از غذای سالم تا اسباب‌بازی شاد؛ همه‌چیز برای خوشحالی پت شما', '/assets/img/hero/hero-1.jpg', '/#/shop', 'hero', 1);
  banner('دنیای شادی برای پت شما', 'با ۳۰٪ تخفیف ویژه، بهترین‌ها را برای دوست کوچکتان انتخاب کنید', '/assets/img/hero/hero-2.jpg', '/#/shop?on_sale=1', 'hero', 2);
  banner('جشنواره غذای حیوانات', 'تا ۳۰٪ تخفیف روی غذای سگ و گربه', '/assets/img/banners/banner-1.jpg', '/#/category/dog-food', 'promo', 1);
  banner('جای خواب راحت', 'تا ۲۰٪ تخفیف روی جای خواب‌های مخملی', '/assets/img/banners/banner-2.jpg', '/#/category/bedding', 'promo', 2);

  // ---------- مقالات ----------
  const article = (title, slug, excerpt, content, image, category) =>
    db.prepare('INSERT INTO articles (title, slug, excerpt, content, image, category, status) VALUES (?,?,?,?,?,?,?)')
      .run(title, slug, excerpt, content, image, category, 'active');

  article('راهنمای کامل انتخاب غذای خشک برای سگ', 'dog-food-guide',
    'انتخاب غذای مناسب یکی از مهم‌ترین تصمیم‌ها برای سلامت سگ شماست؛ در این راهنما همه‌چیز را توضیح می‌دهیم.',
    '<p>غذای سگ باید بر اساس سن، نژاد، وزن و سطح فعالیت او انتخاب شود. توله‌سگ‌ها به پروتئین و کلسیم بیشتری نیاز دارند، در حالی که سگ‌های مسن به فیبر و ترکیبات محافظ مفاصل نیازمندند.</p><h3>چه چیزهایی را در لیبل غذا بررسی کنیم؟</h3><p>در صد پروتئین باید بالای ۲۵٪ باشد و اولین ماده لیبل، منبع پروتئین حیوانی (مرغ، گوشت یا ماهی) باشد. از غذاهایی با رنگ‌های مصنوعی و نگهدارنده‌های شیمیایی اجتناب کنید.</p><h3>غذای خشک یا مرطوب؟</h3><p>غذای خشک برای سلامت دندان‌ها بهتر است و ماندگاری بیشتری دارد؛ غذای مرطوب رطوبت بدن را تأمین می‌کند و برای سگ‌های کم‌اشتها عالی است. ترکیب هر دو می‌تواند بهترین انتخاب باشد.</p><p>همیشه آب تازه در دسترس سگ قرار دهید و غذای جدید را به‌تدریج طی یک هفته جایگزین غذای قبلی کنید.</p>',
    '/assets/img/categories/dog-food.jpg', 'تغذیه');

  article('۵ بازی فکری برای سرگرمی گربه‌ها', 'cat-mind-games',
    'گربه‌های باهوش به چالش نیاز دارند؛ این ۵ بازی فکری کسالت را از گربه شما دور می‌کند.',
    '<p>گربه‌ها موجودات باهوشی هستند و بدون تحریک ذهنی ممکن است رفتارهای مخرب از خود نشان دهند. بازی‌های فکری راهی عالی برای صرف انرژی ذهنی آن‌هاست.</p><h3>۱. توپ پازلی تشویقی</h3><p>تشویقی‌ها را داخل توپ بگذارید؛ گربه باید با ضربه‌زدن توپ، غذا را بیرون بیاورد.</p><h3>۲. کارتن جادویی</h3><p>یک جعبه مقوایی با چند سوراخ بسازید و توپ‌های کوچک داخل آن بیندازید؛ ساعتی سرگرمی تضمینی است.</p><h3>۳. چوب پر تعاملی</h3><p>با چوب پر، رفتار شکار گربه را تحریک کنید؛ بهتر است در پایان بازی، گربه «شکار» را بگیرد تا حس موفقیت کند.</p><h3>۴. بازی مخفی‌کردن تشویقی</h3><p>تشویقی‌ها را زیر لیوان‌های کوچک مخفی کنید و بگذارید گربه پیدایشان کند.</p><h3>۵. تونل بازی</h3><p>تونل‌های پارچه‌ای حس ماجراجویی گربه را برمی‌انگیزند و ورزش عالی‌ای هستند.</p>',
    '/assets/img/categories/toys.jpg', 'رفتارشناسی');

  article('نکات طلایی بهداشت و شست‌وشوی حیوانات خانگی', 'pet-hygiene-guide',
    'از انتخاب شامپو تا دفعات حمام؛ راهنمای کامل بهداشت سگ و گربه را بخوانید.',
    '<p>بهداشت منظم نه‌تنها ظاهر حیوان را زیبا می‌کند، بلکه از بیماری‌های پوستی و انگلی پیشگیری می‌کند.</p><h3>هر چند وقت یک‌بار حمام؟</h3><p>سگ‌ها به‌طور متوسط هر ۳ تا ۴ هفته یک‌بار و گربه‌ها (در صورت نیاز) هر ۶ تا ۸ هفته یک‌بار نیاز به حمام دارند. حمام بیش از حد، چربی محافظ پوست را از بین می‌برد.</p><h3>انتخاب شامپو</h3><p>هرگز از شامپوی انسانی استفاده نکنید؛ pH پوست حیوانات متفاوت است. شامپوهای مخصوص با فرمول ملایم انتخاب کنید.</p><h3>مراقبت از دندان و ناخن</h3><p>مسواک‌زدن هفتگی و کوتاه‌کردن ماهانه ناخن‌ها بخش مهمی از بهداشت است. برس کشیدن منظم مو نیز ریزش را کاهش می‌دهد.</p>',
    '/assets/img/categories/hygiene.jpg', 'بهداشت');

  article('سفر با حیوان خانگی؛ چک‌لیست ضروری', 'pet-travel-checklist',
    'قبل از سفر با سگ یا گربه، این چک‌لیست کامل را مرور کنید تا سفر آرامی داشته باشید.',
    '<p>سفر با حیوان خانگی نیازمند برنامه‌ریزی است. با این چک‌لیست، همه‌چیز را آماده کنید:</p><h3>مدارک و بهداشت</h3><p>شناسنامه و واکسیناسیون کامل، داروهای ضدانگل و یک پتو یا وسیله آشنا برای حس امنیت.</p><h3>وسایل ضروری</h3><p>کیف حمل یا کریر استاندارد، بطری آب سفر، غذای روزانه، ظرف غذا، تشویقی و کیسه جمع‌آوری فضولات.</p><h3>ایمنی در مسیر</h3><p>هرگز حیوان را بدون مهار در ماشین رها نکنید؛ از کمربند یا کریر استفاده کنید و هر ۲ ساعت توقف کنید.</p><h3>مقصد</h3><p>قبلاً مطمئن شوید مقصد، حیوان‌پذیر است و به محل استراحت حیوانات دسترسی دارید.</p>',
    '/assets/img/categories/travel.jpg', 'سبک زندگی');

  // ---------- سوالات متداول ----------
  const faq = (q, a, sort) =>
    db.prepare('INSERT INTO faqs (question, answer, sort_order, is_active) VALUES (?,?,?,1)').run(q, a, sort);
  faq('هزینه و زمان ارسال سفارش چقدر است؟', 'سفارش‌های تهران معمولاً همان روز و شهرستان‌ها بین ۱ تا ۳ روز کاری ارسال می‌شوند. هزینه ارسال ۷۵,۰۰۰ تومان است و برای سفارش‌های بالای ۲,۰۰۰,۰۰۰ تومان، ارسال رایگان است.', 1);
  faq('آیا امکان پرداخت در محل وجود دارد؟', 'بله؛ در گام پرداخت، روش «پرداخت در محل» را انتخاب کنید و مبلغ را هنگام تحویل به مأمور ارسال بپردازید.', 2);
  faq('چند روز فرصت بازگشت کالا دارم؟', 'تا ۷ روز پس از دریافت کالا، در صورت عدم استفاده و سالم بودن بسته‌بندی، امکان بازگشت وجه وجود دارد.', 3);
  faq('آیا محصولات شما ضمانت اصالت دارند؟', 'تمام محصولات پت‌شاپ به‌صورت مستقیم و با ضمانت اصالت کالا عرضه می‌شوند و قابل استعلام هستند.', 4);
  faq('آیا مشاوره تخصصی دامپزشک دارید؟', 'بله؛ تیم پشتیبانی ما شامل مشاوران باتجربه است و می‌توانید برای انتخاب غذا و مکمل مناسب، با ما تماس بگیرید.', 5);
  faq('چطور سفارشم را پیگیری کنم؟', 'پس از ورود به حساب کاربری، از بخش «سفارش‌های من» می‌توانید وضعیت سفارش را در لحظه ببینید.', 6);
  faq('آیا امکان خرید حضوری وجود دارد؟', 'بله؛ فروشگاه ما همه‌روزه به‌جز جمعه‌ها از ساعت ۹ تا ۲۱ میزبان شماست.', 7);
  faq('کد تخفیف را چطور استفاده کنم؟', 'در صفحه تسویه حساب، کد تخفیف را در فیلد مربوطه وارد کنید؛ تخفیف به‌صورت خودکار از مبلغ کل کم می‌شود.', 8);

  // ---------- نظرات مشتریان ----------
  const testimonial = (name, role, text, rating) =>
    db.prepare('INSERT INTO testimonials (name, role, text, rating, is_active) VALUES (?,?,?,?,1)').run(name, role, text, rating);
  testimonial('سارا محمدی', 'صاحب گربه پرشین', 'کیفیت غذای گربه‌م واقعاً عالی بود و خیلی سریع به دستم رسید. بسته‌بندی هم خیلی شیک و بهداشتی بود. از خریدم کاملاً راضی‌ام!', 5);
  testimonial('علی رضایی', 'صاحب ژرمن شپرد', 'توپ پازلی که خریدم معجزه کرد؛ سگم دیگر اسباب‌بازی‌های خانه را نمی‌جود! مشاوره‌شان هم خیلی کمکم کرد.', 5);
  testimonial('نگار کریمی', 'صاحب دو گربه', 'برای دومین بار خرید کردم و باز هم عالی بود. ارسال رایگان بالای ۲ میلیون خیلی بهصرفه است.', 4);
  testimonial('امیر حسینی', 'صاحب طوطی', 'اسباب‌بازی چوبی طوطی‌م را حسابی سرگرم کرده. جنسش هم واقعاً باکیفیت و مقاومه.', 5);
  testimonial('مینا احمدی', 'صاحب همستر', 'غذای همستر هم تنوع خوبی داره هم بوی تازگی می‌ده. همستر کوچولوم عاشقشه. مرسی از تیم پت‌شاپ 🌟', 5);

  // ---------- سفارش‌ها ----------
  const dayAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10 + (n % 8), 20, 0, 0); return d.toISOString(); };
  const order = (userId, customer, status, subtotal, discount, shipping, payment, items, daysAgo, note = '') => {
    const total = subtotal - discount + shipping;
    const code = 'PS-' + String(100000 + Math.floor(Math.random() * 899999));
    const oid = db.prepare(`
      INSERT INTO orders (code, user_id, customer_json, status, subtotal, discount, shipping, total, coupon_code, payment_method, payment_status, note, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(code, userId, JSON.stringify(customer), status, subtotal, discount, shipping, total,
      '', payment, payment === 'cod' ? 'unpaid' : 'paid', note, dayAgo(daysAgo)).lastInsertRowid;
    items.forEach(it => db.prepare('INSERT INTO order_items (order_id, product_id, name, image, price, quantity, total) VALUES (?,?,?,?,?,?,?)')
      .run(oid, it.pid, it.name, it.image, it.price, it.qty, it.price * it.qty));
    return oid;
  };

  const cust = (name, phone) => ({ full_name: name, phone, address: 'تهران، خیابان ولیعصر' });
  order(u1, cust('سارا محمدی', '09121111111'), 'delivered', 1050000 + 250000, 0, 75000, 'online', [
    { pid: 1, name: 'غذای خشک گربه بالغ با طعم مرغ', image: img('p28.jpg'), price: 1050000, qty: 1 },
    { pid: 4, name: 'تشویقی استخوانی سگ با طعم مرغ', image: img('p04.jpg'), price: 250000, qty: 1 },
  ], 2);
  order(u2, cust('علی رضایی', '09122222222'), 'delivered', 1650000, 0, 75000, 'online', [
    { pid: 4, name: 'غذای خشک سگ نژاد بزرگ با گوشت گوساله', image: img('p02.jpg'), price: 1650000, qty: 1 },
  ], 4);
  order(u3, cust('نگار کریمی', '09123333333'), 'delivered', 590000 + 280000, 87000, 0, 'online', [
    { pid: 10, name: 'توپ هوشمند تشویقی سگ (پازل)', image: img('p10.jpg'), price: 590000, qty: 1 },
    { pid: 5, name: 'تشویقی استخوانی سگ با طعم مرغ', image: img('p04.jpg'), price: 280000, qty: 1 },
  ], 7);
  order(u4, cust('امیر حسینی', '09124444444'), 'delivered', 620000 + 415000, 0, 75000, 'cod', [
    { pid: 20, name: 'روغن سالمون امگا ۳ سگ و گربه', image: img('p20.jpg'), price: 620000, qty: 1 },
    { pid: 22, name: 'خمیر مولتی‌ویتامین گربه', image: img('p22.webp'), price: 415000, qty: 1 },
  ], 9);
  order(u5, cust('مینا احمدی', '09125555555'), 'shipped', 150000 + 290000 + 950000, 0, 75000, 'online', [
    { pid: 24, name: 'غذای مخلوط همستر', image: img('p24.jpg'), price: 150000, qty: 1 },
    { pid: 25, name: 'غذای پولکی ماهیان گرمسیری', image: img('p25.jpg'), price: 290000, qty: 1 },
    { pid: 16, name: 'جای خواب گرد مخملی سگ و گربه کوچک', image: img('p16.jpg'), price: 950000, qty: 1 },
  ], 12);
  order(u6, cust('حسین قاسمی', '09126666666'), 'paid', 460000 + 320000, 0, 75000, 'online', [
    { pid: 11, name: 'توپ لاستیکی کندخوری سگ', image: img('p11.jpg'), price: 460000, qty: 1 },
    { pid: 19, name: 'بطری آب سفر سگ و گربه', image: img('p19.jpg'), price: 320000, qty: 1 },
  ], 15);
  order(u7, cust('لیلا مرادی', '09127777777'), 'pending', 740000, 74000, 75000, 'cod', [
    { pid: 3, name: 'غذای مرطوب گربه تن ماهی', image: img('p03.webp'), price: 740000, qty: 1 },
  ], 1);
  order(u1, cust('سارا محمدی', '09121111111'), 'cancelled', 380000, 0, 75000, 'cod', [
    { pid: 8, name: 'برس خودتمیزکننده موی سگ و گربه', image: img('p08.jpg'), price: 380000, qty: 1 },
  ], 6, 'انصراف مشتری');
  order(u2, cust('علی رضایی', '09122222222'), 'delivered', 499000 + 250000, 0, 0, 'online', [
    { pid: 13, name: 'قلاده چرمی سگ متوسط و بزرگ', image: img('p13.webp'), price: 499000, qty: 1 },
    { pid: 15, name: 'بند نایلونی با قلاب چرخان', image: img('p15.jpg'), price: 250000, qty: 1 },
  ], 18);
  order(u3, cust('نگار کریمی', '09123333333'), 'shipped', 420000 + 1050000, 0, 75000, 'online', [
    { pid: 26, name: 'اسباب‌بازی چوبی طوطی با زنگوله', image: img('p26.jpg'), price: 420000, qty: 1 },
    { pid: 1, name: 'غذای خشک گربه بالغ با طعم مرغ', image: img('p28.jpg'), price: 1050000, qty: 1 },
  ], 3);
  order(u4, cust('امیر حسینی', '09124444444'), 'paid', 280000, 0, 75000, 'online', [
    { pid: 27, name: 'گیاه مصنوعی آکواریوم (ست ۱۱ تایی)', image: img('p27.jpg'), price: 280000, qty: 1 },
  ], 0, 'تحویل عجله‌ای');

  // ---------- تنظیمات ----------
  setSetting('site', { name: 'پت‌شاپ', slogan: 'دنیای شادی برای پت شما' });
  setSetting('home_settings', {
    hero: { enabled: true },
    sections: {
      categories: { enabled: true, title: 'دسته‌بندی محصولات' },
      bestsellers: { enabled: true, title: 'پرفروش‌ترین‌ها' },
      new: { enabled: true, title: 'جدیدترین محصولات' },
      sales: { enabled: true, title: 'تخفیف‌های ویژه' },
      special: { enabled: true, title: 'پیشنهاد پت‌شاپ' },
      brands: { enabled: true, title: 'برندهای معتبر' },
      about: { enabled: true },
      features: { enabled: true },
      blog: { enabled: true, title: 'مجله پت' },
      testimonials: { enabled: true, title: 'نظر مشتریان' },
      newsletter: { enabled: true },
    },
  });
  setSetting('features', [
    { icon: '🚚', title: 'ارسال سریع', text: 'ارسال به سراسر کشور در ۱ تا ۳ روز کاری' },
    { icon: '🛡️', title: 'ضمانت اصالت', text: 'تمامی کالاها اصل و با ضمانت هستند' },
    { icon: '💳', title: 'پرداخت امن', text: 'پرداخت آنلاین و در محل با امنیت کامل' },
    { icon: '↩️', title: '۷ روز ضمانت بازگشت', text: 'در صورت نارضایتی، وجه بازگردانده می‌شود' },
    { icon: '🐾', title: 'مشاوره دامپزشک', text: 'تیم تخصصی برای انتخاب بهترین محصول' },
    { icon: '🎁', title: 'پیشنهادهای ویژه', text: 'تخفیف‌های شگفت‌انگیز هر هفته' },
  ]);
  setSetting('about_teaser', {
    badge: 'پت‌شاپ از سال ۱۳۹۲',
    title: 'چرا خانواده‌ها به پت‌شاپ اعتماد می‌کنند؟',
    text: 'پت‌شاپ از سال ۱۳۹۲ با هدف تامین بهترین محصولات برای حیوانات خانگی شروع به کار کرد. ما با تیم مشاوران متخصص، تنها محصولاتی را عرضه می‌کنیم که خودمان به کیفیت آن‌ها ایمان داریم؛ از غذای سالم و مکمل‌های استاندارد تا اسباب‌بازی‌های ایمن و لوازم راحتی.',
    image: '/assets/img/about/about-1.jpg',
    stats: [
      { value: '۱۲+', label: 'سال تجربه' },
      { value: '۱۵هزار+', label: 'مشتری راضی' },
      { value: '۲هزار+', label: 'محصول متنوع' },
      { value: '۹۸٪', label: 'رضایت مشتری' },
    ],
  });
  setSetting('contact', {
    phone: '۰۲۱-۲۲۳۳۴۴۵۵',
    mobile: '۰۹۱۲۳۴۵۶۷۸۹',
    email: 'info@petshop.ir',
    address: 'تهران، خیابان ولیعصر، بالاتر از پارک‌وی، پلاک ۱۲۳',
    work_hours: 'شنبه تا پنجشنبه، ۹ صبح تا ۹ شب',
  });
  setSetting('socials', {
    instagram: 'petshop.ir',
    telegram: 'petshop_ir',
    whatsapp: '09123456789',
    twitter: '',
    youtube: '',
  });
  setSetting('footer', {
    description: 'پت‌شاپ؛ مرجع تخصصی محصولات حیوانات خانگی. با ۱۲ سال تجربه، بهترین‌ها را برای دوست‌داشتنی‌های شما فراهم می‌کنیم.',
    badges: [
      { title: 'نماد اعتماد الکترونیکی', icon: '🛡️' },
      { title: 'پرداخت امن بانکی', icon: '💳' },
      { title: 'ضمانت اصالت کالا', icon: '✅' },
    ],
  });
  setSetting('shipping', { cost: 75000, free_over: 2000000, message: 'ارسال رایگان برای سفارش‌های بالای ۲ میلیون تومان' });
  setSetting('about_page', {
    title: 'درباره پت‌شاپ',
    image: '/assets/img/about/about-1.jpg',
    content: `<p><strong>پت‌شاپ</strong> از سال ۱۳۹۲ فعالیت خود را با یک هدف ساده آغاز کرد: فراهم کردن بهترین و سالم‌ترین محصولات برای حیوانات خانگی.</p>
      <p>امروز تیم ما شامل مشاوران تغذیه، کارشناسان بهداشت و علاقه‌مندان واقعی به حیوانات است که پیش از عرضه هر محصول، آن را از نظر کیفیت، ایمنی و استاندارد بررسی می‌کنند.</p>
      <h3>چرا پت‌شاپ؟</h3>
      <ul><li>تضمین اصالت تمام محصولات</li><li>مشاوره تخصصی رایگان پیش از خرید</li><li>ارسال سریع به سراسر کشور</li><li>۷ روز ضمانت بازگشت کالا</li></ul>
      <p>ما باور داریم حیوانات خانگی اعضای خانواده هستند و سزاوار بهترین‌ها؛ این باور، راهنمای همه تصمیم‌های ماست.</p>`,
  });
  setSetting('rules_page', {
    title: 'قوانین و مقررات',
    content: `<h3>ثبت سفارش</h3><p>با ثبت سفارش، صحت اطلاعات واردشده را تأیید می‌کنید. پس از ثبت سفارش، پیامک تأیید برای شما ارسال می‌شود.</p>
      <h3>ارسال و تحویل</h3><p>سفارش‌های تهران معمولاً در همان روز و سایر شهرها بین ۱ تا ۳ روز کاری تحویل داده می‌شوند. هزینه ارسال ۷۵,۰۰۰ تومان و برای سفارش‌های بالای ۲ میلیون تومان رایگان است.</p>
      <h3>بازگشت کالا</h3><p>تا ۷ روز پس از تحویل، در صورت سالم بودن بسته‌بندی و عدم استفاده، امکان بازگشت کالا و استرداد وجه وجود دارد.</p>
      <h3>حریم خصوصی</h3><p>اطلاعات شما نزد ما محفوظ است و به هیچ شخص ثالثی منتقل نمی‌شود.</p>`,
  });

  console.log('✔ دیتابیس با داده‌های اولیه ساخته شد.');
  return true;
}

module.exports = { seed };
