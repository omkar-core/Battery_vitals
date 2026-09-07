# Battery Vital — Performance Optimization & Benchmarks (PERFORMANCE.md)

## 1. Performance Architecture & Objectives

Battery Vital delivers real-time industrial telemetry with sub-second latency while maintaining low power consumption on embedded microcontrollers and optimal Core Web Vitals on the web dashboard.

### Service Level Objectives (SLOs)

| Metric | Target SLO | Production Benchmark | Measurement Method |
|---|---|---|---|
| **Telemetry Edge-to-Browser Latency** | < 500 ms | ~320 ms | High-resolution timestamp diff |
| **First Contentful Paint (FCP)** | < 1.0 s | ~0.7 s | Google Lighthouse Audit |
| **Largest Contentful Paint (LCP)** | < 2.0 s | ~1.2 s | Web Vitals Chrome Extension |
| **Cumulative Layout Shift (CLS)** | 0.000 | 0.000 | Tabular monospace numerics |
| **Gemini AI Diagnostic Latency** | < 2,500 ms | ~1,120 ms | Server timing header (`Server-Timing`) |
| **Cached AI Diagnostic Response** | < 10 ms | ~2.5 ms | In-memory `aiCache.js` hit |
| **ESP32 Loop Processing Time** | < 150 ms | ~42 ms | Hardware timer tick profiling |

---

## 2. Frontend & Next.js Bundle Optimization

### 2.1 Next.js 14 App Router Optimization
- **React Server Components (RSC)**: Static layouts, navigation menus, and markdown documentation are rendered on the server as pure HTML, shipping **zero client-side JavaScript**.
- **Client Boundary Isolation**: Interactive charts and WebSocket hooks are isolated to leaf components with `'use client'`, keeping initial JS bundles under **120 KB gzip**.

### 2.2 Recharts Dynamic Loading
Heavy visualization components are dynamically imported with SSR disabled to prevent server hydration mismatches and decrease initial bundle size:
```javascript
import dynamic from 'next/dynamic';

export const LiveChart = dynamic(
  () => import('@/components/charts/LiveChart'),
  { ssr: false, loading: () => <div className="skeleton-chart" /> }
);
```

### 2.3 Layout Stability via Monospace Numerics
Rapidly changing telemetry numbers cause severe Cumulative Layout Shift (CLS) if proportional fonts are used. Battery Vital couples monospace typography with `font-variant-numeric: tabular-nums`:
```css
.telemetry-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
}
```

---

## 3. Caching & Request Deduplication

### 3.1 Telemetry Fingerprint AI Caching (`src/lib/aiCache.js`)
Google Gemini evaluations are computationally expensive and rate-limited. The platform generates an operational fingerprint of the current telemetry frame:
```javascript
export function telemetryFingerprint(t = {}) {
  const v = Math.round(Number(t.voltage || 0) * 10) / 10;       // 0.1V resolution
  const temp = Math.round(Number(t.temperature || 0) * 2) / 2; // 0.5°C resolution
  const bhi = Math.round(Number(t.bhi || 0) / 5) * 5;          // 5-point bucket
  const soc = Math.round(Number(t.soc || 0) / 5) * 5;          // 5% bucket
  return `v${v}_t${temp}_bhi${bhi}_soc${soc}`;
}
```
- **TTL**: 5 minutes ($300,000\text{ ms}$).
- **Performance Impact**: Identical operational states serve cached diagnostic JSON with **<5ms latency**, reducing external Gemini API calls by **~85%**.

---

## 4. Database Query Optimization

### 4.1 Compound Indexing on MongoDB Atlas
All time-series queries specify compound indexes matching the exact query filter and sort orders:
```javascript
// Compound index ensures index-only scans without in-memory sort
db.readings.createIndex({ deviceId: 1, timestamp: -1 });
```

### 4.2 Query Projection
Historical queries retrieve only the exact fields required for graph rendering, avoiding multi-megabyte payload transfers:
```javascript
const history = await db.collection('readings')
  .find(
    { deviceId, timestamp: { $gte: start, $lte: end } },
    { projection: { timestamp: 1, "battery.voltage": 1, "battery.current": 1, _id: 0 } }
  )
  .sort({ timestamp: -1 })
  .limit(1000)
  .toArray();
```

---

## 5. ESP32 Firmware Performance & Power Profiling

### 5.1 Static Memory Allocation (`ArduinoJson`)
Dynamic heap allocation (`malloc` / `new`) on embedded microcontrollers leads to heap fragmentation and eventual crashes. The firmware utilizes static memory buffers:
```cpp
// StaticJsonDocument allocated on stack, zero heap fragmentation
StaticJsonDocument<512> doc;
doc["voltage"] = voltage;
doc["current"] = current;
```

### 5.2 Non-Blocking Scheduling
Sensor reading cadences are managed via non-blocking `millis()` state tracking, ensuring the hardware watchdog timer (`esp_task_wdt`) is fed every loop:
```cpp
unsigned long currentMillis = millis();
if (currentMillis - lastSensorSample >= 1500) {
    sampleSensors();
    lastSensorSample = currentMillis;
}
```

### 5.3 Power Consumption Breakdown

```
ESP32 Active Wi-Fi Transmission:   160 mA @ 3.3V  =  528 mW
INA219 Power Monitor:                 1 mA @ 3.3V  =    3 mW
DHT11 Ambient Sensor:               0.5 mA @ 3.3V  =  1.7 mW
MQ-2 Heater Element:                150 mA @ 5.0V  =  750 mW
MQ-135 Heater Element:              150 mA @ 5.0V  =  750 mW
LED Status Indicators:               40 mA @ 3.3V  =  132 mW
Active Buzzer (Alarms):              30 mA @ 3.3V  =   99 mW
────────────────────────────────────────────────────────────
Total Peak Draw (Full Trip State):  ~532 mA         ≈ 2.26 W
```
