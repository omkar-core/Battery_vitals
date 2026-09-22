// src/lib/errors.js

/**
 * Base error class for all application errors
 */
class BatteryVitalError extends Error {
  constructor(
    message,
    code = 'UNKNOWN_ERROR',
    statusCode = 500,
    context = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.requestId = context.requestId || null;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BatteryVitalError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      requestId: this.requestId
    };
  }
  
  log() {
    console.error({
      error: this.toJSON(),
      stack: this.stack,
      context: this.context
    });
  }
}

// ══════════════════════════════════════════════════════
// AUTHENTICATION & AUTHORIZATION ERRORS (4xx)
// ══════════════════════════════════════════════════════

class AuthenticationError extends BatteryVitalError {
  constructor(message = 'Authentication required', context = {}) {
    super(message, 'UNAUTHORIZED', 401, context);
  }
}

class InvalidTokenError extends AuthenticationError {
  constructor(context = {}) {
    super('Invalid or expired authentication token', context);
    this.code = 'INVALID_TOKEN';
  }
}

class TokenExpiredError extends AuthenticationError {
  constructor(expiresAt, context = {}) {
    super('Authentication token has expired', context);
    this.code = 'TOKEN_EXPIRED';
    this.expiresAt = expiresAt;
  }
}

class MissingCredentialsError extends AuthenticationError {
  constructor(missingField, context = {}) {
    super(`Missing required credentials: ${missingField}`, context);
    this.code = 'MISSING_CREDENTIALS';
    this.missingField = missingField;
  }
}

class PermissionError extends BatteryVitalError {
  constructor(
    message = 'Insufficient permissions',
    requiredPermission = null,
    userRole = null,
    context = {}
  ) {
    super(message, 'FORBIDDEN', 403, context);
    this.requiredPermission = requiredPermission;
    this.userRole = userRole;
  }
}

class RoleRestrictionError extends PermissionError {
  constructor(requiredRole, userRole, context = {}) {
    super(
      `This action requires ${requiredRole} role`,
      requiredRole,
      userRole,
      context
    );
    this.code = 'ROLE_RESTRICTED';
    this.requiredRole = requiredRole;
  }
}

class HardwareSafetyError extends BatteryVitalError {
  constructor(
    reason = 'Hardware safety constraint violated',
    constraint = null,
    currentValue = null,
    safeRange = null,
    context = {}
  ) {
    super(reason, 'HARDWARE_SAFETY_ERROR', 403, context);
    this.constraint = constraint;
    this.currentValue = currentValue;
    this.safeRange = safeRange;
  }
}

class CriticalStateLockError extends HardwareSafetyError {
  constructor(batteryStatus, attemptedAction, context = {}) {
    super(
      `Cannot perform "${attemptedAction}" while battery is in ${batteryStatus} state`,
      'CRITICAL_STATE_LOCK',
      batteryStatus,
      null,
      context
    );
    this.code = 'CRITICAL_STATE_LOCK';
    this.batteryStatus = batteryStatus;
    this.attemptedAction = attemptedAction;
  }
}

// ══════════════════════════════════════════════════════
// VALIDATION ERRORS (400)
// ══════════════════════════════════════════════════════

class ValidationError extends BatteryVitalError {
  constructor(message, field = null, value = null, context = {}) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.field = field;
    this.value = value;
  }
}

class InputOutOfRangeError extends ValidationError {
  constructor(fieldName, value, min, max, context = {}) {
    const message = `${fieldName} must be between ${min} and ${max} (received: ${value})`;
    super(message, fieldName, value, context);
    this.code = 'OUT_OF_RANGE';
    this.min = min;
    this.max = max;
  }
}

class InvalidFormatError extends ValidationError {
  constructor(fieldName, expectedFormat, receivedValue, context = {}) {
    const message = `${fieldName} has invalid format. Expected: ${expectedFormat}, Received: ${receivedValue}`;
    super(message, fieldName, receivedValue, context);
    this.code = 'INVALID_FORMAT';
    this.expectedFormat = expectedFormat;
  }
}

class InvalidDeviceIdError extends InvalidFormatError {
  constructor(deviceId, context = {}) {
    super('Device ID', '[A-Z0-9]{3,10}', deviceId, context);
    this.code = 'INVALID_DEVICE_ID';
  }
}

class DuplicateEntryError extends ValidationError {
  constructor(fieldName, value, context = {}) {
    super(`${fieldName} "${value}" already exists`, fieldName, value, context);
    this.code = 'DUPLICATE_ENTRY';
  }
}

class RequiredFieldMissingError extends ValidationError {
  constructor(fieldName, context = {}) {
    super(`Required field missing: ${fieldName}`, fieldName, null, context);
    this.code = 'REQUIRED_FIELD_MISSING';
  }
}

// ══════════════════════════════════════════════════════
// RESOURCE NOT FOUND (404)
// ══════════════════════════════════════════════════════

class NotFoundError extends BatteryVitalError {
  constructor(resource = 'Resource', identifier = null, context = {}) {
    const message = identifier 
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, context);
    this.resource = resource;
    this.identifier = identifier;
  }
}

class DeviceNotFoundError extends NotFoundError {
  constructor(deviceId, context = {}) {
    super('Device', deviceId, context);
    this.code = 'DEVICE_NOT_FOUND';
    this.deviceId = deviceId;
  }
}

class UserNotFoundError extends NotFoundError {
  constructor(userId, context = {}) {
    super('User', userId, context);
    this.code = 'USER_NOT_FOUND';
    this.userId = userId;
  }
}

class AlertNotFoundError extends NotFoundError {
  constructor(alertId, context = {}) {
    super('Alert', alertId, context);
    this.code = 'ALERT_NOT_FOUND';
    this.alertId = alertId;
  }
}

class TelemetryNotFoundError extends NotFoundError {
  constructor(deviceId, timeRange, context = {}) {
    super('Telemetry', `${deviceId} (${timeRange})`, context);
    this.code = 'TELEMETRY_NOT_FOUND';
    this.deviceId = deviceId;
    this.timeRange = timeRange;
  }
}

// ══════════════════════════════════════════════════════
// RATE LIMITING (429)
// ══════════════════════════════════════════════════════

class RateLimitError extends BatteryVitalError {
  constructor(
    limit,
    window,
    resetAt,
    endpoint = null,
    context = {}
  ) {
    const message = `Rate limit exceeded: ${limit} requests per ${window}ms`;
    super(message, 'RATE_LIMIT_EXCEEDED', 429, context);
    this.limit = limit;
    this.window = window;
    this.resetAt = resetAt;
    this.retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    this.endpoint = endpoint;
  }
}

class AIAnalysisRateLimitError extends RateLimitError {
  constructor(resetAt, context = {}) {
    super(60, 60000, resetAt, '/api/analyze', context);
    this.code = 'AI_RATE_LIMIT';
  }
}

class ControlCommandRateLimitError extends RateLimitError {
  constructor(resetAt, context = {}) {
    super(120, 60000, resetAt, '/api/control/*', context);
    this.code = 'CONTROL_RATE_LIMIT';
  }
}

class ExportRateLimitError extends RateLimitError {
  constructor(resetAt, context = {}) {
    super(10, 3600000, resetAt, '/api/export', context);
    this.code = 'EXPORT_RATE_LIMIT';
  }
}

// ══════════════════════════════════════════════════════
// DATABASE ERRORS (5xx)
// ══════════════════════════════════════════════════════

class DatabaseError extends BatteryVitalError {
  constructor(
    message = 'Database operation failed',
    database = null,
    operation = null,
    context = {}
  ) {
    super(message, 'DATABASE_ERROR', 500, context);
    this.database = database;
    this.operation = operation;
  }
}

class MongoDBError extends DatabaseError {
  constructor(message, operation, mongoError, context = {}) {
    super(message, 'MongoDB', operation, context);
    this.code = 'MONGODB_ERROR';
    this.mongoError = mongoError;
  }
}

class MongoDBConnectionError extends MongoDBError {
  constructor(host, port, mongoError, context = {}) {
    super(
      `Failed to connect to MongoDB at ${host}:${port}`,
      'connect',
      mongoError,
      context
    );
    this.code = 'MONGODB_CONNECTION_ERROR';
    this.host = host;
    this.port = port;
  }
}

class MongoDBQueryError extends MongoDBError {
  constructor(collection, query, mongoError, context = {}) {
    super(
      `MongoDB query failed on "${collection}" collection`,
      'query',
      mongoError,
      context
    );
    this.code = 'MONGODB_QUERY_ERROR';
    this.collection = collection;
    this.query = query;
  }
}

class FirebaseError extends DatabaseError {
  constructor(message, operation, firebaseError, context = {}) {
    super(message, 'Firebase', operation, context);
    this.code = 'FIREBASE_ERROR';
    this.firebaseError = firebaseError;
  }
}

class FirebaseRTDBError extends FirebaseError {
  constructor(path, firebaseError, context = {}) {
    super(
      `Firebase RTDB operation failed on path: ${path}`,
      'rtdb_operation',
      firebaseError,
      context
    );
    this.code = 'FIREBASE_RTDB_ERROR';
    this.path = path;
  }
}

// ══════════════════════════════════════════════════════
// EXTERNAL SERVICE ERRORS (503)
// ══════════════════════════════════════════════════════

class ExternalServiceError extends BatteryVitalError {
  constructor(
    service,
    message = null,
    statusCode = 503,
    context = {}
  ) {
    super(
      message || `${service} is temporarily unavailable`,
      'SERVICE_UNAVAILABLE',
      statusCode,
      context
    );
    this.service = service;
  }
}

class GeminiAIError extends ExternalServiceError {
  constructor(message = null, geminiError = null, context = {}) {
    super(
      'Gemini AI',
      message || 'AI service temporarily unavailable',
      503,
      context
    );
    this.code = 'GEMINI_AI_ERROR';
    this.geminiError = geminiError;
  }
}

class GeminiTimeoutError extends GeminiAIError {
  constructor(timeoutMs, context = {}) {
    super(
      `AI analysis timed out after ${timeoutMs}ms`,
      null,
      context
    );
    this.code = 'GEMINI_TIMEOUT';
    this.timeoutMs = timeoutMs;
  }
}

class GeminiRateLimitError extends GeminiAIError {
  constructor(resetAt, context = {}) {
    super('Gemini API rate limit exceeded', null, context);
    this.code = 'GEMINI_RATE_LIMIT';
    this.resetAt = resetAt;
    this.retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  }
}

class GeminiInvalidResponseError extends GeminiAIError {
  constructor(response, context = {}) {
    super(
      'Gemini returned invalid response format',
      null,
      context
    );
    this.code = 'GEMINI_INVALID_RESPONSE';
    this.response = response;
  }
}

class NetworkError extends ExternalServiceError {
  constructor(message, cause, context = {}) {
    super('Network', message, 503, context);
    this.code = 'NETWORK_ERROR';
    this.cause = cause;
  }
}

class ConnectionTimeoutError extends NetworkError {
  constructor(host, timeoutMs, context = {}) {
    super(
      `Connection to ${host} timed out after ${timeoutMs}ms`,
      'ETIMEDOUT',
      context
    );
    this.code = 'CONNECTION_TIMEOUT';
    this.host = host;
    this.timeoutMs = timeoutMs;
  }
}

// ══════════════════════════════════════════════════════
// HARDWARE ERRORS (5xx)
// ══════════════════════════════════════════════════════

class HardwareError extends BatteryVitalError {
  constructor(
    message,
    deviceId = null,
    hardwareComponent = null,
    context = {}
  ) {
    super(message, 'HARDWARE_ERROR', 500, context);
    this.deviceId = deviceId;
    this.hardwareComponent = hardwareComponent;
  }
}

class SensorReadError extends HardwareError {
  constructor(deviceId, sensorType, context = {}) {
    super(
      `Failed to read ${sensorType} sensor on device ${deviceId}`,
      deviceId,
      sensorType,
      context
    );
    this.code = 'SENSOR_READ_ERROR';
    this.sensorType = sensorType;
  }
}

class DeviceOfflineError extends HardwareError {
  constructor(deviceId, lastSeen, context = {}) {
    const message = lastSeen
      ? `Device ${deviceId} offline since ${new Date(lastSeen).toISOString()}`
      : `Device ${deviceId} is offline`;
    
    super(message, deviceId, 'device', context);
    this.code = 'DEVICE_OFFLINE';
    this.lastSeen = lastSeen;
  }
}

class CommandExecutionError extends HardwareError {
  constructor(deviceId, command, reason, context = {}) {
    super(
      `Failed to execute command "${command}" on device ${deviceId}: ${reason}`,
      deviceId,
      'command_executor',
      context
    );
    this.code = 'COMMAND_EXECUTION_ERROR';
    this.command = command;
    this.reason = reason;
  }
}

class CommandTimeoutError extends CommandExecutionError {
  constructor(deviceId, command, timeoutMs, context = {}) {
    super(
      deviceId,
      command,
      `Command timed out after ${timeoutMs}ms`,
      context
    );
    this.code = 'COMMAND_TIMEOUT';
    this.timeoutMs = timeoutMs;
  }
}

// ══════════════════════════════════════════════════════
// BUSINESS LOGIC ERRORS (4xx-5xx)
// ══════════════════════════════════════════════════════

class BusinessLogicError extends BatteryVitalError {
  constructor(message, code, statusCode = 400, context = {}) {
    super(message, code, statusCode, context);
  }
}

class InvalidBatteryStateError extends BusinessLogicError {
  constructor(batteryState, operation, context = {}) {
    super(
      `Cannot perform "${operation}" on battery in ${batteryState} state`,
      'INVALID_BATTERY_STATE',
      409,
      context
    );
    this.batteryState = batteryState;
    this.operation = operation;
  }
}

class InsufficientDataError extends BusinessLogicError {
  constructor(requiredData, availableData, context = {}) {
    super(
      `Insufficient data for operation. Required: ${requiredData}, Available: ${availableData}`,
      'INSUFFICIENT_DATA',
      422,
      context
    );
    this.requiredData = requiredData;
    this.availableData = availableData;
  }
}

export {
  BatteryVitalError,
  AuthenticationError,
  InvalidTokenError,
  TokenExpiredError,
  MissingCredentialsError,
  PermissionError,
  RoleRestrictionError,
  HardwareSafetyError,
  CriticalStateLockError,
  ValidationError,
  InputOutOfRangeError,
  InvalidFormatError,
  InvalidDeviceIdError,
  DuplicateEntryError,
  RequiredFieldMissingError,
  NotFoundError,
  DeviceNotFoundError,
  UserNotFoundError,
  AlertNotFoundError,
  TelemetryNotFoundError,
  RateLimitError,
  AIAnalysisRateLimitError,
  ControlCommandRateLimitError,
  ExportRateLimitError,
  DatabaseError,
  MongoDBError,
  MongoDBConnectionError,
  MongoDBQueryError,
  FirebaseError,
  FirebaseRTDBError,
  ExternalServiceError,
  GeminiAIError,
  GeminiTimeoutError,
  GeminiRateLimitError,
  GeminiInvalidResponseError,
  NetworkError,
  ConnectionTimeoutError,
  HardwareError,
  SensorReadError,
  DeviceOfflineError,
  CommandExecutionError,
  CommandTimeoutError,
  BusinessLogicError,
  InvalidBatteryStateError,
  InsufficientDataError,
}