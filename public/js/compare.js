/* ═══════════════════════════════════════════════════
   STATAC Compare — Script
   ═══════════════════════════════════════════════════ */

console.log('⚔️ STATAC Compare Engine Initialized');

let CRICKET_PLAYERS = [];
let isDataLoaded = false;
let players = [null, null, null]; // up to 3 players
let activeSlot = null;
let compareCharts = {};

document.addEventListener('DOMContentLoaded', function () {

  /* ─── NAVBAR SCROLL ────────────────────────── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 70);
  }, { passive: true });

  /* ─── INIT ─────────────────────────────── */
  // Auto-fill Player 1 from session if available
  const storedData = sessionStorage.getItem('playerData');
  if (storedData) {
    const pData = JSON.parse(storedData);
    players[0] = pData;
    fillSlot(0, pData);
  }

  /* ─── SLOT CLICK HANDLERS ──────────────────── */
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`slot-${i + 1}`);
    if (slot) {
      slot.addEventListener('click', (e) => {
        if (e.target.closest('.slot-remove')) return;
        activeSlot = i;
        openSearch();
      });
    }

    const removeBtn = document.getElementById(`slot-remove-${i + 1}`);
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removePlayer(i);
      });
    }
  }

  /* ─── ADD 3RD PLAYER BUTTON ────────────────── */
  const addBtn = document.getElementById('add-player-3');
  addBtn.addEventListener('click', () => {
    document.getElementById('slot-3').classList.remove('hidden');
    addBtn.classList.add('hidden');
    activeSlot = 2;
    openSearch();
  });

  /* ─── FORMAT TAB EVENTS ────────────────────── */
  document.querySelectorAll('.fmt-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.fmt-tab.active').classList.remove('active');
      btn.classList.add('active');
      activeFormat = btn.dataset.format;
      refreshTable();
    });
  });

  /* ─── TYPE TOGGLE EVENTS ───────────────────── */
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.type-btn.active').classList.remove('active');
      btn.classList.add('active');
      activeType = btn.dataset.type;
      refreshTable();
    });
  });

  /* ─── SEARCH LOGIC ─────────────────────────── */
  const searchOverlay = document.getElementById('searchOverlay');
  const searchBackdrop = document.getElementById('searchBackdrop');
  const searchBarPill = document.getElementById('searchBarPill');
  const searchInput = document.getElementById('searchInput');
  const searchSugg = document.getElementById('searchSuggestions');

  searchInput.addEventListener('input', e => renderSuggestions(e.target.value));
  searchInput.addEventListener('focus', () => {
    searchBarPill.classList.add('focused');
    renderSuggestions(searchInput.value);
  });
  searchInput.addEventListener('blur', () => searchBarPill.classList.remove('focused'));
  searchBackdrop.addEventListener('click', closeSearch);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });
});

/* ═══════════ ACTIVE STATE ═══════════ */
let activeFormat = 'Tests';
let activeType = 'BATTING';

/* ═══════════ SEARCH FUNCTIONS ═══════════ */
function openSearch() {
  const overlay = document.getElementById('searchOverlay');
  const input = document.getElementById('searchInput');
  overlay.classList.add('active');
  setTimeout(() => { input.focus(); renderSuggestions(''); }, 300);
}

function closeSearch() {
  const overlay = document.getElementById('searchOverlay');
  const sugg = document.getElementById('searchSuggestions');
  overlay.classList.remove('active');
  sugg.classList.remove('visible');
  document.getElementById('searchInput').value = '';
}

function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

async function renderSuggestions(query) {
  const sugg = document.getElementById('searchSuggestions');
  const q = query.trim();
  sugg.innerHTML = '<div class="search-no-results">Searching...</div>';
  sugg.classList.add('visible');

  try {
    const url = `/api/players/search?q=${encodeURIComponent(q)}&limit=12`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      sugg.innerHTML = '<div class="search-no-results">No players found</div>';
    } else {
      sugg.innerHTML = data.results.map(p => `
      <div class="suggest-item" data-name="${p.name.replace(/"/g, '&quot;')}" onclick="selectPlayerForCompare(this.getAttribute('data-name'))">
        <div class="suggest-icon">${p.initials}</div>
        <div class="suggest-name">${highlight(p.name, q)}</div>
        <div class="suggest-meta">${p.meta}</div>
      </div>
    `).join('');
    }
  } catch (err) {
    sugg.innerHTML = '<div class="search-no-results">Server unavailable.</div>';
  }
  sugg.classList.add('visible');
}

async function selectPlayerForCompare(name) {
  if (activeSlot === null) return;
  try {
    const res = await fetch(`/api/player/${encodeURIComponent(name)}`);
    const playerData = await res.json();
    if (playerData && !playerData.error) {
      players[activeSlot] = playerData;
      fillSlot(activeSlot, playerData);
      closeSearch();
      activeSlot = null;
      updateComparison();
    }
  } catch(err) {
    console.error('Failed to fetch player for comparison:', err);
  }
}

/* ═══════════ SLOT MANAGEMENT ═══════════ */
function fillSlot(idx, data) {
  const name = data.NAME || 'Unknown';
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const meta = `${data.COUNTRY || ''} · ${data["Playing role"] || 'Player'}`;
  const n = idx + 1;

  document.getElementById(`slot-init-${n}`).textContent = initials;
  document.getElementById(`slot-name-${n}`).textContent = name;
  document.getElementById(`slot-meta-${n}`).textContent = meta;
  document.getElementById(`slot-${n}`).classList.add('filled');
  document.getElementById(`slot-remove-${n}`).style.display = 'block';
}

function removePlayer(idx) {
  const n = idx + 1;
  players[idx] = null;
  document.getElementById(`slot-init-${n}`).textContent = '?';
  document.getElementById(`slot-name-${n}`).textContent = `Player ${n}`;
  document.getElementById(`slot-meta-${n}`).textContent = 'Search to select';
  document.getElementById(`slot-${n}`).classList.remove('filled');
  document.getElementById(`slot-remove-${n}`).style.display = 'none';

  if (idx === 2) {
    document.getElementById('slot-3').classList.add('hidden');
    document.getElementById('add-player-3').classList.remove('hidden');
  }
  updateComparison();
}

/* ═══════════ DATA HELPERS ═══════════ */
function getVal(p, prefix, format, stat) {
  const key = `${prefix}_${format}_${stat}`;
  const v = p[key];
  return (v !== undefined && v !== "-" && v.trim() !== "") ? v : "-";
}

function getNum(p, prefix, format, stat) {
  const v = getVal(p, prefix, format, stat);
  return v === "-" ? 0 : parseFloat(v.replace(/,/g, ''));
}

/* ═══════════ UPDATE COMPARISON ═══════════ */
function updateComparison() {
  const activePlayers = players.filter(p => p !== null);
  const mainEl = document.getElementById('compare-main');

  if (activePlayers.length < 2) {
    mainEl.style.display = 'none';
    return;
  }

  mainEl.style.display = 'block';
  refreshTable();
}

function refreshTable() {
  const activePlayers = players.filter(p => p !== null);
  if (activePlayers.length < 2) return;
  renderCompareTable(activePlayers, activeFormat, activeType);
  renderCompareCharts(activePlayers, activeFormat, activeType);
}

/* ═══════════ COMPARE TABLE (Single Format) ═══════════ */
function renderCompareTable(activePlayers, format, type) {
  const COLORS = ['#C9FF47', '#FF4B26', '#6366f1'];

  const batFields = ['Mat','Inns','NO','Runs','HS','Ave','BF','SR','100','50','4s','6s','Ct','St'];
  const bowlFields = ['Mat','Inns','Balls','Runs','Wkts','BBI','BBM','Ave','Econ','SR','4w','5w','10'];
  const fields = type === 'BATTING' ? batFields : bowlFields;

  // Header row: Stat | Player1 | Player2 | Player3
  let thead = '<tr><th>Stat</th>';
  activePlayers.forEach((p, i) => {
    const shortName = (p.NAME || 'Unknown').split(' ').pop();
    thead += `<th class="player-subheader" style="color:${COLORS[i]}">${shortName}</th>`;
  });
  thead += '</tr>';

  // Body rows: one row per stat field
  let tbody = '';
  fields.forEach(stat => {
    tbody += `<tr><th>${stat}</th>`;
    activePlayers.forEach(p => {
      const v = getVal(p, type, format, stat);
      tbody += `<td>${v === '-' ? '<span class="stat-empty">-</span>' : v}</td>`;
    });
    tbody += '</tr>';
  });

  document.getElementById('compare-thead').innerHTML = thead;
  document.getElementById('compare-tbody').innerHTML = tbody;
}

/* ═══════════ COMPARE CHARTS ═══════════ */
const PLAYER_COLORS = [
  { bg: 'rgba(201,255,71,.7)', border: '#C9FF47' },
  { bg: 'rgba(255,75,38,.7)', border: '#FF4B26' },
  { bg: 'rgba(99,102,241,.7)', border: '#6366f1' }
];

/* ─── Chart config definitions per type ─── */
function getChartConfigs(type, format) {
  const isBatting = type === 'BATTING';

  if (isBatting) {
    return [
      {
        id: 'chart-runs',
        title: `Runs — ${format}`,
        chartType: 'bar',
        stat: 'Runs',
        format: format
      },
      {
        id: 'chart-avg',
        title: `Batting Average — ${format}`,
        chartType: 'bar',
        stat: 'Ave',
        format: format
      },
      {
        id: 'chart-sr',
        title: `Strike Rate — ${format}`,
        chartType: 'radar',
        stat: 'SR',
        format: format
      },
      {
        id: 'chart-wkts',
        title: `Boundaries (4s vs 6s) — ${format}`,
        chartType: 'bar',
        multiStat: ['4s', '6s'],
        format: format
      },
      {
        id: 'chart-milestones',
        title: `Centuries & Fifties — ${format}`,
        chartType: 'bar',
        multiStat: ['100', '50'],
        format: format
      }
    ];
  } else {
    return [
      {
        id: 'chart-runs',
        title: `Wickets — ${format}`,
        chartType: 'bar',
        stat: 'Wkts',
        format: format
      },
      {
        id: 'chart-avg',
        title: `Bowling Average — ${format}`,
        chartType: 'bar',
        stat: 'Ave',
        format: format
      },
      {
        id: 'chart-sr',
        title: `Economy Rate — ${format}`,
        chartType: 'radar',
        stat: 'Econ',
        format: format
      },
      {
        id: 'chart-wkts',
        title: `Bowling Strike Rate — ${format}`,
        chartType: 'bar',
        stat: 'SR',
        format: format
      },
      {
        id: 'chart-milestones',
        title: `4W & 5W Hauls — ${format}`,
        chartType: 'bar',
        multiStat: ['4w', '5w'],
        format: format
      }
    ];
  }
}

function renderCompareCharts(activePlayers, format, type) {
  // Destroy old charts
  Object.values(compareCharts).forEach(c => { if (c) c.destroy(); });
  compareCharts = {};

  const pNames = activePlayers.map(p => (p.NAME || 'Unknown').split(' ').pop());
  const configs = getChartConfigs(type, format);

  configs.forEach(cfg => {
    // Update the chart card title
    const canvas = document.getElementById(cfg.id);
    if (!canvas) return;
    const titleEl = canvas.closest('.chart-card')?.querySelector('.cc-title');
    if (titleEl) titleEl.textContent = cfg.title;

    if (cfg.multiStat) {
      // Grouped bar with multiple stat categories (e.g. 100s & 50s, or 4w & 5w)
      compareCharts[cfg.id] = makeGroupedBar(cfg.id, {
        categories: cfg.multiStat,
        datasets: activePlayers.map((p, i) => ({
          label: pNames[i],
          data: cfg.multiStat.map(s => getNum(p, type, format, s)),
          backgroundColor: PLAYER_COLORS[i].bg,
          borderColor: PLAYER_COLORS[i].border,
          borderWidth: 2,
          borderRadius: 6
        }))
      });
    } else if (cfg.chartType === 'radar') {
      // Radar chart — show the stat across all 3 international formats for comparison
      const intlFormats = ['Tests', 'ODIs', 'T20Is'];
      compareCharts[cfg.id] = makeOverlayRadar(cfg.id, {
        categories: ['Test', 'ODI', 'T20I'],
        datasets: activePlayers.map((p, i) => ({
          label: pNames[i],
          data: intlFormats.map(f => getNum(p, type, f, cfg.stat)),
          backgroundColor: PLAYER_COLORS[i].bg.replace('.7', '.15'),
          borderColor: PLAYER_COLORS[i].border,
          borderWidth: 2,
          pointBackgroundColor: PLAYER_COLORS[i].border,
          pointRadius: 4
        }))
      });
    } else {
      // Single stat bar chart — one bar per player for the selected format
      compareCharts[cfg.id] = makeGroupedBar(cfg.id, {
        categories: pNames,
        datasets: [{
          label: cfg.stat,
          data: activePlayers.map(p => getNum(p, type, format, cfg.stat)),
          backgroundColor: activePlayers.map((_, i) => PLAYER_COLORS[i].bg),
          borderColor: activePlayers.map((_, i) => PLAYER_COLORS[i].border),
          borderWidth: 2,
          borderRadius: 6
        }]
      });
    }
  });
}

function makeGroupedBar(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cfg.categories,
      datasets: cfg.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 12 } }
        },
        tooltip: {
          backgroundColor: '#0C0C1C',
          titleColor: '#C9FF47',
          bodyColor: '#F2F2FF',
          borderColor: '#252542',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(144,144,184,.08)' },
          ticks: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 11 } }
        },
        y: {
          grid: { color: 'rgba(144,144,184,.08)' },
          ticks: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 11 } }
        }
      }
    }
  });
}

function makeOverlayRadar(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: cfg.categories,
      datasets: cfg.datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: 'rgba(144,144,184,.15)' },
          grid: { color: 'rgba(144,144,184,.12)' },
          pointLabels: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 12 } },
          ticks: { display: false },
          beginAtZero: true
        }
      },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 12 } }
        },
        tooltip: {
          backgroundColor: '#0C0C1C',
          titleColor: '#C9FF47',
          bodyColor: '#F2F2FF',
          borderColor: '#252542',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8
        }
      }
    }
  });
}
