// server/email.js — سرویس ایمیل اطلاع‌رسانی سفارشات
// از nodemailer برای ارسال ایمیل استفاده می‌کند
// اگر SMTP تنظیم نشده باشد، فقط لاگ می‌زند

const nodemailer = require('nodemailer');

let transporter = null;

// ---------- راه‌اندازی transporter ----------
function initTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('[Email] SMTP تنظیم نشده — ایمیل‌ها فقط در لاگ نمایش داده می‌شوند');
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT || 587,
      secure: SMTP_PORT === '465',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    console.log(`[Email] SMTP متصل: ${SMTP_HOST}:${SMTP_PORT || 587}`);
    return transporter;
  } catch (err) {
    console.error('[Email] خطا در راه‌اندازی SMTP:', err.message);
    return null;
  }
}

// ---------- ارسال ایمیل ----------
async function sendEmail(to, subject, html) {
  const from = process.env.SMTP_FROM || 'noreply@petshop.ir';

  // اگر SMTP تنظیم نشده، فقط لاگ بزن
  if (!transporter) {
    console.log(`[Email] (نمایشی) به: ${to} | موضوع: ${subject}`);
    console.log(`[Email] محتوا: ${html.substring(0, 200)}...`);
    return { ok: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"پت‌شاپ" <${from}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] ارسال شد: ${info.messageId}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] خطا در ارسال به ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

// ---------- قالب ایمیل ثبت سفارش ----------
function orderConfirmationEmail(order, customer) {
  const items = order.items || [];
  const itemsHtml = items.map(it => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #eee">${it.name}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
      <td style="padding:12px;border-bottom:1px solid #eee;text-align:left">${it.price.toLocaleString('fa-IR')} تومان</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head><meta charset="UTF-8"></head>
<body style="font-family:Tahoma,Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <!-- هدر -->
    <div style="background:linear-gradient(135deg,#F97316,#FBBF24);padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">🐾 پت‌شاپ</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px">تایید ثبت سفارش</p>
    </div>

    <div style="padding:24px">
      <h2 style="color:#333;margin-top:0">سلام ${customer.full_name || ''} 👋</h2>
      <p style="color:#666;line-height:1.8">سفارش شما با موفقیت ثبت شد. جزئیات زیر را بررسی کنید:</p>

      <!-- کد سفارش -->
      <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:16px;margin:16px 0;text-align:center">
        <p style="margin:0;color:#9A3412;font-size:13px">کد سفارش</p>
        <p style="margin:4px 0 0;color:#C2410C;font-size:24px;font-weight:bold" dir="ltr">${order.code}</p>
      </div>

      <!-- اقلام -->
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#FAF7F4">
            <th style="padding:12px;text-align:right;font-size:13px">محصول</th>
            <th style="padding:12px;text-align:center;font-size:13px">تعداد</th>
            <th style="padding:12px;text-align:left;font-size:13px">قیمت</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <!-- جمع -->
      <div style="background:#FAF7F4;border-radius:12px;padding:16px;margin:16px 0">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
          <span>جمع کالاها:</span><span>${order.subtotal.toLocaleString('fa-IR')} تومان</span>
        </div>
        ${order.discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:#16a34a">
          <span>تخفیف:</span><span>− ${order.discount.toLocaleString('fa-IR')} تومان</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
          <span>ارسال:</span><span>${order.shipping > 0 ? order.shipping.toLocaleString('fa-IR') + ' تومان' : 'رایگان'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;border-top:2px solid #E7E0D8;padding-top:12px;margin-top:8px">
          <span>مبلغ نهایی:</span><span style="color:#C2410C">${order.total.toLocaleString('fa-IR')} تومان</span>
        </div>
      </div>

      <!-- آدرس -->
      ${customer.address ? `
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:16px 0">
        <p style="margin:0 0 4px;font-size:13px;color:#166534">📍 آدرس تحویل:</p>
        <p style="margin:0;font-size:14px;color:#333">${customer.address}</p>
      </div>` : ''}

      <!-- پیام -->
      <p style="color:#666;font-size:13px;line-height:1.8;margin-top:20px">
        برای پیگیری سفارش، وارد حساب کاربری خود شوید و بخش «سفارش‌های من» را بررسی کنید.
      </p>

      <!-- دکمه -->
      <div style="text-align:center;margin:24px 0">
        <a href="${process.env.SAMAN_CALLBACK_URL || 'http://localhost:3001'}/#/orders"
           style="display:inline-block;background:#F97316;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold">
          مشاهده سفارش‌ها
        </a>
      </div>
    </div>

    <!-- فوتر -->
    <div style="background:#1C1917;padding:20px;text-align:center">
      <p style="color:#A8A29E;font-size:12px;margin:0">پت‌شاپ — مرجع تخصصی محصولات حیوانات خانگی</p>
      <p style="color:#78716C;font-size:11px;margin:8px 0 0">support@petshop.ir | ۰۲۱-۲۲۳۳۴۴۵۵</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------- قالب ایمیل ارسال سفارش ----------
function orderShippedEmail(order, customer) {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head><meta charset="UTF-8"></head>
<body style="font-family:Tahoma,Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#10B981,#059669);padding:24px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">🚚 سفارش شما ارسال شد!</h1>
    </div>
    <div style="padding:24px;text-align:center">
      <p style="color:#333;font-size:16px">سلام ${customer.full_name || ''}</p>
      <p style="color:#666;line-height:1.8">سفارش <strong>${order.code}</strong> ارسال شد و به زودی به دست شما می‌رسد.</p>
      <div style="background:#F0FDF4;border-radius:12px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#166534;font-size:14px">کد پیگیری: <strong>${order.code}</strong></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ---------- ارسال ایمیل ثبت سفارش ----------
async function sendOrderConfirmation(order) {
  const customer = typeof order.customer_json === 'string'
    ? JSON.parse(order.customer_json)
    : order.customer_json;

  if (!customer.email) {
    console.log(`[Email] ایمیل مشتری موجود نیست — ایمیل ارسال نشد (${order.code})`);
    return { ok: false, reason: 'no_email' };
  }

  const html = orderConfirmationEmail(order, customer);
  return sendEmail(customer.email, `تایید سفارش ${order.code} | پت‌شاپ`, html);
}

// ---------- ارسال ایمیل ارسال سفارش ----------
async function sendOrderShipped(order) {
  const customer = typeof order.customer_json === 'string'
    ? JSON.parse(order.customer_json)
    : order.customer_json;

  if (!customer.email) return { ok: false, reason: 'no_email' };

  const html = orderShippedEmail(order, customer);
  return sendEmail(customer.email, `ارسال سفارش ${order.code} | پت‌شاپ`, html);
}

module.exports = {
  initTransporter,
  sendEmail,
  sendOrderConfirmation,
  sendOrderShipped,
};
