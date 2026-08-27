const { body, param, query, validationResult } = require('express-validator');

// Central validation error handler
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const safeErrors = errors.array().map(e => ({
      field: e.path,
      message: e.msg
    }));
    return res.status(400).json({ error: 'Validation failed', details: safeErrors });
  }
  next();
}

// ===== TELEMETRY VALIDATION =====
const validateTelemetry = [
  body('voltage').optional().isFloat({ min: 0, max: 50 }).withMessage('Voltage must be 0-50V'),
  body('current').optional().isFloat({ min: -100, max: 100 }).withMessage('Current must be -100 to 100A'),
  body('temperature').optional().isFloat({ min: -40, max: 85 }).withMessage('Temperature must be -40 to 85C'),
  body('humidity').optional().isFloat({ min: 0, max: 100 }).withMessage('Humidity must be 0-100%'),
  body('soc').optional().isFloat({ min: 0, max: 100 }).withMessage('SOC must be 0-100%'),
  body('batteryId').optional().isLength({ min: 1, max: 50 }).matches(/^[a-zA-Z0-9_-]+$/).withMessage('Invalid batteryId format'),
  handleValidation
];

// ===== COMMAND VALIDATION =====
const validateCommand = [
  body('command').trim().isLength({ min: 1, max: 50 }).matches(/^[A-Z_]+$/).withMessage('Invalid command format'),
  body('value').optional().isLength({ max: 100 }).escape().withMessage('Value too long'),
  handleValidation
];

module.exports = {
  handleValidation,
  validateTelemetry,
  validateCommand
};
