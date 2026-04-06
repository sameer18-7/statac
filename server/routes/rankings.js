/* ═══════════════════════════════════════════════════════════
   STATAC — ICC Rankings Route
   Scrapes ICC rankings from Cricbuzz RSC flight data,
   caches in memory + MongoDB for performance.
   ═══════════════════════════════════════════════════════════ */

const { Router } = require('express');
const cheerio = require('cheerio');

// ─── In-memory cache ────────────────────────────────────────
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const memCache = new Map(); // key => { data, timestamp }

// ─── Country code + flag mapping ────────────────────────────
const COUNTRY_MAP = {
  'India': { code: 'IND', flag: '🇮🇳' },
  'Australia': { code: 'AUS', flag: '🇦🇺' },
  'England': { code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  'Pakistan': { code: 'PAK', flag: '🇵🇰' },
  'South Africa': { code: 'SA', flag: '🇿🇦' },
  'New Zealand': { code: 'NZ', flag: '🇳🇿' },
  'Sri Lanka': { code: 'SL', flag: '🇱🇰' },
  'West Indies': { code: 'WI', flag: '🌴' },
  'Bangladesh': { code: 'BAN', flag: '🇧🇩' },
  'Afghanistan': { code: 'AFG', flag: '🇦🇫' },
  'Zimbabwe': { code: 'ZIM', flag: '🇿🇼' },
  'Ireland': { code: 'IRE', flag: '🇮🇪' },
  'Scotland': { code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  'Netherlands': { code: 'NED', flag: '🇳🇱' },
  'Nepal': { code: 'NEP', flag: '🇳🇵' },
  'Oman': { code: 'OMN', flag: '🇴🇲' },
  'Namibia': { code: 'NAM', flag: '🇳🇦' },
  'UAE': { code: 'UAE', flag: '🇦🇪' },
  'USA': { code: 'USA', flag: '🇺🇸' },
  'Canada': { code: 'CAN', flag: '🇨🇦' },
  'Papua New Guinea': { code: 'PNG', flag: '🇵🇬' },
  'Uganda': { code: 'UGA', flag: '🇺🇬' },
  'Hong Kong': { code: 'HK', flag: '🇭🇰' },
  'Thailand': { code: 'THA', flag: '🇹🇭' },
};

function getCountryInfo(country) {
  if (!country) return { code: '??', flag: '🏏' };
  // Direct match
  if (COUNTRY_MAP[country]) return COUNTRY_MAP[country];
  // Partial match
  const key = Object.keys(COUNTRY_MAP).find(k =>
    country.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(country.toLowerCase())
  );
  return key ? COUNTRY_MAP[key] : { code: country.substring(0, 3).toUpperCase(), flag: '🏏' };
}

// ─── Cricbuzz URL mapping ───────────────────────────────────
// Each page returns all 3 formats (Test/ODI/T20) for a given gender × category
function buildCricbuzzUrl(gender, category) {
  // gender: 'men' | 'women'
  // category: 'batting' | 'bowling' | 'allrounder'
  const cbCat = category === 'allrounder' ? 'all-rounder' : category;
  return `https://www.cricbuzz.com/cricket-stats/icc-rankings/${gender}/${cbCat}`;
}

// ─── Format key mapping ────────────────────────────────────
// Cricbuzz uses these keys in the RSC data for format types
const FORMAT_KEYS = {
  'test': 'test',
  'odi': 'odi',
  't20i': 't20',
};


// ─── Scrape rankings from Cricbuzz ──────────────────────────
async function scrapeRankings(gender, category) {
  const url = buildCricbuzzUrl(gender, category);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/x-component',
      'RSC': '1',
      'Next-Router-State-Tree': '%5B%22%22%5D',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Cricbuzz returned ${response.status}`);
  }

  const text = await response.text();

  // ─── STRATEGY: Global extraction + split by rank resets ────
  // The RSC data contains all 3 formats inline. Rather than trying
  // to regex-match format section boundaries (which bleeds across),
  // we extract ALL player objects globally, then split them into
  // 3 groups by detecting rank resets (rank goes back to 1).
  // Finally, we map groups to formats based on key order.

  const result = {};

  const allPlayers = [];
  const playerPattern = /\\"id\\":\\"(\d+)\\",\\"rank\\":\\"(\d+)\\",\\"name\\":\\"([^\\]+)\\",\\"matches\\":\\"?([^\\,"]*)\\"?,?\\"rating\\":\\"([^\\]*)\\",\\"points\\":\\"([^\\]*)\\",\\"country\\":\\"([^\\]+)\\",\\"trend\\":\\"([^\\]+)\\"/g;

  let m;
  while ((m = playerPattern.exec(text)) !== null) {
    const countryInfo = getCountryInfo(m[7]);
    allPlayers.push({
      rank: parseInt(m[2]),
      name: m[3],
      country: m[7],
      countryCode: countryInfo.code,
      flag: countryInfo.flag,
      rating: parseInt(m[5]) || parseInt(m[6]) || 0,
      trend: m[8] || 'Flat',
      imageId: m[1],
    });
  }

  // Split into groups by rank resets (each format starts at rank 1)
  const groups = [];
  let current = [];
  for (const player of allPlayers) {
    if (player.rank === 1 && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(player);
  }
  if (current.length > 0) groups.push(current);

  // Deduplicate each group by player name
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(p => {
      const key = p.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // Determine format order from the RSC data's formatTypesData key order
  const orderMatch = text.match(/formatTypesData.*?\{.*?\\\\"(\w+)\\\\".*?\\\\"(\w+)\\\\".*?\\\\"(\w+)\\\\"/);
  let formatOrder = ['odi', 'test', 't20i']; // default

  if (orderMatch) {
    formatOrder = [orderMatch[1], orderMatch[2], orderMatch[3]].map(k => {
      if (k === 't20') return 't20i';
      return k;
    });
  }

  for (let i = 0; i < Math.min(groups.length, formatOrder.length); i++) {
    result[formatOrder[i]] = dedup(groups[i]);
  }

  return result;
}


// ─── Cache helpers ──────────────────────────────────────────
function cacheKey(gender, category) {
  return `rankings:${gender}:${category}`;
}

function getFromMemCache(key) {
  const entry = memCache.get(key);
  if (entry && (Date.now() - entry.timestamp) < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setMemCache(key, data) {
  memCache.set(key, { data, timestamp: Date.now() });
}


// ─── Route factory ──────────────────────────────────────────
module.exports = function createRankingsRouter(dbPromise) {
  const router = Router();

  // Helper to get/set MongoDB cache
  async function getDbCache(key) {
    try {
      const db = await dbPromise;
      if (!db) return null;
      const doc = await db.collection('rankings_cache').findOne({ _id: key });
      if (doc && (Date.now() - doc.timestamp) < CACHE_TTL) {
        return doc.data;
      }
      // Return stale data as fallback
      return doc ? { ...doc.data, _stale: true } : null;
    } catch {
      return null;
    }
  }

  async function setDbCache(key, data) {
    try {
      const db = await dbPromise;
      if (!db) return;
      await db.collection('rankings_cache').updateOne(
        { _id: key },
        { $set: { data, timestamp: Date.now() } },
        { upsert: true }
      );
    } catch (err) {
      console.error('Failed to write rankings cache:', err.message);
    }
  }

  /**
   * GET /api/rankings/:gender/:category
   * gender: men | women
   * category: batting | bowling | allrounder
   * Returns rankings for all 3 formats (test, odi, t20i)
   */
  router.get('/:gender/:category', async (req, res) => {
    const gender = req.params.gender.toLowerCase();
    const category = req.params.category.toLowerCase();

    // Validate params
    if (!['men', 'women'].includes(gender)) {
      return res.status(400).json({ error: 'Invalid gender. Use: men, women' });
    }
    if (!['batting', 'bowling', 'allrounder'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Use: batting, bowling, allrounder' });
    }

    const key = cacheKey(gender, category);

    try {
      // 1. Check memory cache
      const memCached = getFromMemCache(key);
      if (memCached) {
        return res.json({
          gender,
          category,
          cached: true,
          lastUpdated: new Date(memCache.get(key).timestamp).toISOString(),
          ...memCached,
        });
      }

      // 2. Try scraping fresh data
      let data;
      try {
        const scraped = await scrapeRankings(gender, category);
        data = { formats: scraped };
        // Save to both caches
        setMemCache(key, data);
        setDbCache(key, data);
      } catch (scrapeErr) {
        console.error(`Scrape failed for ${key}:`, scrapeErr.message);

        // 3. Fallback to MongoDB cache (even stale)
        const dbCached = await getDbCache(key);
        if (dbCached) {
          const isStale = dbCached._stale;
          delete dbCached._stale;
          return res.json({
            gender,
            category,
            cached: true,
            stale: isStale || false,
            ...dbCached,
          });
        }

        return res.status(502).json({
          error: 'Unable to fetch rankings. Please try again later.',
          detail: scrapeErr.message,
        });
      }

      return res.json({
        gender,
        category,
        cached: false,
        lastUpdated: new Date().toISOString(),
        ...data,
      });

    } catch (err) {
      console.error('Rankings error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/rankings/refresh/:gender/:category
   * Force refresh the cache for a specific combination
   */
  router.get('/refresh/:gender/:category', async (req, res) => {
    const gender = req.params.gender.toLowerCase();
    const category = req.params.category.toLowerCase();
    const key = cacheKey(gender, category);

    try {
      memCache.delete(key);
      const scraped = await scrapeRankings(gender, category);
      const data = { formats: scraped };
      setMemCache(key, data);
      setDbCache(key, data);

      res.json({
        gender,
        category,
        refreshed: true,
        lastUpdated: new Date().toISOString(),
        ...data,
      });
    } catch (err) {
      res.status(502).json({ error: 'Refresh failed', detail: err.message });
    }
  });

  return router;
};
