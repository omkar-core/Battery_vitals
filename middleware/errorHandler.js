// Central error handler - never expose internal details

const { logSecurity } = require('./logger');

function errorHandler(err, req, res, next) {
  // Log error internally
  logSecurity('SERVER_ERROR', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Determine status code
  let statusCode = err.statusCode || 500;
  let message = 'Internal server error';

  // Safe error messages for known error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  }

  // Never send stack trace to client in production
  const response = {
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message })
  };

  res.status(statusCode).json(response);
}

// 404 handler
function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint not found' });
}

module.exports = { errorHandler, notFound };
