// pages/blog.js — مجله پت: لیست و جزئیات مقاله
import { API, dateFa } from '../api.js';

export function title(params) {
  return params.slug ? 'مقاله | پت‌شاپ' : 'مجله پت';
}

export async function render(params) {
  if (params.slug) {
    const { article, related } = await API.get('/articles/' + params.slug);
    return `
    <div class="container">
      <nav class="breadcrumb">
        <a href="#/">خانه</a><span class="sep">/</span><a href="#/blog">مجله پت</a><span class="sep">/</span><span>${article.title}</span>
      </nav>
      <article class="article-single">
        <span class="as-cat">${article.category || 'پت‌شاپ'}</span>
        <h1>${article.title}</h1>
        <div class="as-meta">
          <span>🗓 ${dateFa(article.created_at)}</span>
          <span>⏱ ${faRead(article.content)} دقیقه مطالعه</span>
        </div>
        ${article.image ? `<div class="as-img"><img src="${article.image}" alt="${article.title}"></div>` : ''}
        <div class="as-content">${article.content || ''}</div>
      </article>
      ${related.length ? `
      <section class="section">
        <div class="section-head"><h2 class="section-title"><span class="emoji">📚</span>مقالات مرتبط</h2></div>
        <div class="blog-grid">
          ${related.map(a => `
            <a class="article-card" href="#/blog/${a.slug}">
              <div class="a-media">${a.image ? `<img src="${a.image}" alt="" loading="lazy">` : ''}<span class="a-cat">پت‌شاپ</span></div>
              <div class="a-body"><h3 class="a-title">${a.title}</h3></div>
            </a>`).join('')}
        </div>
      </section>` : ''}
    </div>`;
  }

  const { articles } = await API.get('/articles');
  return `
  <div class="container">
    <nav class="breadcrumb"><a href="#/">خانه</a><span class="sep">/</span><span>مجله پت</span></nav>
    <div class="page-hero">
      <div>
        <h1>📰 مجله پت</h1>
        <p>مقالات تخصصی برای سلامت، شادی و تربیت حیوانات خانگی</p>
      </div>
      <div class="ph-ic">🦜</div>
    </div>
    <div class="blog-grid" style="margin-top:24px">
      ${articles.map(a => `
        <a class="article-card" href="#/blog/${a.slug}">
          <div class="a-media">
            ${a.image ? `<img src="${a.image}" alt="${a.title}" loading="lazy">` : ''}
            <span class="a-cat">${a.category || 'پت‌شاپ'}</span>
          </div>
          <div class="a-body">
            <h3 class="a-title">${a.title}</h3>
            <p class="a-excerpt">${a.excerpt || ''}</p>
            <div class="a-meta"><span>🗓 ${dateFa(a.created_at)}</span><span>⏱ ${faRead(a.content)} دقیقه</span></div>
          </div>
        </a>`).join('')}
    </div>
  </div>`;
}

function faRead(html) {
  const words = (html || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
