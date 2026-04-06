    /* ─── NAVBAR SCROLL ──────────────────────────────────────── */
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 70);
    }, { passive: true });


    /* ─── EASING ─────────────────────────────────────────────── */
    function easeOut3(t) { return 1 - Math.pow(1 - t, 3); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp01(v) { return Math.max(0, Math.min(1, v)); }
    function inv(a, b, v) { return clamp01((v - a) / (b - a)); }


    /* ─── COUNTERS ───────────────────────────────────────────── */
    function runCounters() {
      document.querySelectorAll('.cn').forEach(el => {
        const raw = el.dataset.d;
        const isMil = raw.includes('M');
        const isDec = raw.includes('.');
        const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
        const suf = isMil ? 'M' : (isDec ? '' : '');
        const dur = 1500;
        let t0 = null;
        function tick(ts) {
          if (!t0) t0 = ts;
          const p = clamp01((ts - t0) / dur);
          const v = easeOut3(p) * num;
          el.textContent = isDec || isMil ? v.toFixed(1) + suf : Math.floor(v) + suf;
          if (p < 1) requestAnimationFrame(tick);
          else el.textContent = raw;
        }
        requestAnimationFrame(tick);
      });
    }

    let cRan = false;
    const statsObs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !cRan) { cRan = true; runCounters(); }
    }, { threshold: 0.3 });
    statsObs.observe(document.querySelector('.stats-bar'));


    /* ─── REVEAL ANIMATIONS ──────────────────────────────────── */
    const revObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => revObs.observe(el));

    // Player cards stagger
    const cardObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const d = parseInt(e.target.dataset.del || 0);
          setTimeout(() => e.target.classList.add('show'), d);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.p-card').forEach(c => cardObs.observe(c));

    // Scroll section header
    const hdrObs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting)
        document.getElementById('animHeader').classList.add('show');
    }, { threshold: 0.1 });
    hdrObs.observe(document.getElementById('scrollSticky'));


    /* ─── SPEED LINES (injected into scene) ─────────────────── */
    const linesContainer = document.getElementById('speedLines');
    const LINES = [];
    for (let i = 0; i < 8; i++) {
      const div = document.createElement('div');
      div.className = 's-line';
      div.style.top = (15 + i * 9) + '%';
      div.style.left = (20 + Math.random() * 30) + '%';
      div.style.width = (40 + Math.random() * 60) + 'px';
      linesContainer.appendChild(div);
      LINES.push(div);
    }


    /* ─── SCROLLIMATION ──────────────────────────────────────── */
    const outer = document.getElementById('scrollOuter');
    const batWrap = document.getElementById('batWrap');
    const ballWrap = document.getElementById('ballWrap');
    const impactFx = document.getElementById('impactFx');
    const crackTxt = document.getElementById('crackTxt');
    const progFill = document.getElementById('progFill');
    const progNum = document.getElementById('progNum');
    const ballSvg = ballWrap.querySelector('svg');
    const phases = [
      document.getElementById('ph0'),
      document.getElementById('ph1'),
      document.getElementById('ph2'),
      document.getElementById('ph3'),
    ];

    let lastPhase = -1;
    function setPhase(idx) {
      if (idx === lastPhase) return;
      lastPhase = idx;
      phases.forEach((p, i) => p.classList.toggle('on', i === idx));
    }

    // Phase breakpoints
    const P0 = 0;     // wind-up start
    const P1 = 0.30;  // pitch coming in
    const P2 = 0.58;  // impact
    const P3 = 0.72;  // homerun
    const P4 = 1.0;

    function updateScene(p) {
      // progress bar
      const pct = Math.round(p * 100);
      progFill.style.width = pct + '%';
      progNum.textContent = String(pct).padStart(2, '0') + '%';

      let batAngle, ballX, ballY, impOp, crackOp, glowStr;

      if (p <= P1) {
        // ── WIND-UP ──────────────────────────
        const t = inv(P0, P1, p);
        batAngle = lerp(-42, -68, t);
        ballX = 92; ballY = 56;
        impOp = 0; crackOp = 0;
        glowStr = 'none';
        // speed lines off
        LINES.forEach(l => l.style.opacity = 0);
        setPhase(0);

      } else if (p <= P2) {
        // ── PITCH COMING IN ──────────────────
        const t = inv(P1, P2, p);
        batAngle = lerp(-68, -16, t);
        ballX = lerp(92, 36, t);
        ballY = 56 + Math.sin(t * Math.PI) * -3;
        impOp = 0; crackOp = 0;
        glowStr = `drop-shadow(0 0 ${6 + t * 8}px rgba(255,255,200,.7))`;
        // speed lines appear
        LINES.forEach((l, i) => {
          l.style.opacity = t > .3 ? (0.4 + Math.sin(i * .8) * .2) : 0;
          l.style.width = (40 + t * 60 + Math.sin(i) * 20) + 'px';
          l.style.transform = 'none';
        });
        setPhase(1);

      } else if (p <= P3) {
        // ── IMPACT ───────────────────────────
        const t = inv(P2, P3, p);
        batAngle = lerp(-16, 28, t);
        ballX = 36; ballY = 56;
        const flash = t < .5 ? t * 2 : (1 - t) * 2;
        impOp = flash;
        crackOp = t < .25 ? t * 4 : (t > .85 ? (1 - t) * 6.7 : 1);
        crackTxt.style.transform = `translate(-50%,-50%) scale(${0.8 + t * 1.7})`;
        glowStr = `drop-shadow(0 0 ${20 + flash * 30}px rgba(201,255,71,${.5 + flash * .5}))`;
        LINES.forEach(l => l.style.opacity = 0);
        setPhase(2);

      } else {
        // ── HOME RUN ─────────────────────────
        const t = inv(P3, P4, p);
        batAngle = lerp(28, 38, t);
        ballX = lerp(36, 112, t);
        ballY = lerp(56, 6, Math.pow(t, .65));
        impOp = 0;
        crackOp = Math.max(0, 1 - t * 5);
        glowStr = `drop-shadow(0 0 ${14 + t * 10}px rgba(255,180,60,.9))`;
        ballSvg.style.transform = `rotate(${t * 600}deg)`;
        // speed lines trail
        LINES.forEach((l, i) => {
          const vis = t > .1;
          l.style.opacity = vis ? (.3 + Math.sin(i * .9) * .2) : 0;
          l.style.width = (60 + t * 80 + Math.sin(i * 1.4) * 30) + 'px';
          l.style.left = (ballX - 10 - i * 5 - t * 20) + '%';
          l.style.top = (ballY - 2 + i * 3) + '%';
          l.style.transform = `rotate(${-25 - t * 10}deg)`;
        });
        setPhase(3);
      }

      batWrap.style.transform = `rotate(${batAngle}deg)`;
      ballWrap.style.left = ballX + '%';
      ballWrap.style.top = ballY + '%';
      impactFx.style.opacity = impOp;
      crackTxt.style.opacity = crackOp;
      ballSvg.style.filter = glowStr;
    }

    window.addEventListener('scroll', () => {
      const wrapTop = outer.offsetTop;
      const wrapH = outer.offsetHeight;
      const vh = window.innerHeight;
      const scrolled = window.scrollY - wrapTop;
      const maxScroll = wrapH - vh;
      const progress = clamp01(scrolled / maxScroll);
      updateScene(progress);
    }, { passive: true });

    // init
    updateScene(0);


    /* ─── SEARCH OVERLAY (API-powered) ───────────────────── */
    let searchDebounceTimer = null;

    const searchOverlay = document.getElementById('searchOverlay');
    const searchBackdrop = document.getElementById('searchBackdrop');
    const searchBarPill = document.getElementById('searchBarPill');
    const searchInput = document.getElementById('searchInput');
    const searchSugg = document.getElementById('searchSuggestions');
    const voiceBtn = document.getElementById('voiceBtn');
    const navPlayers = document.getElementById('navPlayers');

    let searchOpen = false;
    let recognition = null;

    function openSearch() {
      searchOpen = true;
      searchOverlay.classList.add('active');
      setTimeout(() => { searchInput.focus(); renderSuggestions(''); }, 300);
    }

    function closeSearch() {
      searchOpen = false;
      searchOverlay.classList.remove('active');
      searchSugg.classList.remove('visible');
      searchInput.value = '';
      if (recognition) recognition.stop();
      voiceBtn.classList.remove('listening');
    }

    function highlight(text, query) {
      if (!query) return text;
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return text.replace(regex, '<mark>$1</mark>');
    }

    async function renderSuggestions(query) {
      const q = query.trim();
      searchSugg.innerHTML = '<div class="search-no-results">Searching...</div>';
      searchSugg.classList.add('visible');

      try {
        const url = `/api/players/search?q=${encodeURIComponent(q)}&limit=12`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
          searchSugg.innerHTML = '<div class="search-no-results">No players found</div>';
        } else {
          searchSugg.innerHTML = data.results.map(p => `
      <div class="suggest-item" data-name="${p.name.replace(/"/g, '&quot;')}" onclick="selectPlayer(this.getAttribute('data-name'))">
        <div class="suggest-icon">${p.initials}</div>
        <div class="suggest-name">${highlight(p.name, q)}</div>
        <div class="suggest-meta">${p.meta}</div>
      </div>
    `).join('');
        }
      } catch (err) {
        searchSugg.innerHTML = '<div class="search-no-results">Server unavailable. Make sure the backend is running.</div>';
      }
      searchSugg.classList.add('visible');
    }

    async function selectPlayer(name) {
      try {
        const res = await fetch(`/api/player/${encodeURIComponent(name)}`);
        const playerData = await res.json();
        if (playerData && !playerData.error) {
          sessionStorage.setItem('playerData', JSON.stringify(playerData));
          sessionStorage.setItem('searchedPlayer', name);
          window.location.href = 'player-analytics.html';
        }
      } catch (err) {
        console.error('Failed to fetch player:', err);
      }
    }

    navPlayers.addEventListener('click', e => {
      e.preventDefault();
      openSearch();
    });

    const navMaxx = document.getElementById('navMaxx');
    if (navMaxx) {
      navMaxx.addEventListener('click', e => {
        e.preventDefault();
        openSearch();
      });
    }

    const heroSearchBtn = document.getElementById('heroSearchBtn');
    if (heroSearchBtn) {
      heroSearchBtn.addEventListener('click', e => {
        e.preventDefault();
        openSearch();
      });
    }

    searchInput.addEventListener('input', e => {
      renderSuggestions(e.target.value);
    });

    searchInput.addEventListener('focus', () => {
      searchBarPill.classList.add('focused');
      renderSuggestions(searchInput.value);
    });

    searchInput.addEventListener('blur', () => {
      searchBarPill.classList.remove('focused');
    });

    searchBackdrop.addEventListener('click', closeSearch);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && searchOpen) closeSearch();
    });

    /* ── Voice Search ─────────────────────────────────────── */
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    voiceBtn.addEventListener('click', () => {
      if (!SpeechRecognition) {
        voiceBtn.title = 'Voice search not supported in this browser';
        return;
      }
      if (voiceBtn.classList.contains('listening')) {
        recognition.stop();
        voiceBtn.classList.remove('listening');
        return;
      }
      recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        voiceBtn.classList.add('listening');
        searchInput.placeholder = 'Listening...';
      };
      recognition.onresult = e => {
        const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
        searchInput.value = transcript;
        renderSuggestions(transcript);
      };
      recognition.onend = () => {
        voiceBtn.classList.remove('listening');
        searchInput.placeholder = 'Search players, teams, stats...';
      };
      recognition.onerror = () => {
        voiceBtn.classList.remove('listening');
        searchInput.placeholder = 'Search players, teams, stats...';
      };
      recognition.start();
    });
