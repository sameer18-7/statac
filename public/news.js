/* ═══════════════════════════════════════════════════
   STATAC News — Script
   Fetches live cricket news from Cricbuzz RSS via
   a public CORS proxy, with fallback to cached data.
   ═══════════════════════════════════════════════════ */

console.log('📰 STATAC News Engine Initialized');

const CRICBUZZ_RSS = 'https://www.cricbuzz.com/cb-rss/cb-top-stories';

// Multiple CORS proxies as fallbacks
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest='
];

const CRICKET_ICONS = ['🏏', '🏆', '⚡', '🔥', '🎯', '📊', '🌟', '💥', '🥇', '🎾'];

const FALLBACK_ARTICLES = [
  { title: 'India Clinch Series Against Australia in Thrilling Final', desc: 'A stunning performance from the Indian middle order sealed a historic series victory in the final match at the MCG.', category: 'Match Report', date: 'Today', link: '#' },
  { title: 'IPL 2025 Season Preview: Teams & Squads', desc: 'The biggest T20 league returns with exciting new signings and franchise strategies.', category: 'IPL', date: 'Today', link: '#' },
  { title: 'Breaking: Major ICC Rule Changes Approved', desc: 'New playing conditions including impact player rules and DRS changes set to take effect next month.', category: 'Breaking', date: 'Today', link: '#' },
  { title: 'Virat Kohli Crosses 80th International Century', desc: 'The run machine continues his incredible streak with another magnificent knock.', category: 'Records', date: 'Today', link: '#' },
  { title: 'World Test Championship Final Venue Announced', desc: 'Lords confirmed as the venue for the next WTC Final between the top two teams.', category: 'WTC', date: 'Today', link: '#' },
  { title: 'Young Talent: Top 10 U-19 Players to Watch', desc: 'From explosive batting to crafty bowling, these youngsters are set to light up the international stage.', category: 'Analysis', date: 'Today', link: '#' },
  { title: 'T20 World Cup Qualifying: Key Matches This Week', desc: 'Several nations battle for a spot in the marquee tournament with crucial qualifying matches ahead.', category: 'T20 WC', date: 'Today', link: '#' },
  { title: 'Stokes Returns From Injury, Named in England Squad', desc: 'The all-rounder is back and ready to lead England in the upcoming Ashes warm-ups.', category: 'England', date: 'Today', link: '#' },
  { title: 'Australia Announce Squad for Pakistan Tour', desc: 'Pat Cummins leads a strong squad for the challenging subcontinent assignment.', category: 'Australia', date: 'Today', link: '#' },
];

document.addEventListener('DOMContentLoaded', function () {

  /* ─── NAVBAR SCROLL ────────────────────────── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 70);
  }, { passive: true });

  /* ─── FILTER BUTTONS ───────────────────────── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.filter-btn.active').classList.remove('active');
      btn.classList.add('active');
      // Filter logic could be added here for categories
    });
  });

  /* ─── FETCH NEWS ───────────────────────────── */
  fetchNews();
});

async function fetchNews() {
  const loading = document.getElementById('news-loading');
  const grid = document.getElementById('news-grid');
  const error = document.getElementById('news-error');

  loading.style.display = 'flex';
  grid.innerHTML = '';
  error.style.display = 'none';

  let articles = null;

  try {
    const response = await fetch('/api/news/feed');
    if (response.ok) {
      const text = await response.text();
      articles = parseRSS(text);
    }
  } catch (e) {
    console.error('Failed to fetch from local API:', e);
  }

  loading.style.display = 'none';

  if (!articles || articles.length === 0) {
    // Use fallback articles
    console.log('Using fallback cricket articles');
    articles = FALLBACK_ARTICLES;
  }

  renderArticles(articles);
}

function parseRSS(xmlText) {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    const items = xml.querySelectorAll('item');

    if (items.length === 0) return null;

    return Array.from(items).map(item => {
      const title = item.querySelector('title')?.textContent || 'Cricket Update';
      const desc = item.querySelector('description')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '#';
      const pubDate = item.querySelector('pubDate')?.textContent || '';

      // Try to extract image from description or media
      let image = '';
      const mediaContent = item.querySelector('content');
      if (mediaContent) {
        image = mediaContent.getAttribute('url') || '';
      }
      // Try to extract from enclosure
      const enclosure = item.querySelector('enclosure');
      if (!image && enclosure) {
        image = enclosure.getAttribute('url') || '';
      }

      // Parse the date
      let dateStr = 'Today';
      if (pubDate) {
        const d = new Date(pubDate);
        const now = new Date();
        const diffH = Math.floor((now - d) / (1000 * 60 * 60));
        if (diffH < 1) dateStr = 'Just now';
        else if (diffH < 24) dateStr = `${diffH}h ago`;
        else dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }

      // Determine category
      let category = 'Cricket';
      const titleLower = title.toLowerCase();
      if (titleLower.includes('ipl')) category = 'IPL';
      else if (titleLower.includes('t20') || titleLower.includes('world cup')) category = 'T20 WC';
      else if (titleLower.includes('test') || titleLower.includes('wtc')) category = 'Test';
      else if (titleLower.includes('odi')) category = 'ODI';
      else if (titleLower.includes('live') || titleLower.includes('score')) category = 'Live';
      else if (titleLower.includes('squad') || titleLower.includes('select')) category = 'Squads';
      else if (titleLower.includes('injury') || titleLower.includes('return')) category = 'Updates';

      // Clean description
      let cleanDesc = desc.replace(/<[^>]+>/g, '').trim();
      if (cleanDesc.length > 200) cleanDesc = cleanDesc.substring(0, 200) + '...';

      return { title, desc: cleanDesc, link, date: dateStr, image, category };
    });
  } catch (e) {
    console.error('RSS parse error:', e);
    return null;
  }
}

function renderArticles(articles) {
  const grid = document.getElementById('news-grid');
  
  grid.innerHTML = articles.map((article, i) => {
    const isFeatured = i === 0 ? 'featured' : '';
    const isLive = article.category === 'Live' ? 'live' : '';
    const icon = CRICKET_ICONS[i % CRICKET_ICONS.length];

    const imageHTML = article.image
      ? `<img src="${article.image}" alt="${article.title}" onerror="this.parentElement.innerHTML='<div class=placeholder-img>${icon}</div>'">`
      : `<div class="placeholder-img">${icon}</div>`;

    return `
      <article class="news-card ${isFeatured}" onclick="openArticleModal('${article.link}', '${article.title.replace(/'/g, "\\'")}')">
        <div class="card-image">
          ${imageHTML}
          <span class="card-category ${isLive}">${article.category}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">${article.title}</h3>
          <p class="card-desc">${article.desc || 'Read the latest cricket update from Cricbuzz.'}</p>
          <div class="card-footer">
            <span class="card-date">${article.date}</span>
            <span class="card-source">CRICBUZZ</span>
            <span class="card-arrow">→</span>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

/* ─── MODAL LOGIC ───────────────────────────── */
function openArticleModal(link, title) {
  if (!link || link === '#') {
    alert("This is a cached placeholder article. Full text is unavailable.");
    return;
  }

  const modal = document.getElementById('news-modal');
  const iframe = document.getElementById('news-iframe');
  const titleEl = document.getElementById('modal-title');
  const loader = document.getElementById('modal-loader');

  titleEl.textContent = title || 'Reading Article';
  loader.style.display = 'flex';
  
  // Proxy the request through our node server to strip X-Frame-Options
  iframe.src = '/api/news/proxy?url=' + encodeURIComponent(link);
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  iframe.onload = () => {
    loader.style.display = 'none';
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('news-modal');
  const closeBtn = document.getElementById('modal-close');
  const backdrop = document.getElementById('modal-backdrop');
  
  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('news-iframe').src = '';
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });
});
