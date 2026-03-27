const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'statac_super_secret_key_2026';

module.exports = function(dbPromise) {
  const router = express.Router();

  // Helper to ensure db is ready before route executes
  const getDb = async () => {
    const db = await dbPromise;
    if (!db) throw new Error('Database not connected');
    return db;
  };

  /**
   * POST /api/auth/register
   * Register a new user
   */
  router.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const db = await getDb();
      const usersCollection = db.collection('users');

      // Check if user already exists
      const existingUser = await usersCollection.findOne({ 
        $or: [{ email }, { username }] 
      });

      if (existingUser) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const newUser = {
        username,
        email,
        password: hashedPassword,
        createdAt: new Date(),
        role: 'user'
      };

      const result = await usersCollection.insertOne(newUser);

      // Create JWT
      const token = jwt.sign(
        { id: result.insertedId, username: newUser.username, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: { id: result.insertedId, username: newUser.username, role: newUser.role }
      });
    } catch (err) {
      console.error('Registration Error:', err);
      res.status(500).json({ error: 'Server error during registration' });
    }
  });

  /**
   * POST /api/auth/login
   * Authenticate a user and return JWT
   */
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const db = await getDb();
      const usersCollection = db.collection('users');

      // Find user
      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Create JWT
      const token = jwt.sign(
        { id: user._id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: { id: user._id, username: user.username, role: user.role }
      });
    } catch (err) {
      console.error('Login Error:', err);
      res.status(500).json({ error: 'Server error during login' });
    }
  });

  /**
   * GET /api/auth/me
   * Verify token and get current user
   */
  router.get('/me', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const db = await getDb();
      const user = await db.collection('users').findOne(
        { username: decoded.username },
        { projection: { password: 0 } }
      );

      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json({ user });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  return router;
};
