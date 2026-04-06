/* ═══════════════════════════════════════════════════════════
   STATAC — Express Backend Server
   Serves player data from MongoDB, static frontend files
   ═══════════════════════════════════════════════════════════ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const { dbPromise, getPlayersCollection } = require('./db');

// ─── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname, '../public')));

async function connectDB() {
  await dbPromise;
}

// ─── API Routes ─────────────────────────────────────────────
const authRoutes = require('./routes/auth')(dbPromise);
app.use('/api/auth', authRoutes);

const rankingsRoutes = require('./routes/rankings')(dbPromise);
app.use('/api/rankings', rankingsRoutes);

/**
 * GET /api/players/search?q=<query>&limit=<number>
 * Search players by name. Returns lightweight results for search suggestions.
 */
app.get('/api/players/search', async (req, res) => {
  try {
    const playersCollection = getPlayersCollection();
    if (!playersCollection) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const query = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);

    let filter = {};
    if (query) {
      // Case-insensitive word-boundary search (anchored to name field only)
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter = { NAME: { $regex: `\\b${escaped}`, $options: 'i' } };
    }

    const players = await playersCollection
      .find(filter)
      .project({
        NAME: 1,
        COUNTRY: 1,
        'Playing role': 1,
        _id: 0
      })
      .limit(limit)
      .toArray();

    // Format for frontend consumption
    const results = players.map(p => ({
      name: p.NAME || 'Unknown',
      initials: (p.NAME || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      meta: `${p.COUNTRY || ''} · ${p['Playing role'] || 'Player'}`
    }));

    res.json({ results, total: results.length });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/player/:name
 * Get full player data by exact name match.
 */
app.get('/api/player/:name', async (req, res) => {
  try {
    const playersCollection = getPlayersCollection();
    if (!playersCollection) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const name = decodeURIComponent(req.params.name).trim();
    const player = await playersCollection.findOne(
      { NAME: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
      { projection: { _id: 0 } }
    );

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (err) {
    console.error('Player fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

/**
 * GET /api/players/compare?names=Name1,Name2,Name3
 * Get full data for multiple players (for comparison page).
 */
app.get('/api/players/compare', async (req, res) => {
  try {
    const playersCollection = getPlayersCollection();
    if (!playersCollection) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const names = (req.query.names || '').split(',').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) {
      return res.status(400).json({ error: 'No player names provided' });
    }

    const regexFilters = names.map(n => ({
      NAME: { $regex: `^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }));

    const players = await playersCollection
      .find({ $or: regexFilters })
      .project({ _id: 0 })
      .toArray();

    res.json({ players });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ error: 'Comparison failed' });
  }
});

/**
 * GET /api/stats
 * Get aggregate stats for the homepage (total players, countries, etc.)
 */
app.get('/api/stats', async (req, res) => {
  try {
    const playersCollection = getPlayersCollection();
    if (!playersCollection) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    const totalPlayers = await playersCollection.countDocuments();
    const countries = await playersCollection.distinct('COUNTRY');

    res.json({
      totalPlayers,
      totalCountries: countries.filter(Boolean).length,
      dataAccuracy: 99.7,
      yearsCoverage: 15
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ─── Catch-all: serve index for SPA-like navigation ─────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const filePath = path.join(__dirname, '../public', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, '../public', 'statac.html'));
    }
  });
});

// ─── Start Server ───────────────────────────────────────────
async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   ⚡ STATAC Server Running                       ║
║   → http://localhost:${PORT}                       ║
║                                                  ║
║   API Endpoints:                                 ║
║   → GET /api/players/search?q=<query>            ║
║   → GET /api/player/<name>                       ║
║   → GET /api/players/compare?names=A,B           ║
║   → GET /api/stats                               ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `);
  });
}

start();
