const { body, param, query, validationResult } = require('express-validator');

// Central validation error handler
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Sanitize error messages - never expose internal details
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

// ===== AUTH VALIDATION =====
const validateRegister = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must be 8+ chars with uppercase, lowercase, and number'),
  body('name').trim().isLength({ min: 2, max: 50 }).matches(/^[a-zA-Z\s]+$/).withMessage('Name must be 2-50 letters'),
  handleValidation
];

const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
  handleValidation
];

// ===== DEVICE VALIDATION =====
const validateDevice = [
  body('deviceName').trim().isLength({ min: 1, max: 100 }).escape().withMessage('Device name required'),
  body('macAddress').matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).withMessage('Invalid MAC address'),
  handleValidation
];

// ===== ALERT VALIDATION =====
const validateAlert = [
  body('severity').isIn(['SAFE', 'CAUTION', 'WARNING', 'CRITICAL', 'EMERGENCY']).withMessage('Invalid severity level'),
  body('message').trim().isLength({ min: 1, max: 500 }).escape().withMessage('Message required'),
  handleValidation
];

// ===== COMMAND VALIDATION =====
const validateCommand = [
  body('command').trim().isLength({ min: 1, max: 50 }).matches(/^[A-Z_]+$/).withMessage('Invalid command format'),
  body('value').optional().isLength({ max: 100 }).escape().withMessage('Value too long'),
  handleValidation
];

// ===== QUERY VALIDATION =====
const validateBatteryQuery = [
  query('batteryId').optional().isLength({ min: 1, max: 50 }).matches(/^[a-zA-Z0-9_-]+$/).withMessage('Invalid batteryId'),
  query('minutes').optional().isInt({ min: 1, max: 1440 }).withMessage('Minutes must be 1-1440'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be 1-1000'),
  handleValidation
];

module.exports = {
  handleValidation,
  validateTelemetry,
  validateRegister,
  validateLogin,
  validateDevice,
  validateAlert,
  validateCommand,
  validateBatteryQuery
};
