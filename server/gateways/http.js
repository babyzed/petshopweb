// server/gateways/http.js — کمک‌کنندهٔ درخواست HTTP برای درگاه‌های پرداخت
const https = require('https');
const http = require('http');

const DEFAULT_TIMEOUT = 25000;

// درخواست عمومی: بدنهٔ JSON یا x-www-form-urlencoded
function request(url, { method = 'POST', json, form, headers = {}, timeout = DEFAULT_TIMEOUT, insecure = false } = {}) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try { urlObj = new URL(url); } catch (err) { return reject(new Error('آدرس درگاه نامعتبر است.')); }

    const isHttps = urlObj.protocol === 'https:';
    let body = null;
    const finalHeaders = { Accept: 'application/json', ...headers };

    if (json !== undefined) {
      body = JSON.stringify(json);
      finalHeaders['Content-Type'] = 'application/json';
    } else if (form !== undefined) {
      const p = new URLSearchParams();
      Object.entries(form).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.append(k, String(v)); });
      body = p.toString();
      finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    if (body !== null) finalHeaders['Content-Length'] = Buffer.byteLength(body);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: finalHeaders,
      timeout,
    };
    if (isHttps && insecure) options.rejectUnauthorized = false;

    const client = isHttps ? https : http;
    const req = client.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, data, raw });
      });
    });

    req.on('timeout', () => { req.destroy(new Error('زمان پاسخ درگاه پرداخت به پایان رسید.')); });
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

module.exports = { request };
