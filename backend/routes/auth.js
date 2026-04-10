const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db/database');
const { generateToken, authMiddleware } = require('../middleware/auth');

// Register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { id, verification_code } = db.createUser(email, hash, name);

    // In production, send email with verification code
    // For now, log it and also return it in the response
    console.log(`Verification code for ${email}: ${verification_code}`);

    res.json({
      message: 'Registration successful. Please verify your email.',
      email,
      // Include code in response for development/testing
      verification_code,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify email
router.post('/verify', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and verification code required' });
  }

  const result = db.verifyUser(email, code);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const user = db.getUserByEmail(email);
  const token = generateToken(user);

  res.json({
    message: 'Email verified successfully',
    token,
    user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin, credits: user.credits },
  });
});

// Resend verification code
router.post('/resend-verification', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = db.getUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_verified) return res.status(400).json({ error: 'Already verified' });

  const code = db.resendVerification(email);
  console.log(`New verification code for ${email}: ${code}`);

  res.json({ message: 'Verification code resent', verification_code: code });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.is_verified) {
    return res.status(403).json({
      error: 'Email not verified',
      needsVerification: true,
      email: user.email,
    });
  }

  db.updateLastLogin(user.id);
  const token = generateToken(user);

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin, credits: user.credits },
  });
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  const user = db.getUserById(req.user.id);
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    is_admin: user.is_admin,
    credits: user.credits,
    created_at: user.created_at,
  });
});

module.exports = router;
