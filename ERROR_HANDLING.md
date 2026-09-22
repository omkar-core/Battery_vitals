# Battery Vital — Comprehensive Error Handling & Recovery (ERROR_HANDLING.md)

## 1. Error Architecture Overview

### 1.1 Error Handling Layers

```
┌─────────────────────────────────────────────────────┐
│                  User Interface                     │
│       (Toast notifications, banner alerts, chimes)  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              React Error Boundary                   │
│       (Catch component rendering exceptions)        │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│           API Error Response Handler                │
│    (Standardized error JSON envelope from server)   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         Next.js API Route Error Catching            │
│       (try-catch in serverless functions)           │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│         Database & External Service Calls           │
│   (Firebase, MongoDB, Gemini with backoff retries)  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│     Hardware Safety Layer (ESP32)                   │
│ (Local circuit breaker, autonomous pin overrides)   │
└─────────────────────────────────────────────────────┘
```

### 1.2 Error Propagation Flow

```
Hardware Sensor Fault / Out-of-Bounds
    ↓
ESP32 Firmware (handles locally, trips RED LED/Buzzer if critical)
    ↓
Firebase RTDB (/live_data/{DEVICE_ID})
    ↓
Web Client (useFirebase WebSocket listener)
    ↓
Component View (updates status chips, shows error toast, plays audio chime)
    ↓
Telemetry sync to MongoDB + error_log audit collection
```

---

## 2. Error Taxonomy & Classification

### 2.1 Complete Error Type Hierarchy

```javascript
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
```

---

## 3. Standardized API Error Handling Pattern

### 3.1 Unified Error Response Handler

```javascript
// src/lib/errorHandler.js

export function handleError(error, request = null, requestId = null) {
  const finalRequestId = requestId || crypto.randomUUID();
  const code = error.code || 'INTERNAL_ERROR';
  const statusCode = error.statusCode || 500;
  
  // Safe client-facing message
  const message = (statusCode >= 500 && process.env.NODE_ENV === 'production')
    ? 'An unexpected error occurred. Please contact support.'
    : error.message;

  console.warn(`[API Error] [${finalRequestId}] ${code}: ${error.message}`);

  const response = {
    success: false,
    error: {
      code,
      message,
      ...(error.field && { field: error.field, value: error.value }),
      ...(error.retryAfter && { retryAfter: error.retryAfter }),
      ...(error.constraint && {
        constraint: error.constraint,
        current: error.currentValue,
        safeRange: error.safeRange
      })
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: finalRequestId
    }
  };

  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      originalMessage: error.message,
      stack: error.stack
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': finalRequestId
  };

  if (error.retryAfter) {
    headers['Retry-After'] = error.retryAfter.toString();
  }

  return Response.json(response, { status: statusCode, headers });
}
```

---

## 4. Exponential Backoff & Circuit Breaker Pattern

### 4.1 Retry with Exponential Backoff and Jitter

```javascript
// src/lib/retry.js

export async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelayMs = 150,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    jitter = true,
    shouldRetry = isRetryable
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      let delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      if (jitter) {
        delayMs *= (0.8 + Math.random() * 0.4);
      }
      delayMs = Math.min(delayMs, maxDelayMs);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export function isRetryable(error) {
  const retryableCodes = [
    'NETWORK_ERROR',
    'CONNECTION_TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'MONGODB_CONNECTION_ERROR',
    'FIREBASE_ERROR',
    'GEMINI_TIMEOUT'
  ];

  return (
    retryableCodes.includes(error.code) ||
    error.statusCode === 503 ||
    error.statusCode === 504 ||
    error.statusCode === 408
  );
}
```

### 4.2 Circuit Breaker Implementation

```javascript
// src/lib/circuitBreaker.js

export class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30000;
    
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  }

  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else if (fallback) {
        return fallback();
      } else {
        throw new Error(`Circuit ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) return fallback();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

---

## 5. Graceful Fallback Strategies

### 5.1 Gemini AI Deterministic Safety Fallback
When Gemini 1.5 is unavailable due to rate limits (HTTP 429), timeouts, or network disconnection:
1. System automatically invokes the deterministic rule engine [`src/lib/batterySafety.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/batterySafety.js).
2. Calculates deterministic `safety_score` (0–100) and `risk_level` (`SAFE`, `CAUTION`, `WARNING`, `CRITICAL`, `EMERGENCY`).
3. Generates grounded recommendations based on measured sensor bounds.
4. Returns payload with metadata tag `fallback_used: true`, ensuring uninterrupted dashboard diagnostics.

### 5.2 MongoDB Atlas In-Memory Fallback
If MongoDB Atlas encounters connection pool exhaustion or network partition:
1. User sessions and permissions fall back to [`src/lib/auth.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/auth.js) in-memory store.
2. Alert definitions and history fall back to Firebase Realtime Database rolling cache (`/live_data/BAT001`).
3. Dashboard continues streaming live telemetry with zero interruption.

### 5.3 Error Handler Coverage
All API route catch blocks now use `handleError(error, request)` from `src/lib/errorHandler.js` for structured error responses with `requestId` tracking. Routes must never return `error.message` directly in JSON responses — the error handler masks internal details in production.
