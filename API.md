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
System liveness and readiness probe checking connectivity to Firebase RTDB and MongoDB Atlas.

- **Access Tier**: Public
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptimeSeconds": 86420,
    "services": {
      "firebase": "connected",
      "mongodb": "connected",
      "gemini": "available"
    },
    "version": "2.0.0"
  }
}
```

---

### 2.2 GET `/api/telemetry`
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
    "timestamp": 1718000000000,
    "battery": {
      "voltage": 12.64,
      "current": 2.45,
      "power": 30.97,
      "shuntVoltage": 0.0245,
      "resistance": 12.5,
      "soc": 84,
      "soh": 98,
      "bhi": 8
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
    "safety": "SAFE"
  }
}
```

---

### 2.3 POST `/api/telemetry`
Direct sensor packet ingest endpoint for HTTP-capable edge nodes or telemetry forwarders.

- **Access Tier**: `admin` or Hardware Service Key
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
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": { "insertedId": "66671a5c1a2b3c4d5e6f7a8b", "status": "SAFE" }
}
```

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

## 6. AI Predictive Diagnostics & Analysis

### 6.1 POST `/api/analyze`
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

## 7. Alert Management Endpoints

### 7.1 GET `/api/alerts`
Fetches the active and historical alarm feed.

- **Query Parameters**:
  - `status` (`"active"` | `"acknowledged"` | `"resolved"`)
  - `severity` (`"info"` | `"warning"` | `"critical"` | `"emergency"`)

---

### 7.2 PUT `/api/alerts/[id]`
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

## 8. Export & Database Synchronization

### 8.1 GET `/api/export`
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

### 8.2 POST `/api/sync-to-mongo`
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
