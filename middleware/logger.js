// Security Logger - tracks suspicious activity
// Serverless-safe: never crashes on filesystem errors

function getTimestamp() {
  return new Date().toISOString();
}

function logSecurity(type, details) {
  const entry = `[${getTimestamp()}] [SECURITY] [${type}] ${JSON.stringify(details)}`;
  console.error(entry);
}

function logAccess(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${getTimestamp()}] [${req.method}] ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
}

function detectSuspicious(req) {
  const suspicious = [];
  try {
    const bodyStr = JSON.stringify(req.body || {});
    const urlStr = req.originalUrl || '';
    const queryStr = JSON.stringify(req.query || {});

    if (/\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b/i.test(urlStr) || /\b(OR|AND)\b\s+\d+\s*=\s*\d+/i.test(bodyStr)) {
      suspicious.push('SQL_INJECTION_ATTEMPT');
    }
    if (/\$where|\$gt|\$ne|\$regex|\$exists|\$in/i.test(bodyStr) || /\$where|\$gt|\$ne|\$regex|\$exists|\$in/i.test(queryStr)) {
      suspicious.push('NOSQL_INJECTION_ATTEMPT');
    }
    if (/\.\.\//.test(urlStr) || /\.\.\\/.test(urlStr)) {
      suspicious.push('PATH_TRAVERSAL');
    }
    if (/<script|javascript:|onerror=|onload=/i.test(bodyStr) || /<script|javascript:|onerror=|onload=/i.test(urlStr)) {
      suspicious.push('XSS_ATTEMPT');
    }
  } catch (e) {
    // JSON.stringify or other parsing failed — not suspicious, just malformed
  }
  return suspicious;
}

module.exports = {
  logSecurity,
  logAccess,
  detectSuspicious
};
