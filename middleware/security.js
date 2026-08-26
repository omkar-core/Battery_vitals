// Global security middleware stack

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cors = require('cors');
const { logAccess, detectSuspicious, logSecurity } = require('./logger');

function setupSecurity(app) {
  // ===== HELMET: Secure HTTP headers =====
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
  }));

  // ===== CORS: Restrict origins =====
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:5000'];

  app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, ESP32)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400
  }));

  // ===== BODY PARSING with size limits =====
  const express = require('express');
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // ===== MONGO SANITIZE: Prevent NoSQL injection =====
  app.use(mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
      logSecurity('NOSQL_INJECTION_BLOCKED', { ip: req.ip, path: req.originalUrl, key });
    }
  }));

  // ===== HPP: Prevent HTTP parameter pollution =====
  app.use(hpp());

  // ===== ACCESS LOGGING =====
  app.use(logAccess);

  // ===== SUSPICIOUS PATTERN DETECTION =====
  app.use((req, res, next) => {
    const threats = detectSuspicious(req);
    if (threats.length > 0) {
      logSecurity('THREAT_DETECTED', {
        ip: req.ip,
        path: req.originalUrl,
        threats,
        userAgent: req.get('user-agent')
      });
      return res.status(403).json({ error: 'Request blocked by security policy.' });
    }
    next();
  });

  // ===== DISABLE X-Powered-By =====
  app.disable('x-powered-by');

  // ===== SECURITY HEADERS =====
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
}

module.exports = { setupSecurity };
