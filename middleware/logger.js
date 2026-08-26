// Security Logger - tracks suspicious activity
// Never logs sensitive data (passwords, tokens, keys)

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const SECURITY_LOG = path.join(LOG_DIR, 'security.log');
const ACCESS_LOG = path.join(LOG_DIR, 'access.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString();
}

// Log security events (failed auth, suspicious requests, etc.)
function logSecurity(type, details) {
  const entry = `[${getTimestamp()}] [SECURITY] [${type}] ${JSON.stringify(details)}\n`;
  fs.appendFileSync(SECURITY_LOG, entry);
  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('\x1b[31m' + entry.trim() + '\x1b[0m');
  }
}

// Log access events (successful requests)
function logAccess(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const entry = `[${getTimestamp()}] [${req.method}] ${req.originalUrl} ${res.statusCode} ${duration}ms ${req.ip}\n`;
    fs.appendFileSync(ACCESS_LOG, entry);
  });
  next();
}

// Track failed attempts per IP
const failedAttempts = new Map();

function trackFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, firstAttempt: now };
  
  // Reset after 15 minutes
  if (now - record.firstAttempt > 15 * 60 * 1000) {
    record.count = 1;
    record.firstAttempt = now;
  } else {
    record.count++;
  }
  
  failedAttempts.set(ip, record);
  
  // Alert if too many failures
  if (record.count >= 5) {
    logSecurity('BRUTE_FORCE', { ip, attempts: record.count });
  }
  
  return record.count;
}

function resetFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

// Cleanup old records every hour
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [ip, record] of failedAttempts.entries()) {
    if (record.firstAttempt < cutoff) {
      failedAttempts.delete(ip);
    }
  }
}, 60 * 60 * 1000);

// Suspicious pattern detection
function detectSuspicious(req) {
  const suspicious = [];
  
  // SQL injection patterns
  const sqlPatterns = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)|(--)|(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i;
  if (sqlPatterns.test(req.originalUrl) || sqlPatterns.test(JSON.stringify(req.body))) {
    suspicious.push('SQL_INJECTION_ATTEMPT');
  }
  
  // NoSQL injection patterns
  const nosqlPatterns = /\$where|\$gt|\$ne|\$regex|\$exists|\$in/i;
  if (nosqlPatterns.test(JSON.stringify(req.body)) || nosqlPatterns.test(JSON.stringify(req.query))) {
    suspicious.push('NOSQL_INJECTION_ATTEMPT');
  }
  
  // Path traversal
  if (/\.\.\//.test(req.originalUrl) || /\.\.\\/.test(req.originalUrl)) {
    suspicious.push('PATH_TRAVERSAL');
  }
  
  // Command injection
  const cmdPatterns = /[;&|`$(){}]/;
  if (cmdPatterns.test(req.originalUrl)) {
    suspicious.push('COMMAND_INJECTION');
  }
  
  // XSS patterns
  const xssPatterns = /<script|javascript:|onerror=|onload=/i;
  if (xssPatterns.test(JSON.stringify(req.body)) || xssPatterns.test(req.originalUrl)) {
    suspicious.push('XSS_ATTEMPT');
  }
  
  return suspicious;
}

module.exports = {
  logSecurity,
  logAccess,
  trackFailedAttempt,
  resetFailedAttempts,
  detectSuspicious
};
