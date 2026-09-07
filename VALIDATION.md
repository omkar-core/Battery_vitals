# Battery Vital — Data Validation & Sanitization Guide (VALIDATION.md)

## 1. Validation Architecture Overview

Battery Vital implements a **defense-in-depth data validation pipeline**. Because corrupted sensor packets or malicious injection could compromise battery safety or trigger false emergency trips, data is validated at every boundary:

```
[ESP32 Edge ADC/I2C]
   │ (Edge boundary checking: NaN / I2C bus error detection)
   ▼
[API Route Gateway (Next.js)]
   │ (Zod schema parsing + type checking)
   ▼
[Deterministic Safety Engine (src/lib/batterySafety.js)]
   │ (Physical plausibility window clamping + staleness audit)
   ▼
[Gemini AI Prompt Sanitizer (src/lib/gemini.js)]
   │ (Untrusted input isolation + injection hardening)
   ▼
[Database Persistence Layer (MongoDB / Firebase)]
   │ (Schema validation & parameterized queries)
```

---

## 2. Plausible Physical Operational Windows

Every numerical measurement entering the system must fall within physical boundaries defined in [`src/lib/batterySafety.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/batterySafety.js):

| Metric | Minimum Bound | Maximum Bound | Violation Handling | Physical Rationale |
|---|---|---|---|---|
| **Bus Voltage** | 0.5 V | 100.0 V | Flag `out_of_range`; exclude from SOC | Lower values indicate disconnected probe; higher values exceed system architecture |
| **Current** | -500.0 A | +500.0 A | Flag `out_of_range` | Protects against shunt amplifier saturation |
| **Power** | -5,000.0 W | +5,000.0 W | Recalculate as $V \times I$ | Enforces physical energy conservation |
| **Temperature** | -40.0 °C | +150.0 °C | Flag `out_of_range` | Maximum physical rating of ambient probes |
| **Relative Humidity** | 0.0 %RH | 100.0 %RH | Clamped to [0.0, 100.0] | Physical saturation limits of air |
| **SOC** | 0.0 % | 100.0 % | Clamped to [0.0, 100.0] | Capacity percentage bounds |
| **SOH** | 0.0 % | 100.0 % | Clamped to [0.0, 100.0] | Health percentage bounds |
| **BHI** | 0.0 | 100.0 | Clamped to [0.0, 100.0] | Penalty index range |
| **Internal Resistance** | 0.0 mΩ | 1,000.0 mΩ | Flag `out_of_range` | Upper bound indicates open circuit |
| **MQ-2 Gas Sensor** | 0.0 ADC | 10,000.0 ADC | Flag `out_of_range` | 12-bit ADC raw range |
| **MQ-135 Gas Sensor** | 0.0 ADC | 10,000.0 ADC | Flag `out_of_range` | 12-bit ADC raw range |
| **Wi-Fi RSSI** | -150.0 dBm | 0.0 dBm | Clamped to valid dBm | RF physical receiver limit |

---

## 3. Strict Type Safety & Sanitization

### 3.1 Non-Finite Value Stripping
The function `isFiniteNumber(v)` guarantees that `NaN`, `Infinity`, `-Infinity`, strings, and `undefined` are caught and converted to `null`:

```javascript
const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v) => (isFiniteNumber(v) ? v : null);
```

### 3.2 Telemetry Packet Staleness Validation
Telemetry timestamps are verified against system time:
- **Maximum Age Ceiling**: 10 minutes ($600,000\text{ ms}$).
- **Action**: Packets older than 10 minutes are tagged with `stale: true` and generate a `stale_telemetry` issue.
- **Safety Precaution**: Stale telemetry cannot trigger automated clearing of an existing alarm.

### 3.3 The Honesty Invariant
If essential safety channels (`voltage`, `temperature`, `bhi`) are missing or null:
- The system **must not** assume the battery is `SAFE`.
- The safety state defaults to **`UNKNOWN`** with the missing sensor channels explicitly itemized.

---

## 4. Complete Zod Schema Definitions

### 4.1 Ingest Telemetry Schema
```javascript
import { z } from 'zod';

export const TelemetryPayloadSchema = z.object({
  deviceId: z.string().min(3).max(10).regex(/^[A-Z0-9_-]+$/),
  timestamp: z.number().int().positive().optional(),
  voltage: z.number().min(0.5).max(100.0),
  current: z.number().min(-500.0).max(500.0),
  temperature: z.number().min(-40.0).max(150.0),
  humidity: z.number().min(0.0).max(100.0).optional(),
  mq2: z.number().min(0).max(10000).optional(),
  mq135: z.number().min(0).max(10000).optional(),
  ina_ok: z.boolean().optional(),
  dht_ok: z.boolean().optional()
});
```

### 4.2 Actuator Command Schemas
```javascript
export const LEDControlSchema = z.object({
  deviceId: z.string().min(3).max(10),
  led: z.enum(['green', 'yellow', 'red']),
  state: z.boolean()
});

export const BuzzerControlSchema = z.object({
  deviceId: z.string().min(3).max(10),
  mode: z.enum(['off', 'slow_beep', 'fast_beep', 'continuous'])
});
```

### 4.3 Alert Configuration Tuning Schema
```javascript
export const AlertThresholdConfigSchema = z.object({
  voltage_max: z.number().min(12.0).max(30.0),
  voltage_min: z.number().min(8.0).max(13.0),
  temp_warning: z.number().min(30.0).max(45.0),
  temp_critical: z.number().min(40.0).max(65.0),
  mq2_warning: z.number().min(300).max(1000),
  mq2_critical: z.number().min(500).max(3000)
});
```

---

## 5. Security & Injection Prevention

### 5.1 MongoDB Parameterization
- All database queries avoid string concatenation.
- User-supplied identifiers are strictly validated against regex `/^[A-Z0-9_-]+$/` before query binding:
```javascript
const deviceId = cleanDeviceId(req.query.deviceId);
const doc = await db.collection('readings').findOne({ deviceId });
```

### 5.2 AI Prompt Injection Defense
- User-supplied notes or chat input are enclosed in clearly labeled untrusted blocks:
```text
=== UNTRUSTED USER DATA START ===
${sanitizedUserInput}
=== UNTRUSTED USER DATA END ===
```
- The Gemini system instruction explicitly commands the model to ignore any instructions found within untrusted blocks.
