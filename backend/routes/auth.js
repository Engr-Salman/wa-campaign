const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db/database');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

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
    if (!existing.is_verified) {
      const code = db.resendVerification(email);
      try {
        await sendVerificationEmail(existing.email, existing.name, code);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(409).json({
        error: 'Email already registered but not verified',
        needsVerification: true,
        email: existing.email,
      });
    }

    return res.status(409).json({ error: 'Email already registered' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { id, verification_code } = db.createUser(email, hash, name);
    await sendVerificationEmail(email, name, verification_code);

    res.json({
      message: 'Registration successful. Please verify your email.',
      email,
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
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const user = db.getUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_verified) return res.status(400).json({ error: 'Already verified' });

  const code = db.resendVerification(email);
  try {
    await sendVerificationEmail(user.email, user.name, code);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Verification code resent' });
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const reset = db.createPasswordReset(email);
  if (!reset) {
    return res.json({
      message: 'If an account exists for that email, a reset code has been sent.',
    });
  }

  try {
    await sendPasswordResetEmail(reset.user.email, reset.user.name, reset.code);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    message: 'If an account exists for that email, a reset code has been sent.',
  });
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { email, code, password } = req.body;

  if (!email || !code || !password) {
    return res.status(400).json({ error: 'Email, reset code, and new password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = db.resetPassword(email, code, hash);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
