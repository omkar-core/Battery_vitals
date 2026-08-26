const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateTokens, authenticate, JWT_SECRET } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { logSecurity, trackFailedAttempt, resetFailedAttempts } = require('../middleware/logger');
const jwt = require('jsonwebtoken');

// POST /api/auth/register
router.post('/register', authLimiter, validateRegister, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      logSecurity('REG_DUPLICATE', { email, ip: req.ip });
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create user (password auto-hashed by model pre-save hook)
    const user = new User({ email, password, name, role: 'viewer' });
    await user.save();

    const tokens = generateTokens(user);
    resetFailedAttempts(req.ip);

    logSecurity('USER_REGISTERED', { userId: user._id, email });
    res.status(201).json({
      success: true,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      ...tokens
    });
  } catch (err) {
    logSecurity('REGISTER_ERROR', { error: err.message, ip: req.ip });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      trackFailedAttempt(req.ip);
      logSecurity('LOGIN_USER_NOT_FOUND', { email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      logSecurity('LOGIN_INACTIVE_USER', { email, ip: req.ip });
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      trackFailedAttempt(req.ip);
      logSecurity('LOGIN_FAILED_PASSWORD', { email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const tokens = generateTokens(user);
    resetFailedAttempts(req.ip);

    logSecurity('LOGIN_SUCCESS', { userId: user._id, ip: req.ip });
    res.json({
      success: true,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      ...tokens
    });
  } catch (err) {
    logSecurity('LOGIN_ERROR', { error: err.message, ip: req.ip });
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  logSecurity('LOGOUT', { userId: req.user.id, ip: req.ip });
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
