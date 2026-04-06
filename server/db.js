const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/statac';

let db = null;
let playersCollection = null;

const dbPromise = (async () => {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('statac');
    playersCollection = db.collection('players');

    // Create indexes
    await playersCollection.createIndex({ NAME: 'text' });
    await playersCollection.createIndex({ NAME: 1 });
    // Keep users email unique
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    console.log('✅ Connected to MongoDB');
    return db;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return null;
  }
})();

module.exports = {
  dbPromise,
  getDb: () => db,
  getPlayersCollection: () => playersCollection
};
