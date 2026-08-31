// server/torob.js — فید محصولات ترب (Torob Marketplace)
// مستندات: https://docs.torob.com
//
// فید XML برای ترب ایجاد می‌کند که محصولات را به‌صورت خودکار آپدیت می‌کند.
// آدرس فید: /api/torob/feed.xml

const { db } = require('./db');

// ---------- ساخت فید XML ----------
function generateTorobFeed(baseUrl, torob = {}) {
  const title = torob.title || 'پت‌شاپ — فروشگاه محصولات حیوانات خانگی';
  const description = torob.description || 'مرجع تخصصی محصولات حیوانات خانگی با ۱۲ سال تجربه';
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name, b.name AS brand_name,
      COALESCE((SELECT image FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1),'') AS image
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.status = 'active' AND p.stock > 0
    ORDER BY p.id DESC
  `).all();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.torob.com/">
  <title>${escapeXml(title)}</title>
  <link>${baseUrl}</link>
  <description>${escapeXml(description)}</description>
  <language>fa</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

  for (const p of products) {
    const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
    const features = (() => { try { return JSON.parse(p.features); } catch { return {}; } })();
    const featureList = Object.entries(features).map(([k, v]) => `<feature name="${escapeXml(k)}" value="${escapeXml(v)}"/>`).join('\n      ');

    xml += `
  <item>
    <id>${p.id}</id>
    <title>${escapeXml(p.name)}</title>
    <link>${baseUrl}/#/product/${p.slug}</link>
    <image>${baseUrl}${p.image || ''}</image>
    <description>${escapeXml(p.description || '')}</description>
    <price>${price}</price>
    <old_price>${p.price}</old_price>
    <currency>IRR</currency>
    <in_stock>${p.stock > 0 ? 'true' : 'false'}</in_stock>
    <stock_quantity>${p.stock}</stock_quantity>
    <category>${escapeXml(p.category_name || '')}</category>
    <brand>${escapeXml(p.brand_name || '')}</brand>
    <sku>${escapeXml(p.sku || '')}</sku>
    <weight>${escapeXml(p.weight || '')}</weight>
    ${featureList ? `<features>\n      ${featureList}\n    </features>` : ''}
    <created_at>${p.created_at || new Date().toISOString()}</created_at>
    <manufacturer>${escapeXml(p.brand_name || '')}</manufacturer>
    <warranty>${escapeXml('ضمانت اصالت کالا')}</warranty>
    <seller>${escapeXml('پت‌شاپ')}</seller>
  </item>`;
  }

  xml += '\n</feed>';
  return xml;
}

// ---------- JSON Feed (نسخه ۲) ----------
function generateTorobJsonFeed(baseUrl, torob = {}) {
  const title = torob.title || 'پت‌شاپ';
  const description = torob.description || 'مرجع تخصصی محصولات حیوانات خانگی';
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name, b.name AS brand_name,
      COALESCE((SELECT image FROM product_images WHERE product_id = p.id ORDER BY sort_order ASC, id ASC LIMIT 1),'') AS image
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE p.status = 'active' AND p.stock > 0
    ORDER BY p.id DESC
  `).all();

  return {
    title,
    link: baseUrl,
    description,
    language: 'fa',
    lastBuildDate: new Date().toISOString(),
    items: products.map(p => {
      const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
      const features = (() => { try { return JSON.parse(p.features); } catch { return {}; } })();
      return {
        id: p.id,
        title: p.name,
        link: `${baseUrl}/#/product/${p.slug}`,
        image: `${baseUrl}${p.image || ''}`,
        description: p.description || '',
        price,
        old_price: p.price,
        currency: 'IRR',
        in_stock: p.stock > 0,
        stock_quantity: p.stock,
        category: p.category_name || '',
        brand: p.brand_name || '',
        sku: p.sku || '',
        weight: p.weight || '',
        features,
        created_at: p.created_at,
        manufacturer: p.brand_name || '',
        warranty: 'ضمانت اصالت کالا',
        seller: 'پت‌شاپ',
      };
    }),
  };
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { generateTorobFeed, generateTorobJsonFeed };
