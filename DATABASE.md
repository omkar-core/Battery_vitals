# Battery Vital — Database Architecture & Schemas (DATABASE.md)

## 1. Dual-Database Architecture Overview

Battery Vital implements a **hybrid dual-database strategy** balancing sub-second real-time telemetry streaming with long-term time-series analytics and high-compliance audit storage.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Dual-Database Model                               │
│                                                                             │
│   ESP32 Edge Node (1.5s loop)                                               │
│       │                                                                     │
│       ▼                                                                     │
│   Firebase Realtime Database (WebSocket Fanout) ──► Sub-Second Web Clients  │
│       │                                                                     │
│       ▼ (Periodic Sync Worker: /api/sync-to-mongo every 5 min)              │
│   MongoDB Atlas (Document Persistence) ───────────► Historical & Analytics  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Firebase Realtime Database (Operational Cache)

### 2.1 Complete JSON Tree Structure
```json
{
  "live_data": {
    "BAT001": {
      "timestamp": 1718000000000,
      "battery": {
        "voltage": 12.64,
        "current": 2.45,
        "power": 30.97,
        "shuntVoltage": 0.0245,
        "loadVoltage": 12.66,
        "resistance": 12.5,
        "soc": 84,
        "soh": 98,
        "bhi": 8,
        "safety": "SAFE"
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
        "auto_mode": true,
        "led_green": true,
        "led_yellow": false,
        "led_red": false,
        "buzzer": false,
        "buzzer_mode": "off",
        "wifi_rssi": -62,
        "heap_free": 238410
      }
    }
  },
  "commands": {
    "BAT001": {
      "auto_mode": true,
      "led_green": true,
      "led_yellow": false,
      "led_red": false,
      "buzzer": false,
      "buzzer_mode": "off",
      "updatedAt": 1718000000000
    }
  },
  "alerts": {
    "BAT001": {
      "active": {
        "alert_101": {
          "id": "alert_101",
          "type": "overvoltage",
          "severity": "critical",
          "message": "Pack voltage 14.7V exceeded maximum limit of 14.6V",
          "timestamp": 1718000000000,
          "acknowledged": false
        }
      }
    }
  }
}
```

### 2.2 Security Rules Specification
```json
{
  "rules": {
    "live_data": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null && (auth.token.role === 'admin' || auth.token.role === 'node')"
      }
    },
    "commands": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null && (auth.token.role === 'admin' || auth.token.role === 'operator')"
      }
    },
    "alerts": {
      "$deviceId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

---

## 3. MongoDB Atlas (Persistent Historical Store)

### 3.1 Collection: `readings` (Time-Series Telemetry)
Stores granular telemetry snapshots synced every 5 minutes from Firebase RTDB.

```javascript
// Document Schema Example
{
  "_id": ObjectId("66671a5c1a2b3c4d5e6f7a8b"),
  "deviceId": "BAT001",
  "timestamp": ISODate("2024-06-10T14:30:00.000Z"),
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
  "safety_status": "SAFE",
  "created_at": ISODate("2024-06-10T14:35:01.000Z")
}
```

#### Indexing Strategy
```javascript
db.readings.createIndex({ deviceId: 1, timestamp: -1 });
db.readings.createIndex({ "battery.voltage": 1 });
db.readings.createIndex({ "environmental.temperature": 1 });
db.readings.createIndex({ safety_status: 1 });
```

---

### 3.2 Collection: `alerts` (Historical Audit Log)
Stores every alert event, threshold violation, operator acknowledgment, and resolution record.

```javascript
{
  "_id": ObjectId("66671a5c1a2b3c4d5e6f7a8c"),
  "deviceId": "BAT001",
  "type": "thermal_critical",
  "severity": "critical",
  "message": "Cell temperature reached 46.2°C (trip threshold: 45.0°C)",
  "metric": "temperature",
  "threshold": 45.0,
  "measured_value": 46.2,
  "timestamp": ISODate("2024-06-10T14:30:00.000Z"),
  "acknowledged": true,
  "acknowledged_by": "usr_admin_01",
  "acknowledged_at": ISODate("2024-06-10T14:31:15.000Z"),
  "resolved": false,
  "resolved_at": null,
  "created_at": ISODate("2024-06-10T14:30:05.000Z")
}
```

#### Indexing Strategy
```javascript
db.alerts.createIndex({ deviceId: 1, timestamp: -1 });
db.alerts.createIndex({ severity: 1, acknowledged: 1 });
db.alerts.createIndex({ type: 1 });
```

---

### 3.3 Collection: `users` (Role-Based Access Profiles)
Stores user account profiles, assigned roles, and permission entitlements.

```javascript
{
  "_id": ObjectId("66671a5c1a2b3c4d5e6f7a8d"),
  "id": "usr_admin_01",
  "name": "Chief Battery Engineer",
  "email": "admin@example.com",
  "role": "admin",
  "title": "Lead Power Systems Engineer",
  "department": "Energy Storage & Safety",
  "avatar": "🛡️",
  "status": "active",
  "lastActive": ISODate("2024-06-10T14:30:00.000Z"),
  "createdAt": ISODate("2024-01-01T00:00:00.000Z")
}
```

#### Indexing Strategy
```javascript
db.users.createIndex({ id: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
```

---

### 3.4 Collection: `ai_diagnostics` (Cached Gemini Evaluations)
Maintains structured AI diagnostic responses with automatic TTL eviction.

```javascript
{
  "_id": ObjectId("66671a5c1a2b3c4d5e6f7a8e"),
  "deviceId": "BAT001",
  "fingerprint": "v12.6_t26.4_bhi8_soc84",
  "timestamp": ISODate("2024-06-10T14:30:00.000Z"),
  "telemetry_snapshot": {
    "voltage": 12.64,
    "current": 2.45,
    "temperature": 26.4,
    "mq2": 320,
    "bhi": 8
  },
  "analysis": {
    "overall_status": "SAFE",
    "safety_score": 92,
    "risk_level": "low",
    "summary": "Battery pack is operating inside normal electrical and thermal envelopes.",
    "recommendations": [
      "Operating parameters nominal; continue current 2.45A discharge profile."
    ],
    "predicted_issues": [],
    "failure_probability": {
      "30_days": 1.2,
      "90_days": 4.5,
      "1_year": 18.0
    }
  },
  "model_used": "gemini-1.5-flash",
  "response_time_ms": 1120,
  "created_at": ISODate("2024-06-10T14:30:02.000Z")
}
```

#### Indexing Strategy
```javascript
db.ai_diagnostics.createIndex({ deviceId: 1, timestamp: -1 });
db.ai_diagnostics.createIndex({ fingerprint: 1 });
// TTL Index: automatically delete records after 7 days (604,800 seconds)
db.ai_diagnostics.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800 });
```

---

## 4. Data Lifecycle & Retention Policies

| Data Layer | Retention Window | Storage Target | Archival / Pruning Policy |
|---|---|---|---|
| **Live Stream** | Latest state only | Firebase RTDB | Overwritten in-place every 1.5 seconds |
| **Active Alerts** | Until resolved | Firebase RTDB | Moved to MongoDB `alerts` upon resolution |
| **Telemetry History** | 5 Years | MongoDB Atlas | Partitioned by `deviceId` + `year_month` |
| **AI Evaluations** | 7 Days | MongoDB Atlas | Automatic TTL deletion index |
| **Audit Logs** | Permanent | MongoDB Atlas | Tamper-proof, append-only records |

---

## 5. Backup & Disaster Recovery

- **Continuous Point-in-Time Recovery (PITR)**: Configured in MongoDB Atlas with 1-minute granularity for 35 days.
- **Automated Daily Snapshots**: Retained for 90 days across 3 distinct geographic cloud regions.
- **Failover**: Automatic multi-node replica set election completes within <5 seconds without data loss.
