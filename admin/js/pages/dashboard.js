// admin/pages/dashboard.js — داشبورد آماری با نمودار SVG
import { AdminAPI, price, faNum, faDate } from '../api.js';
import { statCard, statusBadge } from '../components.js';
import { ic } from '../icons.js';

const STATUS_COLORS = { pending: '#F59E0B', paid: '#3B82F6', shipped: '#6366F1', delivered: '#10B981', cancelled: '#EF4444' };

export async function render() {
  const d = await AdminAPI.get('/admin/dashboard');

  // نمودار خطی فروش ۳۰ روز
  const chart = d.chart || [];
  const maxRev = Math.max(...chart.map(c => c.revenue), 1);
  const w = 720, h = 220, pad = 10;
  const step = chart.length > 1 ? (w - pad * 2) / (chart.length - 1) : 0;
  const pts = chart.map((c, i) => [pad + i * step, h - pad - (c.revenue / maxRev) * (h - pad * 2)]);
  const line = pts.map(p => p.join(',')).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const gridLines = [0.25, 0.5, 0.75].map(f => {
    const y = h - pad - f * (h - pad * 2);
    return `<line x1="${pad}" y1="${y}" x2="${w - pad}" y2="${y}" stroke="#F1EDE7" stroke-width="1"/>`;
  }).join('');

  // دایره وضعیت سفارش‌ها
  const statusDist = d.statusDist || [];
  const totalStatus = statusDist.reduce((s, x) => s + x.c, 0) || 1;
  const donutColors = statusDist.map(s => STATUS_COLORS[s.status] || '#999');
  const R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  const donutSegs = statusDist.map((s, i) => {
    const frac = s.c / totalStatus;
    const dash = frac * C;
    const seg = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${donutColors[i]}" stroke-width="16" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-acc * C}" transform="rotate(-90 60 60)"/>`;
    acc += frac;
    return seg;
  }).join('');

  return `
  <div class="stat-grid">
    ${statCard(ic('dollarSign', 22), 'o', price(d.revenue) + ' <small style="font-size:11px">تومان</small>', 'مجموع درآمد (بدون لغو)')}
    ${statCard(ic('receipt', 22), 'b', faNum(d.orderCount), 'تعداد سفارش‌ها')}
    ${statCard(ic('users', 22), 'g', faNum(d.userCount), 'کاربران (جدید: ' + faNum(d.newUsers) + ')')}
    ${statCard(ic('trendUp', 22), 'p', price(d.todayRevenue) + ' <small style="font-size:11px">تومان</small>', 'درآمد امروز (' + faNum(d.todayOrders) + ' سفارش)')}
  </div>

  <div class="dash-grid">
    <div>
      <div class="dash-card">
        <h3>${ic('chartBar', 18)} فروش ۳۰ روز اخیر</h3>
        <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto" role="img" aria-label="نمودار فروش ۳۰ روز">
          ${gridLines}
          <polygon points="${area}" fill="rgba(249,115,22,.08)"/>
          <polyline points="${line}" fill="none" stroke="#F97316" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${pts.map((p, i) => (i % 5 === 0 || i === pts.length - 1) ? `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="#F97316" stroke-width="2"><title>${faDate(chart[i].day)} — ${price(chart[i].revenue)} تومان</title></circle>` : '').join('')}
        </svg>
        <div class="chart-labels">
          ${chart.filter((_, i) => i % 5 === 0 || i === chart.length - 1).map(c => `<span>${c.day.slice(5)}</span>`).join('')}
        </div>
      </div>

      <div class="dash-card">
        <h3>${ic('flame', 18)} پرفروش‌ترین محصولات</h3>
        ${d.bestsellers.length ? d.bestsellers.map(b => `
          <div class="mini-list-item">
            ${b.image ? `<img src="${b.image}" alt="">` : `<span style="font-size:18px;color:var(--brand)">${ic('package', 22)}</span>`}
            <span class="mli-name">${b.name}</span>
            <span style="color:var(--muted);font-size:11px">${faNum(b.sold)} فروش</span>
            <span class="mli-val">${price(b.total)}</span>
          </div>`).join('') : '<p style="color:var(--muted);font-size:12.5px">هنوز فروشی ثبت نشده.</p>'}
      </div>

      <div class="dash-card">
        <h3>${ic('clock', 18)} سفارش‌های اخیر</h3>
        <table class="data-table">
          <thead><tr><th>کد</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
          <tbody>
            ${d.recent.slice(0, 6).map(o => {
              const c = JSON.parse(o.customer_json || '{}');
              return `<tr style="cursor:pointer" data-href="#/orders/${o.id}"">
                <td><b style="color:var(--brand-dark)">${o.code}</b></td>
                <td class="t-name">${c.full_name || '—'}</td>
                <td>${price(o.total)} تومان</td>
                <td>${statusBadge(o.status)}</td>
                <td style="font-size:11px">${faDate(o.created_at)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div>
      <div class="dash-card">
        <h3>${ic('grid', 18)} وضعیت سفارش‌ها</h3>
        <div class="donut-row">
          <svg viewBox="0 0 120 120" style="width:130px;height:130px" role="img" aria-label="نمودار وضعیت سفارش‌ها">
            ${donutSegs}
            <text x="60" y="58" text-anchor="middle" font-size="17" font-weight="800" fill="#292524">${faNum(d.orderCount)}</text>
            <text x="60" y="74" text-anchor="middle" font-size="9" fill="#8A817C">سفارش</text>
          </svg>
          <div class="donut-legend">
            ${statusDist.map(s => `
              <div class="dl-item">
                <span class="dl-dot" style="background:${STATUS_COLORS[s.status]}"></span>
                <span>${statusBadge(s.status).replace(/<[^>]*>/g, '')}</span>
                <span class="dl-n">${faNum(s.c)}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="dash-card">
        <h3>${ic('shoppingBag', 18)} فروش به تفکیک دسته</h3>
        ${d.catSales?.length ? d.catSales.map(c => {
          const max = Math.max(...d.catSales.map(x => x.total), 1);
          return `
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:5px">
              <span>${c.name || 'بدون دسته'}</span><span>${price(c.total)}</span>
            </div>
            <div style="height:9px;background:#F1EDE7;border-radius:6px;overflow:hidden">
              <div style="height:100%;width:${Math.round(c.total / max * 100)}%;background:linear-gradient(90deg,#10B981,#059669);border-radius:6px"></div>
            </div>
          </div>`;
        }).join('') : '<p style="color:var(--muted);font-size:12.5px">داده‌ای نیست.</p>'}
      </div>

      <div class="dash-card">
        <h3>${ic('alertTriangle', 18)} محصولات کم‌موجودی</h3>
        ${d.lowStock.length ? d.lowStock.map(p => `
          <div class="mini-list-item">
            ${p.image ? `<img src="${p.image}" alt="">` : `<span style="font-size:18px;color:var(--brand)">${ic('package', 22)}</span>`}
            <span class="mli-name">${p.name}</span>
            <span class="s-badge ${p.stock === 0 ? 's-cancelled' : 's-pending'}" style="flex-shrink:0">${faNum(p.stock)} عدد</span>
          </div>`).join('') : '<p style="color:var(--muted);font-size:12.5px">همه محصولات موجودی کافی دارند ✅</p>'}
      </div>
    </div>
  </div>`;
}
