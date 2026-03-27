/* ═══════════════════════════════════════════════════
   STATAC Player Analytics — Script
   MAXX PERFORMA functionality in STATAC theme
   ═══════════════════════════════════════════════════ */

console.log('⚡ STATAC Analytics Engine Initialized');

let charts = {};

document.addEventListener('DOMContentLoaded', function () {

  /* ─── NAVBAR SCROLL ────────────────────────── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 70);
  }, { passive: true });

  /* ─── PLAYER FROM SESSION ──────────────────── */
  const playerDataStr = sessionStorage.getItem('playerData');
  if (!playerDataStr) {
    window.location.href = 'statac.html';
    return;
  }
  const p = JSON.parse(playerDataStr);

  loadPlayerProfile(p);
  renderTables(p);

  const impactScore = calculateImpactScore(p);
  initializeImpactRing(impactScore);
  document.getElementById('impact-val').textContent = impactScore;

  setTimeout(() => initializeCharts(p), 150);
  setupChartZoom();
  setupHeartButton(p.NAME || 'Unknown');
  initReveal();
});

// Helper functions for parsing raw CSV values
function getVal(p, prefix, format, stat) {
  const key = `${prefix}_${format}_${stat}`;
  const v = p[key];
  return (v !== undefined && v !== "-" && v.trim() !== "") ? v : "-";
}

function getNum(p, prefix, format, stat) {
  const v = getVal(p, prefix, format, stat);
  return v === "-" ? 0 : parseFloat(v.replace(/,/g, ''));
}

/* ═══════════ LOAD PLAYER PROFILE ═══════════ */
function loadPlayerProfile(p) {
  const name = p.NAME || 'Unknown';
  const initials = name.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase();
  const role = p["Playing role"] || 'Player';
  const country = p.COUNTRY || '';
  const teamStr = `${country} · ${role} ${p.Height ? '· ' + p.Height : ''}`;

  // Aggregates
  const totalRuns = getNum(p, 'BATTING', 'Tests', 'Runs') + getNum(p, 'BATTING', 'ODIs', 'Runs') + getNum(p, 'BATTING', 'T20Is', 'Runs');
  const allAvgs = [getNum(p, 'BATTING', 'Tests', 'Ave'), getNum(p, 'BATTING', 'ODIs', 'Ave'), getNum(p, 'BATTING', 'T20Is', 'Ave')].filter(v => v > 0);
  const bestAvg = allAvgs.length ? Math.max(...allAvgs).toFixed(1) : '-';
  const bestSr = Math.max(getNum(p, 'BATTING', 'T20Is', 'SR'), getNum(p, 'BATTING', 'ODIs', 'SR')) || '-';

  // Header
  document.getElementById('ph-avatar-init').textContent = initials;
  document.getElementById('ph-name').textContent = name.toUpperCase();
  document.getElementById('ph-meta').textContent = teamStr;
  document.getElementById('ph-runs').textContent = totalRuns > 0 ? totalRuns.toLocaleString() : '-';
  document.getElementById('ph-avg').textContent = bestAvg;
  document.getElementById('ph-sr').textContent = bestSr > 0 ? bestSr : '-';

  // Sidebar
  document.getElementById('side-initial').textContent = initials;
  document.getElementById('full-name').textContent = p["Full name"] || name;
  document.getElementById('dob').textContent = p.Born || '-';
  document.getElementById('birthplace').textContent = (p.Born && p.Born.includes(',')) ? p.Born.split(',')[1].trim() : '-';
  document.getElementById('nickname').textContent = p.Nickname || '-';
  document.getElementById('role').textContent = role;
  document.getElementById('batting-style').textContent = p["Batting style"] || '-';
  document.getElementById('bowling-style').textContent = p["Bowling style"] || '-';
  document.getElementById('national-team').textContent = country || '-';
  document.getElementById('ipl-teams').textContent = p["Major teams"] || '-';
  document.getElementById('other-teams').textContent = '-';

  // Rankings placeholders (mocked for visual sake as dataset lacks it)
  document.getElementById('test-cur').textContent = '-';
  document.getElementById('test-best').textContent = '-';
  document.getElementById('odi-cur').textContent = '-';
  document.getElementById('odi-best').textContent = '-';
  document.getElementById('t20-cur').textContent = '-';
  document.getElementById('t20-best').textContent = '-';

  document.getElementById('prime-yrs').textContent = "Career Stats";
  document.getElementById('prime-runs').textContent = totalRuns > 0 ? totalRuns.toLocaleString() : '-';
  document.getElementById('prime-avg').textContent = bestAvg;

  // Stat cards
  const cards = [
    { val: getVal(p,'BATTING','Tests','HS'), desc: 'Highest Test Score' },
    { val: getVal(p,'BATTING','ODIs','HS'), desc: 'Highest ODI Score' },
    { val: getVal(p,'BATTING','T20Is','HS'), desc: 'Highest T20I Score' },
    { val: ((getNum(p,'BATTING','Tests','100')+getNum(p,'BATTING','ODIs','100')+getNum(p,'BATTING','T20Is','100')) || '-').toString(), desc: 'Total International Centuries' },
    { val: ((getNum(p,'BOWLING','Tests','Wkts')+getNum(p,'BOWLING','ODIs','Wkts')+getNum(p,'BOWLING','T20Is','Wkts')) || '-').toString(), desc: 'Total International Wickets' },
    { val: role.split(' ')[0], desc: 'Primary Role' }
  ];
  document.querySelectorAll('.s-card').forEach((c, i) => {
    if (cards[i]) {
      c.querySelector('.s-card-val').textContent = cards[i].val;
      c.querySelector('.s-card-desc').textContent = cards[i].desc;
    }
  });
}

function calculateImpactScore(p) {
  const runs = getNum(p, 'BATTING', 'Tests', 'Runs') + getNum(p, 'BATTING', 'ODIs', 'Runs');
  const wkts = getNum(p, 'BOWLING', 'Tests', 'Wkts') + getNum(p, 'BOWLING', 'ODIs', 'Wkts');
  let score = 40 + (runs / 200) + wkts;
  return Math.min(Math.round(score), 99);
}

/* ═══════════ TABLES ═══════════ */
function renderTables(p) {
  const formats = ['Tests', 'ODIs', 'T20Is', 'First-class', 'List A', 'T20s'];
  
  // Batting
  const batTbody = document.querySelector('#batting-table tbody');
  let batHTML = '';
  formats.forEach(f => {
    if(getVal(p, 'BATTING', f, 'Mat') !== '-') {
      batHTML += `<tr>
        <th>${f}</th>
        <td>${getVal(p, 'BATTING', f, 'Mat')}</td>
        <td>${getVal(p, 'BATTING', f, 'Inns')}</td>
        <td>${getVal(p, 'BATTING', f, 'NO')}</td>
        <td>${getVal(p, 'BATTING', f, 'Runs')}</td>
        <td>${getVal(p, 'BATTING', f, 'HS')}</td>
        <td>${getVal(p, 'BATTING', f, 'Ave')}</td>
        <td>${getVal(p, 'BATTING', f, 'BF')}</td>
        <td>${getVal(p, 'BATTING', f, 'SR')}</td>
        <td>${getVal(p, 'BATTING', f, '100')}</td>
        <td>${getVal(p, 'BATTING', f, '50')}</td>
        <td>${getVal(p, 'BATTING', f, '4s')}</td>
        <td>${getVal(p, 'BATTING', f, '6s')}</td>
        <td>${getVal(p, 'BATTING', f, 'Ct')}</td>
        <td>${getVal(p, 'BATTING', f, 'St')}</td>
      </tr>`;
    }
  });
  if(batHTML === '') batHTML = '<tr><td colspan="15" style="text-align:center;">No Batting Records Found</td></tr>';
  batTbody.innerHTML = batHTML.replace(/>-</g, '><span class="stat-empty">-</span><'); 

  // Bowling
  const bowlTbody = document.querySelector('#bowling-table tbody');
  let bowlHTML = '';
  formats.forEach(f => {
    if(getVal(p, 'BOWLING', f, 'Mat') !== '-') {
      bowlHTML += `<tr>
        <th>${f}</th>
        <td>${getVal(p, 'BOWLING', f, 'Mat')}</td>
        <td>${getVal(p, 'BOWLING', f, 'Inns')}</td>
        <td>${getVal(p, 'BOWLING', f, 'Balls')}</td>
        <td>${getVal(p, 'BOWLING', f, 'Runs')}</td>
        <td>${getVal(p, 'BOWLING', f, 'Wkts')}</td>
        <td>${getVal(p, 'BOWLING', f, 'BBI')}</td>
        <td>${getVal(p, 'BOWLING', f, 'BBM')}</td>
        <td>${getVal(p, 'BOWLING', f, 'Ave')}</td>
        <td>${getVal(p, 'BOWLING', f, 'Econ')}</td>
        <td>${getVal(p, 'BOWLING', f, 'SR')}</td>
        <td>${getVal(p, 'BOWLING', f, '4w')}</td>
        <td>${getVal(p, 'BOWLING', f, '5w')}</td>
        <td>${getVal(p, 'BOWLING', f, '10')}</td>
      </tr>`;
    }
  });
  if(bowlHTML === '') bowlHTML = '<tr><td colspan="14" style="text-align:center;">No Bowling Records Found</td></tr>';
  bowlTbody.innerHTML = bowlHTML.replace(/>-</g, '><span class="stat-empty">-</span><');
}

/* ═══════════ IMPACT RING ═══════════ */
function initializeImpactRing(score) {
  const ring = document.getElementById('ring-progress');
  if (!ring) return;
  const circ = 2 * Math.PI * 80; // r=80
  ring.style.strokeDasharray = circ;
  setTimeout(() => {
    ring.style.strokeDashoffset = circ - (score / 100) * circ;
  }, 300);
}

/* ═══════════ CHARTS ═══════════ */
const ACCENT_COLORS = ['#C9FF47','#FF4B26','#6366f1','#38bdf8','#f59e0b','#ec4899','#10b981','#a78bfa'];

function initializeCharts(p) {
  // 1. Intl Runs
  const intlRuns = [getNum(p,'BATTING','Tests','Runs'), getNum(p,'BATTING','ODIs','Runs'), getNum(p,'BATTING','T20Is','Runs')];
  charts.international = makeDonut('chart-intl', { labels: ['Test', 'ODI', 'T20I'], data: intlRuns });

  // 2. Domestic/Franchise runs
  const lblDOM = document.querySelector('[data-chart-id="iplTeams"]').previousElementSibling;
  if(lblDOM) lblDOM.textContent = 'Domestic Runs';
  const domRuns = [getNum(p,'BATTING','First-class','Runs'), getNum(p,'BATTING','List A','Runs'), getNum(p,'BATTING','T20s','Runs')];
  charts.iplTeams = makeBar('chart-ipl', { labels: ['FC', 'List A', 'T20s'], data: domRuns, label: 'Runs' });

  // 3. 100s & 50s
  const lblM = document.querySelector('[data-chart-id="iplOpposition"]').previousElementSibling;
  if(lblM) lblM.textContent = 'Milestones (100s & 50s)';
  const hundreds = getNum(p,'BATTING','Tests','100')+getNum(p,'BATTING','ODIs','100')+getNum(p,'BATTING','T20Is','100');
  const fifties = getNum(p,'BATTING','Tests','50')+getNum(p,'BATTING','ODIs','50')+getNum(p,'BATTING','T20Is','50');
  charts.iplOpposition = makeDonut('chart-opp', { labels: ['Centuries', 'Fifties'], data: [hundreds, fifties] });

  // 4. Batting Averages
  const lblA = document.querySelector('[data-chart-id="ranking"]').previousElementSibling;
  if(lblA) lblA.textContent = 'Batting Averages';
  const avgs = [getNum(p,'BATTING','Tests','Ave'), getNum(p,'BATTING','ODIs','Ave'), getNum(p,'BATTING','T20Is','Ave')];
  charts.ranking = makeBar('chart-rank', { labels: ['Test', 'ODI', 'T20I'], data: avgs, label: 'Average' });

  // 5. Strike Rates
  const lblS = document.querySelector('[data-chart-id="peak"]').previousElementSibling;
  if(lblS) lblS.textContent = 'Strike Rates';
  const srs = [getNum(p,'BATTING','Tests','SR'), getNum(p,'BATTING','ODIs','SR'), getNum(p,'BATTING','T20Is','SR')];
  charts.peak = makeRadar('chart-peak', { labels: ['Test', 'ODI', 'T20I'], data: srs, label: 'Strike Rate' });

  // 6. Wickets by Format
  const lblW = document.querySelector('[data-chart-id="timeline"]').previousElementSibling;
  if(lblW) lblW.textContent = 'Wickets Overview';
  const wkts = [getNum(p,'BOWLING','Tests','Wkts'), getNum(p,'BOWLING','ODIs','Wkts'), getNum(p,'BOWLING','T20Is','Wkts'), getNum(p,'BOWLING','First-class','Wkts'), getNum(p,'BOWLING','List A','Wkts'), getNum(p,'BOWLING','T20s','Wkts')];
  charts.timeline = makeBar('chart-timeline', { labels: ['Test','ODI','T20I','FC','List A','T20'], data: wkts, label: 'Wickets' });
}

function makeDonut(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cfg.labels,
      datasets: [{ data: cfg.data, backgroundColor: ACCENT_COLORS.slice(0, cfg.data.length), borderColor: '#0C0C1C', borderWidth: 3 }]
    },
    options: chartOpts('doughnut')
  });
}

function makeBar(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cfg.labels,
      datasets: [{ label: cfg.label || 'Value', data: cfg.data, backgroundColor: ACCENT_COLORS.slice(0, cfg.data.length), borderRadius: 6, borderSkipped: false }]
    },
    options: { ...chartOpts('bar'), indexAxis: 'y', scales: scaleOpts() }
  });
}

function makeRadar(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'radar',
    data: {
      labels: cfg.labels,
      datasets: [{ label: cfg.label || 'Value', data: cfg.data, backgroundColor: 'rgba(201,255,71,.15)', borderColor: '#C9FF47', borderWidth: 2, pointBackgroundColor: '#C9FF47', pointRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { angleLines: { color: 'rgba(144,144,184,.15)' }, grid: { color: 'rgba(144,144,184,.12)' }, pointLabels: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 11 } }, ticks: { display: false }, beginAtZero: true } },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() }
    }
  });
}

function makeLine(id, cfg) {
  const ctx = document.getElementById(id);
  if (!ctx) return null;
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: cfg.labels,
      datasets: [{ label: 'Runs/Year', data: cfg.data, borderColor: '#C9FF47', backgroundColor: 'rgba(201,255,71,.08)', borderWidth: 2.5, fill: true, tension: .4, pointBackgroundColor: '#C9FF47', pointBorderColor: '#0C0C1C', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6 }]
    },
    options: { ...chartOpts('line'), scales: scaleOpts() }
  });
}

function chartOpts(type) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 11, weight: 600 }, padding: 14, usePointStyle: true, pointStyle: 'circle' } },
      tooltip: tooltipStyle()
    }
  };
}

function tooltipStyle() {
  return {
    backgroundColor: 'rgba(12,12,28,.95)', titleColor: '#C9FF47', bodyColor: '#F2F2FF',
    borderColor: 'rgba(201,255,71,.3)', borderWidth: 1,
    titleFont: { family: "'Barlow Condensed'", size: 13, weight: 700 },
    bodyFont: { family: "'JetBrains Mono'", size: 12 },
    padding: 12, cornerRadius: 8
  };
}

function scaleOpts() {
  return {
    y: { beginAtZero: true, grid: { color: 'rgba(144,144,184,.08)' }, ticks: { color: '#9090B8', font: { family: "'JetBrains Mono'", size: 10 } } },
    x: { grid: { color: 'rgba(144,144,184,.06)' }, ticks: { color: '#9090B8', font: { family: "'Barlow Condensed'", size: 11 } } }
  };
}

/* ═══════════ CHART ZOOM ═══════════ */
function setupChartZoom() {
  const modal = document.getElementById('chart-modal');
  const backdrop = document.getElementById('cm-backdrop');
  const closeBtn = document.getElementById('cm-close');
  const modalCanvas = document.getElementById('modal-chart');
  let modalChart = null;

  document.querySelectorAll('.cc-expand').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      openModal(this.dataset.chartId);
    });
  });

  function openModal(chartId) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (modalChart) modalChart.destroy();
    const src = charts[chartId];
    if (!src) return;
    const cfg = src.config;
    modalChart = new Chart(modalCanvas, {
      type: cfg.type,
      data: JSON.parse(JSON.stringify(cfg.data)),
      options: JSON.parse(JSON.stringify(cfg.options))
    });
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    if (modalChart) { modalChart.destroy(); modalChart = null; }
  }

  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });
}

/* ═══════════ FAVOURITE HEART ═══════════ */
function setupHeartButton(playerName) {
  const btn = document.getElementById('heart-btn');
  const favs = JSON.parse(localStorage.getItem('statac-favs') || '[]');
  const key = playerName.toLowerCase();

  if (favs.includes(key)) btn.classList.add('liked');
  btn.textContent = favs.includes(key) ? '♥' : '♡';

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    let cur = JSON.parse(localStorage.getItem('statac-favs') || '[]');
    if (cur.includes(key)) {
      cur = cur.filter(p => p !== key);
      btn.classList.remove('liked');
      btn.textContent = '♡';
      showToast(`Removed ${capitalize(playerName)} from favourites`, 'info');
    } else {
      cur.push(key);
      btn.classList.add('liked');
      btn.textContent = '♥';
      floatHeart(e);
      showToast(`Added ${capitalize(playerName)} to favourites!`, 'success');
    }
    localStorage.setItem('statac-favs', JSON.stringify(cur));
  });
}

function floatHeart(event) {
  const r = event.currentTarget.getBoundingClientRect();
  const h = document.createElement('div');
  h.textContent = '♥';
  h.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top}px;font-size:1.6rem;color:var(--accent2);pointer-events:none;z-index:9999;animation:floatHeart 1.2s ease-out forwards;`;
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 1300);
}

/* ═══════════ TOAST ═══════════ */
function showToast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast ' + (type || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(20px)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

/* ═══════════ REVEAL ═══════════ */
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

/* ═══════════ UTILS ═══════════ */
function capitalize(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }
