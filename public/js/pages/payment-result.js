// pages/payment-result.js — نتیجه پرداخت آنلاین (بعد از ریدایرکت بانک)
import { API, price } from '../api.js';
import { ic } from '../icons.js';

export function title() { return 'نتیجه پرداخت | پت‌شاپ'; }

export async function render(params, queryStr) {
  const q = new URLSearchParams(queryStr);
  const status = q.get('status') || 'error';
  const orderCode = q.get('order') || '';
  const RRN = q.get('RRN') || '';
  const message = q.get('message') || '';

  let icon, heading, desc, btns;

  if (status === 'success') {
    icon = ic('check', 52);
    heading = 'پرداخت با موفقیت انجام شد!';
    desc = RRN
      ? `<p style="color:var(--muted);font-size:13.5px;margin-top:8px">کد پیگیری بانکی: <b style="direction:ltr;display:inline-block">${RRN}</b></p>`
      : '';
    btns = `
      <a class="btn btn-primary" href="#/account?tab=orders">مشاهده سفارش‌ها</a>
      <a class="btn btn-outline" href="#/shop">ادامه خرید</a>`;
  } else if (status === 'failed') {
    icon = ic('alert', 52);
    heading = 'پرداخت ناموفق بود';
    desc = `<p style="color:var(--muted);font-size:13.5px;margin-top:8px">${message || 'پرداخت انجام نشد. لطفاً دوباره تلاش کنید.'}</p>`;
    btns = orderCode
      ? `<a class="btn btn-primary" href="#/account?tab=orders">پرداخت مجدد</a>
         <a class="btn btn-outline" href="#/shop">بازگشت به فروشگاه</a>`
      : `<a class="btn btn-primary" href="#/shop">بازگشت به فروشگاه</a>`;
  } else {
    icon = ic('alert', 52);
    heading = 'خطا در پرداخت';
    desc = `<p style="color:var(--muted);font-size:13.5px;margin-top:8px">${message || 'خطای غیرمنتظره‌ای رخ داد.'}</p>`;
    btns = `
      <a class="btn btn-primary" href="#/account?tab=orders">مشاهده سفارش‌ها</a>
      <a class="btn btn-outline" href="#/shop">بازگشت به فروشگاه</a>`;
  }

  return `
  <div class="container">
    <div class="success-box" style="margin:60px auto;max-width:520px;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:48px 32px;text-align:center">
      <div class="success-ic" style="margin-bottom:16px;${status === 'success' ? 'color:var(--green,#16a34a)' : 'color:var(--err,#ef4444)'}">${icon}</div>
      <h2 style="font-size:21px;font-weight:800">${heading}</h2>
      ${desc}
      ${orderCode ? `<div class="success-code" style="margin-top:16px">کد سفارش: ${orderCode}</div>` : ''}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px">
        ${btns}
      </div>
    </div>
  </div>`;
}
