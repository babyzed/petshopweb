// jalali.js — ابزار تبدیل تاریخ شمسی (جلالی) و میلادی
// بر اساس الگوریتم استاندارد jalaali (بدون وابستگی خارجی)
// منطقه زمانی پیش‌فرض: Asia/Tehran (UTC+3:30 — ایران از ۱۴۰۱ بدون ساعت تابستانی)

import { faNum } from './api.js';

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

function jalCal(jy) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm, jump, n;

  for (let i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5)
    + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm, jd;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/** میلادی → شمسی */
export function gregorianToJalali(gy, gm, gd) {
  return d2j(g2d(gy, gm, gd));
}

/** شمسی → میلادی */
export function jalaliToGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

/** آیا سال شمسی کبیسه است؟ */
export function isLeapJalali(jy) {
  return jalCal(jy).leap === 0;
}

/** تعداد روزهای ماه شمسی */
export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
}

/** تاریخ میلادیِ لحظهٔ کنونی در منطقهٔ زمانی تهران */
function tehranGregorianParts(date) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** امروز به شمسی (تهران) */
export function todayShamsi() {
  const p = tehranGregorianParts(new Date());
  return gregorianToJalali(p.year, p.month, p.day);
}

/** تبدیل ISO (ذخیره‌شده) → { jy, jm, jd } بر اساس تهران */
export function shamsiFromISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const p = tehranGregorianParts(d);
  return gregorianToJalali(p.year, p.month, p.day);
}

/** تبدیل شمسی → ISO میلادی: پایان همان روز به وقت تهران (23:59:59+03:30) */
export function shamsiToISO(jy, jm, jd) {
  const g = jalaliToGregorian(jy, jm, jd);
  const pad = (n) => String(n).padStart(2, '0');
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}T23:59:59+03:30`;
}

/** قالب‌بندی شمسی: ۱۴۰۴/۰۶/۱۰ */
export function formatShamsi(jy, jm, jd) {
  return `${faNum(jy)}/${faNum(jm).padStart(2, '۰')}/${faNum(jd).padStart(2, '۰')}`;
}

/** نمایش تاریخ شمسی از یک ISO ذخیره‌شده */
export function formatShamsiFromISO(iso) {
  const s = shamsiFromISO(iso);
  return s ? formatShamsi(s.jy, s.jm, s.jd) : '';
}
