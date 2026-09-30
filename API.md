# Battery Vital — Complete REST & Streaming API Reference (API.md)

## 1. API Architecture & Standards

### 1.1 Base URLs
- **Local Development**: `http://localhost:3000/api`
- **Production (Vercel)**: `https://battery-vital.vercel.app/api`
- **Container Service (Render)**: `https://battery-vital.onrender.com/api`

### 1.2 Communication Protocols
- **HTTP REST**: Standard JSON over HTTPS for queries, configuration, authentication, and manual control dispatches.
- **WebSocket Streaming**: Sub-second full-duplex telemetry and push notification updates via Firebase Realtime Database.
- **Server-Sent Events (SSE)**: Streaming tokens for real-time generative AI diagnostic summaries (`/api/analyze/stream`).

### 1.3 Authentication & Headers
All protected API endpoints require a Firebase Auth JSON Web Token (JWT) provided in the HTTP `Authorization` header:
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
X-Device-ID: BAT001
```

### 1.4 Standardized Response Envelopes

#### Successful Response Format
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2024-06-10T14:30:05.120Z",
    "requestId": "req_8f1d3c0593"
  }
}
```

#### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Voltage must be between 0.5V and 100.0V",
    "field": "voltage",
    "receivedValue": -2.4
  },
  "metadata": {
    "timestamp": "2024-06-10T14:30:05.125Z",
    "requestId": "req_8f1d3c0593"
  }
}
```

---

## 2. Core Telemetry Endpoints

### 2.1 GET `/api/health`
System liveness and readiness probe checking connectivity to Firebase RTDB, MongoDB Atlas, and AI provider status (quotas, daily caps, circuit breakers).

- **Access Tier**: Public
- **Rate Limit**: 60 requests / 60 seconds
- **Response (200 OK)**:
```json
{
  "status": "healthy",
  "database": "connected",
  "firebase": "connected",
  "ai": {
    "status": "healthy",
    "primary": "gemini-1.5-flash",
    "active": "gemini",
    "usedToday": 42,
    "dailyCap": 1400,
    "quotaRemaining": 1358,
    "breakerOpen": false
  },
  "timestamp": "2026-09-22T17:50:00.000Z",
  "uptime": 86420,
  "platform": "vercel"
}
```

---

### 2.2 GET `/api/status`
Inspects real-time edge node connection status, measuring telemetry packet gap and age against the 1.5s transmission cadence.

- **Access Tier**: Public
- **Rate Limit**: 60 requests / 60 seconds
- **Query Parameters**:
  - `batteryId` (string, optional, default: `BAT001`): Node identifier.
- **Response (200 OK)**:
```json
{
  "ts": 1758544200000,
  "firebase": { "configured": true, "connected": true, "error": null },
  "mongodb": { "configured": true, "connected": true, "error": null },
  "gemini": { "configured": true, "active": true },
  "esp32": {
    "connected": true,
    "online": true,
    "status": "ONLINE",
    "lastSeen": 1758544198500,
    "lastSeenIso": "2026-09-22T17:49:58.500Z",
    "ageSeconds": 1,
    "hasData": true
  }
}
```
> Note: Telemetry transmission interval is 1.5s. If `ageSeconds > 4` (2× cadence plus network jitter), `online` evaluates to `false` and `status` reports `"OFFLINE"`.

---

### 2.3 GET `/api/telemetry`
Fetches the latest consolidated multi-sensor telemetry frame for a given device.

- **Access Tier**: `viewer`, `operator`, `admin`
- **Query Parameters**:
  - `deviceId` (string, optional, default: `BAT001`): Unique identifier of the battery monitor node.
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "deviceId": "BAT001",
    "timestamp": 1758544200000,
    "battery": {
      "voltage": 3.82,
      "current": 0.0082,
      "power": 0.0313,
      "shuntVoltage": 0.0008,
      "resistance": null,
      "resistanceMeasurable": false,
      "soc": 62,
      "socMethod": "empirical_ocv",
      "soh": 98,
      "bhi": 92
    },
    "inferredBattery": {
      "cellType": "18650 Li-Ion",
      "chemistry": "Li-Ion",
      "nominalVoltage": 3.7,
      "capacityAh": 2.5,
      "confidence": "HIGH",
      "inferred": true
    },
    "remainingRuntime": {
      "remainingHours": 189.0,
      "display": "189.0 hrs",
      "method": "load_current",
      "currentA": 0.0082
    },
    "environmental": {
      "temperature": 26.4,
      "humidity": 52.0,
      "heatIndex": 26.8,
      "dewPoint": 15.6,
      "mq2": 320,
      "mq135": 110,
      "aqi": 38
    },
    "hardware": {
      "led_green": true,
      "led_yellow": false,
      "led_red": false,
      "buzzer": false,
      "wifi_rssi": -62,
      "heap_free": 238410
    },
    "self_test": {
      "passed": true,
      "ina_ack": true,
      "dht_ok": true,
      "mq2_ok": true,
      "mq135_ok": true,
      "gpio_ok": true,
      "buzzer_ok": true,
      "wifi_ok": true,
      "config_ok": true
    },
    "calibration": {
      "zero_current_offset": 0.012,
      "calibrated_at": 1758540000000
    },
    "sensor_confidence": {
      "inaConfidence": 1.0,
      "dhtConfidence": 1.0,
      "mqConfidence": 1.0,
      "overallConfidence": 1.0
    },
    "safety": "SAFE"
  }
}
```

---

### 2.4 POST `/api/telemetry`
Direct sensor packet ingest endpoint for HTTP-capable edge nodes or telemetry forwarders. Validates edge device token against `DEVICE_AUTH_TOKEN` when configured.

- **Access Tier**: Hardware Node (`X-Device-Token` header or `device_token` field) / `admin`
- **Rate Limit**: 300 requests / 60 seconds
- **Request Body**:
```json
{
  "deviceId": "BAT001",
  "device_token": "secret_edge_token_12345",
  "voltage": 12.64,
  "current": 2.45,
  "temperature": 26.4,
  "humidity": 52.0,
  "mq2": 320,
  "mq135": 110,
  "self_test": {
    "ina_ack": true,
    "dht_ok": true,
    "mq2_ok": true,
    "mq135_ok": true,
    "gpio_ok": true,
    "buzzer_ok": true,
    "wifi_ok": true,
    "config_ok": true,
    "passed": true
  },
  "calibration": {
    "zero_current_offset": 0.012
  },
  "sensor_confidence": {
    "inaConfidence": 1.0,
    "dhtConfidence": 1.0,
    "mqConfidence": 1.0,
    "overallConfidence": 1.0
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "insertedId": "66671a5c1a2b3c4d5e6f7a8b",
    "status": "SAFE",
    "sessionId": "b8e1f0e2-63b7-4c7b-9f4a-8d3419bb9c1a"
  }
}
---

## 3. Battery Electrical Endpoints

### 3.1 GET `/api/battery/latest`
Retrieve current INA219 high-precision electrical readings.

- **Query Parameters**: `deviceId`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "busVoltage": 12.64,
    "shuntVoltage": 0.0245,
    "loadVoltage": 12.66,
    "current": 2.45,
    "power": 30.97,
    "timestamp": 1718000000000
  }
}
```

---

### 3.2 GET `/api/battery/history`
Query time-series electrical records from MongoDB Atlas.

- **Query Parameters**:
  - `deviceId` (string, default: `BAT001`)
  - `start` (ISO 8601 string, required)
  - `end` (ISO 8601 string, required)
  - `limit` (integer, max: `5000`, default: `500`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    { "timestamp": "2024-06-10T14:00:00Z", "voltage": 12.80, "current": 1.20, "power": 15.36 },
    { "timestamp": "2024-06-10T14:05:00Z", "voltage": 12.78, "current": 2.10, "power": 26.83 }
  ],
  "count": 2
}
```

---

### 3.3 GET `/api/battery/soc`
Calculates State of Charge using open-circuit voltage interpolation and Coulomb integration.

- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "soc": 84,
    "chemistry": "LiFePO4_4S",
    "estimatedRuntimeMinutes": 185,
    "cellVoltagesEstimate": [3.16, 3.16, 3.16, 3.16]
  }
}
```

---

### 3.4 POST `/api/battery/calibrate`
Dispatches the `CALIBRATE_ZERO` zero-current shunt calibration routine to the edge device. The ESP32 averages 50 shunt readings with no load connected to record the hardware zero-offset and stores it to non-volatile memory and Firebase RTDB.

- **Access Tier**: `operator`, `admin` (`CONTROL_RELAY` / `CONTROL_HARDWARE` permission)
- **Rate Limit**: 10 requests / 60 seconds
- **Request Body**:
```json
{
  "deviceId": "BAT001"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "deviceId": "BAT001",
  "command": "CALIBRATE_ZERO",
  "message": "Zero-current calibration routine dispatched to ESP32.",
  "timestamp": "2026-09-22T17:50:00.000Z"
}
```

---

### 3.5 GET `/api/battery/sessions`
Retrieves the historical battery physical connection sessions, tracking connect/disconnect transitions, durations, and electrical min/max ranges.

- **Access Tier**: `viewer`, `operator`, `admin`
- **Rate Limit**: 60 requests / 60 seconds
- **Query Parameters**:
  - `batteryId` (string, optional, default: `BAT001`): Battery node identifier.
- **Response (200 OK)**:
```json
{
  "success": true,
  "batteryId": "BAT001",
  "totalSessions": 4,
  "sessions": [
    {
      "sessionId": "b8e1f0e2-63b7-4c7b-9f4a-8d3419bb9c1a",
      "batteryId": "BAT001",
      "firstSeen": 1758540000000,
      "lastSeen": 1758544200000,
      "initialVoltage": 12.64,
      "eventCount": 280,
      "lastEventType": "CONNECTED"
    }
  ],
  "rawEventsCount": 100
}
```

---

## 4. Environmental & Atmospheric Endpoints

### 4.1 GET `/api/environmental/latest`
Returns current DHT11, MQ-2, and MQ-135 measurements.

- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "temperature": 26.4,
    "humidity": 52.0,
    "heatIndex": 26.8,
    "dewPoint": 15.6,
    "mq2Raw": 320,
    "mq2Ppm": 410,
    "mq135Raw": 110,
    "aqi": 38,
    "airQualityCategory": "Good"
  }
}
```

---

### 4.2 GET `/api/environmental/air-quality`
Detailed breakdown of atmospheric pollutants and Air Quality Index components.

- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "aqi": 38,
    "category": "Good",
    "dominantPollutant": "CO2_VOC",
    "sensorBaselineR0": 24.5,
    "rsR0Ratio": 1.82
  }
}
```

---

## 5. Actuator Control & Hardware Commands

### 5.1 POST `/api/control/led`
Sets the desired state of a physical LED indicator on the ESP32 node.

- **Access Tier**: `operator`, `admin`
- **Request Body**:
```json
{
  "deviceId": "BAT001",
  "led": "red",
  "state": true
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": { "deviceId": "BAT001", "led": "red", "state": true, "updatedAt": 1718000000000 }
}
```

---

### 5.2 POST `/api/control/buzzer`
Configures the physical active buzzer alarm pattern on GPIO 25.

- **Access Tier**: `operator`, `admin`
- **Request Body**:
```json
{
  "deviceId": "BAT001",
  "mode": "slow_beep"
}
```
> Valid modes: `"off"`, `"slow_beep"`, `"fast_beep"`, `"continuous"`

---

### 5.3 GET `/api/control/status`
Reads the current physical actuator pin states for a given battery device.

- **Access Tier**: `viewer`, `operator`, `admin`
- **Rate Limit**: 120 requests / 60 seconds
- **Query Parameters**: `batteryId` (optional, default: `BAT001`)
- **Response (200 OK)**:
```json
{
  "batteryId": "BAT001",
  "auto_mode": true,
  "led_green": true,
  "led_yellow": false,
  "led_red": false,
  "buzzer": false,
  "buzzer_mode": "off",
  "lastCommandDispatched": "2024-06-10T14:30:05.120Z",
  "lastTelemetryFrame": "2024-06-10T14:30:04.980Z"
}
```

---

## 5.4 GET `/api/users/me`
Retrieves the authenticated user's profile and permissions.

- **Access Tier**: `viewer`, `operator`, `admin` (authenticated)
- **Rate Limit**: 60 requests / 60 seconds
- **Headers**: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
- **Response (200 OK)**:
```json
{
  "user": {
    "id": "usr_abc123",
    "firebaseUid": "firebase-uid-123",
    "name": "Alex Rivera",
    "email": "operator@example.com",
    "role": "operator",
    "title": "Field Operations Specialist",
    "department": "Hardware Telemetry & Maintenance",
    "avatar": "⚡",
    "status": "active",
    "lastActive": "2026-09-27T14:30:00.000Z",
    "createdAt": "2024-01-15T00:00:00.000Z"
  },
  "permissions": [
    "ACCESS_TELEMETRY",
    "CONTROL_HARDWARE",
    "MANAGE_ALERTS",
    "ACCESS_AI"
  ],
  "session": {
    "authenticated": true,
    "role": "operator",
    "loginTime": "2026-09-27T14:30:00.000Z",
    "expiresIn": "1h"
  }
}
```
- **Response (401 Unauthorized)**: Missing or invalid Firebase ID token.

---

## 7. Authentication Endpoints

### 7.1 Architecture Overview

Battery Vital uses **Firebase Auth as the sole identity provider**. The authentication flow is:

1. **Client-side (Firebase SDK)**: User signs up/logs in via `createUserWithEmailAndPassword` / `signInWithEmailAndPassword`. Firebase handles password hashing, rate limiting, and issues a short-lived ID token (1h expiry, auto-refreshed).
2. **Profile creation**: On successful signup, client calls `POST /api/auth/register` with the fresh ID token to create a MongoDB profile keyed by Firebase UID.
3. **Server verification**: All protected routes verify the Firebase ID token via Firebase Admin SDK (`verifyIdToken(token, checkRevoked=true)`), then use the UID to fetch/create the MongoDB profile.

### 7.2 POST `/api/auth/register`
Creates or retrieves the MongoDB profile for the authenticated Firebase user. Idempotent — if a profile already exists for the UID, returns it.

- **Access Tier**: Authenticated (requires valid Firebase ID token)
- **Rate Limit**: 10 requests / 60 seconds
- **Headers**: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
- **Request Body**:
```json
{
  "name": "Alex Rivera",
  "email": "operator@example.com",
  "role": "viewer",
  "title": "Field Operations Specialist",
  "department": "Hardware Telemetry & Maintenance"
}
```
- **Response (201 Created / 200 OK)**:
```json
{
  "success": true,
  "user": {
    "id": "usr_abc123",
    "firebaseUid": "firebase-uid-123",
    "name": "Alex Rivera",
    "email": "operator@example.com",
    "role": "viewer",
    "title": "Field Operations Specialist",
    "department": "Hardware Telemetry & Maintenance",
    "avatar": "👁️",
    "status": "active",
    "lastActive": "2026-09-27T14:30:00.000Z",
    "createdAt": "2026-09-27T14:30:00.000Z"
  }
}
```
- **Response (400 Bad Request)**: Email mismatch with authenticated Firebase user.
- **Response (401 Unauthorized)**: Missing or invalid Firebase ID token.

### 7.3 POST `/api/auth/login`
**DISABLED** — Login is handled client-side via Firebase Auth SDK (`signInWithEmailAndPassword`). The server no longer verifies passwords.

- **Response (410 Gone)**: Instructs client to use Firebase Auth SDK directly.

### 7.4 POST `/api/auth/logout`
Revokes all Firebase refresh tokens for the current user (invalidates all sessions across devices) and clears the client-side session cookie.

- **Access Tier**: Authenticated (requires valid Firebase ID token)
- **Rate Limit**: 30 requests / 60 seconds
- **Headers**: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "revoked": true,
  "message": "Logged out successfully. All sessions revoked."
}
```
- Also clears the `bv_session` cookie.

### 7.5 GET `/api/users/me`
Retrieves the authenticated user's MongoDB profile (role, name, permissions) keyed by Firebase UID. Creates a default viewer profile if one doesn't exist yet.

- **Access Tier**: Authenticated (requires valid Firebase ID token)
- **Rate Limit**: 60 requests / 60 seconds
- **Headers**: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
- **Response (200 OK)**: See `/api/users/me` documentation above.
- **Response (401 Unauthorized)**: Missing or invalid Firebase ID token.

---

## 8. AI Predictive Diagnostics & Analysis

### 8.1 POST `/api/ai/chat`
Interactive conversational AI endpoint for battery safety queries. Maintains multi-session conversation history per battery.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 20 requests / 60 seconds (per user/IP + endpoint)
- **Headers**: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
- **Request Body**:
```json
{
  "batteryId": "BAT001",
  "question": "Why is my battery health decreasing?",
  "conversationId": "conv_abc123"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "answer": "Based on current telemetry...",
  "response": "Based on current telemetry...",
  "batteryId": "BAT001",
  "aiContext": {
    "safetyState": "SAFE",
    "sensorConfidence": 1.0,
    "currentSOH": 89
  }
}
```
- **Response (429 Too Many Requests)**:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
Content-Type: application/json

{
  "error": "Too Many Requests: Rate limit exceeded. Please try again shortly."
}
```

---

### 8.2 GET `/api/ai/chat`
Retrieves the AI context for a battery (deterministic safety state, sensor confidence, current telemetry).

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 20 requests / 60 seconds (per user/IP + endpoint)
- **Query Parameters**: `batteryId` (optional, default: `BAT001`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "batteryId": "BAT001",
  "aiContext": {
    "currentTelemetry": { "voltage": 12.6, "temperature": 26.4, "soh": 89, ... },
    "deterministicSafetyState": { "statusLabel": "SAFE", "activeTrips": [] },
    "sensorConfidence": { "overallConfidence": 1.0, ... },
    "historicalTrends": { ... }
  }
}
```

---

### 8.3 GET `/api/ai/conversations`
Lists all conversation sessions for a battery owned by the authenticated user.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 30 requests / 60 seconds (per user/IP + endpoint)
- **Query Parameters**: `batteryId` (optional, default: `BAT001`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "conversations": [
    {
      "conversationId": "conv_abc123",
      "batteryId": "BAT001",
      "title": "New Discussion",
      "createdAt": "2026-09-27T14:30:00.000Z",
      "updatedAt": "2026-09-27T14:35:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 8.4 POST `/api/ai/conversations`
Creates a new conversation session for a battery.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 30 requests / 60 seconds (per user/IP + endpoint)
- **Request Body**:
```json
{
  "batteryId": "BAT001",
  "title": "New Discussion"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "conversation": {
    "conversationId": "conv_abc123",
    "batteryId": "BAT001",
    "title": "New Discussion",
    "createdAt": "2026-09-27T14:30:00.000Z",
    "updatedAt": "2026-09-27T14:30:00.000Z"
  }
}
```

---

### 8.5 GET `/api/ai/conversations/[id]`
Retrieves a specific conversation with its message history.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 30 requests / 60 seconds (per user/IP + endpoint)
- **Path Parameters**: `id` (conversationId)
- **Response (200 OK)**:
```json
{
  "success": true,
  "conversation": {
    "conversationId": "conv_abc123",
    "batteryId": "BAT001",
    "title": "New Discussion",
    "messages": [
      { "role": "user", "content": "Why is my battery health decreasing?" },
      { "role": "assistant", "content": "Based on current telemetry..." }
    ],
    "createdAt": "2026-09-27T14:30:00.000Z",
    "updatedAt": "2026-09-27T14:35:00.000Z"
  }
}
```

---

### 8.6 GET `/api/ai/health-summary`
Generates or retrieves a cached structured battery health summary with deterministic fingerprinting.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 10 requests / 60 seconds (per user/IP + endpoint)
- **Query Parameters**:
  - `batteryId` (optional, default: `BAT001`)
  - `period` (optional, default: `30d` — `7d`, `30d`, `90d`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "cached": false,
  "summary": {
    "soh": "89%",
    "trend": "Stable",
    "cycles": 142,
    "thermalEvents": 1,
    "protectionEvents": 0,
    "aiInterpretation": "Battery is operating in optimal condition...",
    "batteryId": "BAT001",
    "period": "30d",
    "telemetryFingerprint": "fp_BAT001_89_142_26_SAFE",
    "model": "gemini-1.5-flash",
    "safetyState": "SAFE",
    "generatedAt": "2026-09-27T14:30:00.000Z"
  }
}
```
- **Response (404 Not Found)**: No live sensor telemetry from ESP32.
- **Response (429 Too Many Requests)**: Includes `Retry-After` header with seconds until next allowed request.

---

### 8.7 POST `/api/ai/diagnostic`
Executes a full structured diagnostic pipeline: validation → deterministic safety engine → AI provider cascade (Gemini → OpenRouter → deterministic fallback) → schema validation → MongoDB persistence.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 10 requests / 60 seconds (per user/IP + endpoint)
- **Request Body**:
```json
{
  "batteryId": "BAT001",
  "forced": false
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "id": "66f1a2b3c4d5e6f7a8b9c0d1",
  "source": "gemini",
  "cached": false,
  "model": "gemini-1.5-flash",
  "safety": {
    "overall_status": "SAFE",
    "active_trips": [],
    "risk_score": 8
  },
  "result": {
    "overall_status": "SAFE",
    "risk_score": 8,
    "confidence": 0.92,
    "summary": "Battery is operating within safe parameters...",
    "key_drivers": [
      { "metric": "temperature", "value": 26.4, "threshold": 45, "contribution": "low" }
    ],
    "recommendations": [
      { "priority": "low", "action": "Continue routine monitoring", "reason": "No immediate action required" }
    ],
    "failure_probability": { "30_days": 1, "90_days": 3, "1_year": 8 },
    "provider_used": "gemini"
  },
  "generatedAt": "2026-09-27T14:30:00.000Z"
}
```

---

### 8.8 POST `/api/analyze`
Invokes the Google Gemini 1.5 diagnostics engine over the validated telemetry frame.

- **Access Tier**: `viewer`, `operator`, `admin`
- **Request Body**:
```json
{
  "deviceId": "BAT001",
  "voltage": 12.64,
  "current": 2.45,
  "temperature": 26.4,
  "humidity": 52.0,
  "mq2": 320,
  "mq135": 110
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "overall_status": "SAFE",
    "safety_score": 92,
    "risk_level": "low",
    "summary": "Battery pack is operating inside normal electrical and thermal envelopes.",
    "recommendations": [
      "Operating parameters nominal; continue current 2.45A discharge profile.",
      "Ambient enclosure temperature 26.4°C is optimal for LiFePO4 longevity."
    ],
    "predicted_issues": [],
    "failure_probability": {
      "30_days": 1.2,
      "90_days": 4.5,
      "1_year": 18.0
    }
  },
  "metadata": {
    "model": "gemini-1.5-flash",
    "responseTimeMs": 1120,
    "cached": false
  }
}
```

---

### 8.9 POST `/api/ai/profile-verify`
Vision AI cross-referencing endpoint that inspects an uploaded battery specification sheet or physical label image and verifies it against candidate battery profile fields.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 10 requests / 3,600 seconds (1 hr)
- **Request Body**:
```json
{
  "profile": {
    "chemistry": "LiFePO4",
    "series": 4,
    "nominalVoltage": 12.8,
    "capacityAh": 100
  },
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "mimeType": "image/jpeg"
}
```
- **Response (200 OK)**:
```json
{
  "verdict": "MATCHES",
  "confidence": "HIGH",
  "extracted": {
    "chemistry": "LiFePO4",
    "series": 4,
    "nominalVoltage": 12.8,
    "capacityAh": 100
  },
  "discrepancies": [],
  "reasoning": "Extracted label parameters match configured profile voltage, series count, and chemistry."
}
```
> Note: If any field deviates, is obscured, or cannot be verified, `verdict` evaluates to `"REVIEW REQUIRED"` with itemized `discrepancies`.

---

### 8.10 POST `/api/ai/label-scan`
OCR and multimodal vision inspection endpoint that extracts technical parameters directly from physical battery packaging and rating plates.

- **Access Tier**: `viewer`, `operator`, `admin` (`ACCESS_AI` permission)
- **Rate Limit**: 10 requests / 60 seconds
- **Request Body**:
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "mimeType": "image/jpeg"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "extracted": {
    "chemistry": "LIFEPO4",
    "series": 4,
    "parallel": 1,
    "nominalVoltage": 12.8,
    "capacityAh": 100,
    "maxChargeV": 14.6,
    "minDischargeV": 10.0,
    "manufacturer": "AmpereTime",
    "model": "12V100Ah-Plus",
    "rawTextExtracted": "LiFePO4 12.8V 100Ah 1280Wh Charge: 14.6V Discharge: 10.0V",
    "confidence": "HIGH"
  },
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "needsReview": true
}
```

---

## 9. Alert Management Endpoints

### 9.1 GET `/api/alerts`
Fetches the active and historical alarm feed.

- **Query Parameters**:
  - `status` (`"active"` | `"acknowledged"` | `"resolved"`)
  - `severity` (`"info"` | `"warning"` | `"critical"` | `"emergency"`)

---

### 9.2 PUT `/api/alerts/[id]`
Acknowledges or resolves an active alert incident.

- **Access Tier**: `operator`, `admin`
- **Request Body**:
```json
{
  "acknowledged": true,
  "resolved": false,
  "notes": "Cell temperature stabilized after intake fan activated."
}
```

---

## 10. Export & Database Synchronization

### 10.1 GET `/api/export`
Streams historical telemetry in CSV or JSON format for regulatory audits.

- **Query Parameters**:
  - `format` (`csv` or `json`)
  - `deviceId` (`BAT001`)
  - `start`, `end`
- **Headers Returned**:
```http
Content-Type: text/csv
Content-Disposition: attachment; filename="telemetry-BAT001-2024-06-10.csv"
```

---

### 10.2 POST `/api/sync-to-mongo`
Triggers batch synchronization from Firebase RTDB to MongoDB Atlas.

- **Access Tier**: Automated Cron Worker / `admin`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "syncedCount": 184,
    "lastTimestamp": 1718000300000,
    "elapsedMs": 420
  }
}
```
