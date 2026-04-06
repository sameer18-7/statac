/* ═══════════════════════════════════════════════════════════
   STATAC Rankings — Client Script
   Fetches ICC rankings, manages tabs, renders table,
   supports search filtering.
   ═══════════════════════════════════════════════════════════ */

console.log('🏆 STATAC Rankings Engine Initialized');

// ─── State ──────────────────────────────────────────────────
let state = {
  gender: 'men',       // 'men' | 'women'
  format: 'odi',       // 'test' | 'odi' | 't20i'
  category: 'batting', // 'batting' | 'bowling' | 'allrounder'
  searchQuery: '',
};

// Cache fetched data: { 'men:batting': { formats: { test: [...], odi: [...], t20i: [...] } } }
const dataCache = {};

// ─── DOM refs ───────────────────────────────────────────────
const genderToggle = document.getElementById('genderToggle');
const formatTabs = document.getElementById('formatTabs');
const categoryTabs = document.getElementById('categoryTabs');
const searchInput = document.getElementById('rankingsSearch');
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');
const loadingEl = document.getElementById('rankingsLoading');
const errorEl = document.getElementById('rankingsError');
const noResultsEl = document.getElementById('noResults');
const retryBtn = document.getElementById('retryBtn');
const metaCount = document.getElementById('metaCount');
const navbar = document.getElementById('navbar');

// ─── Navbar scroll ──────────────────────────────────────────
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 70);
}, { passive: true });

// ─── Gender Toggle ──────────────────────────────────────────
genderToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.gender-btn');
  if (!btn || btn.classList.contains('active')) return;

  genderToggle.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  state.gender = btn.dataset.gender;

  // Update body theme class
  document.body.classList.toggle('theme-women', state.gender === 'women');

  // Update hash
  updateHash();

  // Fetch data
  loadRankings();
});

// ─── Format Tabs ────────────────────────────────────────────
formatTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.format-tab');
  if (!tab || tab.classList.contains('active')) return;

  formatTabs.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  state.format = tab.dataset.format;
  updateHash();
  renderFromCache();
});

// ─── Category Tabs ──────────────────────────────────────────
categoryTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.category-tab');
  if (!tab || tab.classList.contains('active')) return;

  categoryTabs.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');

  state.category = tab.dataset.category;
  updateHash();
  loadRankings();
});

// ─── Search ─────────────────────────────────────────────────
let searchDebounce = null;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderFromCache();
  }, 200);
});

// ─── Retry ──────────────────────────────────────────────────
retryBtn.addEventListener('click', () => {
  loadRankings();
});

// ─── URL Hash Sync ──────────────────────────────────────────
function updateHash() {
  window.location.hash = `${state.gender}/${state.format}/${state.category}`;
}

function readHash() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return;
  const [gender, format, category] = hash.split('/');

  if (['men', 'women'].includes(gender)) state.gender = gender;
  if (['test', 'odi', 't20i'].includes(format)) state.format = format;
  if (['batting', 'bowling', 'allrounder'].includes(category)) state.category = category;

  // Sync UI
  document.body.classList.toggle('theme-women', state.gender === 'women');

  genderToggle.querySelectorAll('.gender-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.gender === state.gender);
  });
  formatTabs.querySelectorAll('.format-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.format === state.format);
  });
  categoryTabs.querySelectorAll('.category-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.category === state.category);
  });
}


// ─── Data Fetching ──────────────────────────────────────────
async function loadRankings() {
  const cacheKey = `${state.gender}:${state.category}`;

  // If cached, render immediately
  if (dataCache[cacheKey]) {
    renderFromCache();
    return;
  }

  // Show loading
  showLoading();

  try {
    const url = `/api/rankings/${state.gender}/${state.category}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    dataCache[cacheKey] = data.formats || {};
    renderFromCache();

  } catch (err) {
    console.error('Rankings fetch error:', err);
    showError();
  }
}


// ─── Rendering ──────────────────────────────────────────────
function renderFromCache() {
  const cacheKey = `${state.gender}:${state.category}`;
  const cached = dataCache[cacheKey];

  if (!cached) {
    loadRankings();
    return;
  }

  const players = cached[state.format] || [];

  // Filter by search
  let filtered = players;
  if (state.searchQuery) {
    filtered = players.filter(p =>
      p.name.toLowerCase().includes(state.searchQuery) ||
      p.country.toLowerCase().includes(state.searchQuery) ||
      (p.countryCode && p.countryCode.toLowerCase().includes(state.searchQuery))
    );
  }

  // Hide loading/error
  loadingEl.style.display = 'none';
  errorEl.classList.remove('visible');

  if (filtered.length === 0 && players.length === 0) {
    // No data for this format
    tableHeader.style.display = 'none';
    tableBody.innerHTML = '';
    noResultsEl.textContent = 'No rankings data available for this selection.';
    noResultsEl.classList.add('visible');
    metaCount.textContent = '';
    return;
  }

  if (filtered.length === 0) {
    tableHeader.style.display = 'none';
    tableBody.innerHTML = '';
    noResultsEl.textContent = 'No players match your search.';
    noResultsEl.classList.add('visible');
    metaCount.textContent = `0 of ${players.length} players`;
    return;
  }

  noResultsEl.classList.remove('visible');
  tableHeader.style.display = 'grid';

  // Update meta
  if (state.searchQuery) {
    metaCount.textContent = `${filtered.length} of ${players.length} players`;
  } else {
    metaCount.textContent = `${filtered.length} players`;
  }

  // Render rows
  tableBody.innerHTML = filtered.map((player, index) => {
    const rank = player.rank;
    const isTop1 = rank === 1;
    const isTop2 = rank === 2;
    const isTop3 = rank === 3;
    const isTop10 = rank <= 10;

    let rowClass = 'rank-row';
    if (isTop1) rowClass += ' top-1 top-10';
    else if (isTop2) rowClass += ' top-2 top-10';
    else if (isTop3) rowClass += ' top-3 top-10';
    else if (isTop10) rowClass += ' top-10';

    // Initials for avatar
    const initials = player.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    // Trend icon
    let trendHtml = '';
    const trend = (player.trend || 'Flat').toLowerCase();
    if (trend === 'up' || trend === 'increase') {
      trendHtml = '<span class="trend-up">▲ Up</span>';
    } else if (trend === 'down' || trend === 'decrease') {
      trendHtml = '<span class="trend-down">▼ Down</span>';
    } else {
      trendHtml = '<span class="trend-flat">— Flat</span>';
    }

    return `
      <div class="${rowClass}" style="animation-delay: ${index * 30}ms">
        <div class="rank-num">${rank}</div>
        <div class="player-info">
          <div class="player-avatar">${initials}</div>
          <div class="player-name">${escapeHtml(player.name)}</div>
        </div>
        <div class="player-country">
          <span class="country-flag">${player.flag || '🏏'}</span>
          ${escapeHtml(player.country || '')}
        </div>
        <div class="player-rating">${player.rating || '—'}</div>
        <div class="player-trend">${trendHtml}</div>
      </div>
    `;
  }).join('');
}


// ─── UI State helpers ───────────────────────────────────────
function showLoading() {
  loadingEl.style.display = 'flex';
  errorEl.classList.remove('visible');
  noResultsEl.classList.remove('visible');
  tableHeader.style.display = 'none';
  tableBody.innerHTML = '';
  metaCount.textContent = '';
}

function showError() {
  loadingEl.style.display = 'none';
  errorEl.classList.add('visible');
  noResultsEl.classList.remove('visible');
  tableHeader.style.display = 'none';
  tableBody.innerHTML = '';
  metaCount.textContent = '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}


// ─── Init ───────────────────────────────────────────────────
readHash();
loadRankings();
