# Battery Vital — Comprehensive Test Strategy & Verification Plan (TESTING.md)

## 1. Testing Philosophy & Test Pyramid

Battery Vital enforces a multi-tier testing strategy ensuring that life-critical safety logic, edge sensor data pipelines, and full-stack web modules operate flawlessly under all operational conditions:

```
        ┌───────────────────────────────────────┐
        │       End-to-End (E2E) Browser        │
        │   (Playwright: UI flows, web chimes)  │
        └───────────────────┬───────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │     Integration & API Route Tests     │
        │  (Next.js REST routes, RBAC, Firebase)│
        └───────────────────┬───────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │   Hardware-in-the-Loop (HIL) Tests    │
        │(ESP32 mock packets, Wi-Fi dropouts)   │
        └───────────────────┬───────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │       Unit Tests (Deterministic)      │
        │(batterySafety, clamping, math, errors)│
        └───────────────────────────────────────┘
```

---

## 2. Unit Testing Strategy

### 2.1 Core Safety Kernel Testing (`src/lib/batterySafety.test.js`)
The deterministic safety engine must achieve **100% branch and statement coverage**. Every boundary condition, overvoltage trip, and thermal runaway precursor must be tested.

```javascript
import { describe, it, expect } from 'vitest';
import { validateTelemetry, computeSafety, SAFETY_STATES } from './batterySafety';

describe('batterySafety — Validation & Clamping', () => {
  it('should flag and sanitize out-of-range voltages', () => {
    const { clean, issues } = validateTelemetry({ voltage: -5.2 });
    expect(clean.voltage).toBe(-5.2);
    expect(issues.some(i => i.code === 'out_of_range')).toBe(true);
  });

  it('should strip non-finite numbers like NaN and Infinity', () => {
    const { clean, issues } = validateTelemetry({ voltage: NaN, current: Infinity });
    expect(clean.voltage).toBeNull();
    expect(clean.current).toBeNull();
    expect(issues.some(i => i.code === 'invalid_number')).toBe(true);
  });

  it('should flag packets older than 10 minutes as stale', () => {
    const elevenMinutesAgo = Date.now() - (11 * 60 * 1000);
    const { clean, issues } = validateTelemetry({ timestamp: elevenMinutesAgo });
    expect(clean.stale).toBe(true);
    expect(issues.some(i => i.code === 'stale_telemetry')).toBe(true);
  });
});

describe('batterySafety — Deterministic Trip Bounds', () => {
  it('should trigger EMERGENCY when cell temperature exceeds 55°C', () => {
    const result = computeSafety({ temperature: 56.5 });
    expect(result.state).toBe(SAFETY_STATES.EMERGENCY);
    expect(result.violations.some(v => v.rule.code === 'thermal_runaway_edge')).toBe(true);
  });

  it('should trigger CRITICAL on deep discharge below 10.0V', () => {
    const result = computeSafety({ voltage: 9.8 });
    expect(result.state).toBe(SAFETY_STATES.CRITICAL);
  });

  it('should trigger EMERGENCY on catastrophic discharge below 9.5V', () => {
    const result = computeSafety({ voltage: 9.2 });
    expect(result.state).toBe(SAFETY_STATES.EMERGENCY);
  });

  it('should report UNKNOWN if essential channels are missing', () => {
    const result = computeSafety({});
    expect(result.state).toBe(SAFETY_STATES.UNKNOWN);
    expect(result.unknown).toContain('voltage');
    expect(result.unknown).toContain('temperature');
  });
});
```

---

## 3. Integration & API Testing Strategy

### 3.1 REST API Route Tests
Tests verify authentication, RBAC permission checks, input sanitization, and database query formatting.

```javascript
describe('POST /api/control/led — RBAC Enforcement', () => {
  it('should reject viewer role with 403 Forbidden', async () => {
    const response = await fetch('http://localhost:3000/api/control/led', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer viewer_token'
      },
      body: JSON.stringify({ deviceId: 'BAT001', led: 'red', state: true })
    });
    expect(response.status).toBe(403);
  });

  it('should allow operator role to toggle LEDs', async () => {
    const response = await fetch('http://localhost:3000/api/control/led', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer operator_token'
      },
      body: JSON.stringify({ deviceId: 'BAT001', led: 'red', state: true })
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});
```

---

## 4. Hardware-in-the-Loop (HIL) & Stress Testing

### 4.1 Physical Edge Verification Scenarios
1. **I2C Bus Jamming Test**: Short SDA to GND for 3 seconds; verify that the ESP32 logs an I2C error, marks `ina_ok: false`, and recovers automatically upon release without resetting.
2. **Wi-Fi Disconnect Autonomy**: Power off the Wi-Fi access point; simulate overtemperature on DHT11; verify that the physical **Red LED (GPIO 27)** and **Active Buzzer (GPIO 25)** trigger locally within <100ms.
3. **Power Brownout Test**: Slowly ramp supply voltage down to 3.0V; verify clean hardware brownout reset without EEPROM / flash corruption.

### 4.2 Soak & Load Testing
- **Continuous Soak Test**: Run ESP32 firmware and Next.js web application for **168 hours (7 continuous days)** streaming telemetry every 1.5 seconds.
- **Pass Criteria**:
  - Zero memory leaks (heap memory remains stable within ±2%).
  - Zero unhandled promise rejections or database connection drops.
  - MongoDB sync worker synchronizes 100% of batched frames without drift.
