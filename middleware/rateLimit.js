const rateLimit = require('express-rate-limit');

// General API rate limit: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

// Strict rate limit for auth endpoints: 5 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many login attempts. Account temporarily locked.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// ESP32 data ingestion: 60 requests per minute per device
const deviceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Device sending too much data.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.body?.deviceId || req.ip;
  },
  validate: false
});

// AI analysis endpoint: 10 requests per minute
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'AI analysis rate limit reached. Wait 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Write operations: 30 per 15 minutes
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many write operations.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  authLimiter,
  deviceLimiter,
  aiLimiter,
  writeLimiter
};
