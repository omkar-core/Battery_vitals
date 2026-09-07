# Battery Vital — Architectural Memory & Hardware Gotchas (MEMORY.md)

> **Purpose**: This document serves as the institutional memory, architectural decision record (ADR), and hardware troubleshooting log for the Battery Vital engineering team and AI pair-programming agents.

---

## 1. Architectural Decision Records (ADRs)

### ADR-001: Hybrid Dual-Database Architecture (Firebase RTDB + MongoDB Atlas)
- **Context**: The platform requires sub-second live streaming to web clients (<500ms) alongside complex historical time-series aggregation, compound indexing, and multi-year data retention.
- **Decision**: Implement a **hybrid dual-database strategy**:
  - **Firebase Realtime Database**: Acts as the real-time operational message broker. The ESP32 writes directly to `/live_data/{DEVICE_ID}`, and connected web browsers subscribe via WebSockets for instant state updates.
  - **MongoDB Atlas**: Serves as the persistent historical time-series archive. A background synchronization worker (`/api/sync-to-mongo`) batches records every 5 minutes from Firebase into MongoDB collections (`readings`, `alerts`, `users`, `ai_diagnostics`).
- **Consequences**:
  - *Positive*: Zero socket management overhead; sub-500ms browser updates; powerful MongoDB indexing for analytics.
  - *Trade-off*: Data exists in two places for 5 minutes until synced; sync worker must manage cursors to avoid duplicate inserts.

---

### ADR-002: Dual-Tier Deterministic Safety Architecture Bounding Generative AI
- **Context**: Generative LLMs (e.g., Google Gemini) are probabilistic models capable of hallucination and cannot be trusted with life-safety decisions (fire prevention, electrical cutoffs).
- **Decision**: Enforce a strict **dual-tier safety hierarchy**:
  - **Tier 1 (Edge C++ & Server JS)**: The physical ESP32 firmware loop and the pure JavaScript safety kernel ([`src/lib/batterySafety.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/batterySafety.js)) possess exclusive, deterministic trip authority.
  - **Tier 2 (Gemini AI)**: Generative AI is restricted to an *interpretive and explanatory role*. Gemini's system prompt strictly prohibits fabrications, and the server interceptor mandates that Gemini's output can **never** report a risk level lower than the deterministic engine verdict.
- **Consequences**:
  - *Positive*: Safety compliance is 100% deterministic and auditable; zero risk of AI hallucinating a "SAFE" status during an active thermal event.
  - *Trade-off*: AI cannot unilaterally clear an alarm; an operator or automated recovery condition is required.

---

### ADR-003: Pure Server-Side REST & SSE for Google Gemini (Zero Client SDK Bloat)
- **Context**: The client web application needs fast loading times and strict isolation of the `GEMINI_API_KEY`.
- **Decision**: Avoid importing heavy client-side AI SDKs. Implement direct server-side HTTPS `fetch()` and Server-Sent Events (SSE) streaming in [`src/lib/gemini.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/gemini.js) targeting the Google Generative Language v1beta REST endpoints.
- **Consequences**:
  - *Positive*: The Gemini API key never leaves the secure Node.js server runtime; client JavaScript bundle size is minimized; full control over abort signals and timeouts (25-second ceiling).
  - *Trade-off*: Streaming requires manual SSE parsing on the client.

---

### ADR-004: In-Memory Resilience Fallback for Critical Services
- **Context**: Network partitions, MongoDB connection exhaustion, or cloud maintenance must not bring down the local monitoring dashboard.
- **Decision**: Implement in-memory fallbacks for user authentication ([`src/lib/auth.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/auth.js)) and alert configurations. If MongoDB Atlas is unreachable, the system transparently serves and updates an in-memory store while logging a warning.
- **Consequences**:
  - *Positive*: High platform availability; technicians can continue monitoring batteries even during upstream cloud outages.
  - *Trade-off*: Modifications made during an outage do not persist across serverless function restarts until DB reconnection.

---

## 2. Hardware Quirks & Calibration Notes

### 2.1 ESP32 ADC Non-Linearity & ADC1 vs ADC2 Pin Discipline
- **The Quirk**: The ESP32's built-in 12-bit Successive Approximation Register (SAR) Analog-to-Digital Converter exhibits severe non-linearity below 0.1V and above 2.8V (attenuation dependent).
- **The Critical Trap (ADC2 Wi-Fi Conflict)**:
  > [!CAUTION]
  > **NEVER** assign analog sensors to **ADC2** pins (GPIO 0, 2, 4, 12, 13, 14, 15, 25, 26, 27) when Wi-Fi is enabled. The ESP32 Wi-Fi networking stack takes exclusive hardware control over ADC2. Reading an ADC2 pin while connected to Wi-Fi always returns `0` or random noise.
- **The Solution**: Both analog gas sensors in Battery Vital are strictly assigned to **ADC1**:
  - **MQ-2**: GPIO 34 (`ADC1_CHANNEL_6`)
  - **MQ-135**: GPIO 35 (`ADC1_CHANNEL_7`)

---

### 2.2 MQ-2 & MQ-135 Gas Sensor Heating Coils & Burn-In
- **Power Demands**: Both MQ sensors contain internal tin-dioxide ($SnO_2$) heating coils that draw **~150 mA at 5V** each.
  - *Warning*: Attempting to power MQ sensors from the ESP32 onboard 3.3V LDO regulator will cause immediate voltage sag, triggering ESP32 brownout detector resets (`Brownout detector was triggered`).
  - *Requirement*: MQ sensors must be wired directly to the **5V (VIN)** supply rail.
- **Burn-In Period**: Fresh MQ sensors require a **24 to 48-hour continuous preheat burn-in** before baseline resistance ($R_0$) stabilizes. Sensor values during the first 2 hours of power-up are erratic and should be ignored for alert generation.
- **Relative Humidity Sensitivity**: MQ resistance varies with ambient humidity. High humidity (>70%RH) lowers sensor resistance, potentially producing false-positive gas warnings unless compensated using DHT11 readings.

---

### 2.3 INA219 Current & Power Monitor Calibration
- **Default Breakout Shunt**: Standard commercial INA219 breakout modules ship with a **$0.1\Omega$ ($R100$) current sense resistor**.
  - With a $0.1\Omega$ shunt and maximum programmable PGA gain ($\pm 320\text{ mV}$), the maximum measurable current is:
    $$I_{\text{max}} = \frac{320\text{ mV}}{0.1\Omega} = 3.2\text{ A}$$
- **High-Current Packs (>3.2A)**:
  - For EV or ESS packs discharging 10A to 15A, desolder the onboard $0.1\Omega$ resistor and install a **$0.01\Omega$ ($R010$) 2W metal foil shunt**.
  - Update the calibration register multiplier in [`esp32/BatteryVital_v13.0/sensors.h`](file:///d:/Webapp/Working_webapps/Battery_vitals/esp32/BatteryVital_v13.0/sensors.h) from `0.1` to `0.01` to scale current readouts by a factor of 10.
- **I2C Pull-Up Resistors**: The ESP32 internal pull-ups on GPIO 21 (SDA) and GPIO 22 (SCL) are weak (~50kΩ). Hardware external **4.7kΩ pull-up resistors to 3.3V** are required to prevent I2C bus lockup during electrical transients.

---

### 2.4 DHT11 Minimum Sampling Cadence
- **Timing Constraint**: The DHT11 capacitive humidity sensor requires at least **2.0 seconds between consecutive read cycles**.
- **The Issue**: Battery Vital's main loop executes every **1.5 seconds** (`LOOP_DELAY_MS = 1500`).
- **The Solution**: The firmware in [`sensors.h`](file:///d:/Webapp/Working_webapps/Battery_vitals/esp32/BatteryVital_v13.0/sensors.h) implements a non-blocking interval check:
  ```cpp
  if (millis() - lastDhtRead >= 2000) {
      readDHT();
      lastDhtRead = millis();
  }
  // If sampled between 0 and 2000ms, use the previous cached reading.
  ```

---

### 2.5 Active Buzzer Drive Circuitry
- **Hardware Selection**: Battery Vital specifies an **Active Buzzer** on GPIO 25.
- Unlike passive piezo speakers that require a PWM frequency generator (`ledcWrite` / `tone()`), an active buzzer contains an internal oscillating circuit and sounds at ~2.4 kHz when driven with simple DC logic `HIGH`.
- The firmware state machine uses non-blocking `millis()` timing to pulse GPIO 25 `HIGH`/`LOW` to produce slow beep (2s on / 2s off) and fast beep (0.5s on / 0.5s off) cadences without halting the sensor acquisition loop.

---

## 3. Web & Cloud Runtime Gotchas

### 3.1 Production Console Stripping in Next.js
- **The Setup**: In `next.config.js`, `compiler: { removeConsole: process.env.NODE_ENV === 'production' }` is active to optimize build performance.
- **The Gotcha**: Standard `console.log()` statements are **completely removed from production bundles**.
- **The Rule**:
  - Always use `console.warn(...)` or `console.error(...)` for operational logging, security audits, and exception tracking in backend API routes.

---

### 3.2 Firebase Realtime Database Data Shaping
- **Empty Array Handling**: Firebase RTDB does not store empty arrays or keys with `undefined` values. Storing an object with `{ alerts: [] }` will result in the `alerts` key being completely dropped.
- **Defensive Unpacking**: Client hooks ([`useFirebase.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/hooks/useFirebase.js)) and server APIs must always provide fallback defaults:
  ```javascript
  const alerts = data.alerts || []
  const battery = data.battery || {}
  ```

---

## 4. Known Edge Cases & Mitigation Strategies

| Scenario | Symptom | Root Cause | Automated Mitigation |
|---|---|---|---|
| **Sudden Disconnect** | Telemetry freezes on dashboard | Wi-Fi dropped or ESP32 lost power | Web UI flags data as `STALE` after 10m; displays offline badge after 5s |
| **Negative Current Readout** | Current displays `-2.4A` | Pack is currently discharging into load | Normal behavior: $+I$ = charging, $-I$ = discharging |
| **Buzzer Locks ON** | Buzzer sounds continuously | Fatal trip (temp >55°C, gas >800) | Physical disconnect of load required; web command intentionally locked out |
| **Gemini Rate Limit (429)** | AI page shows error | Rapid consecutive manual requests | Sliding-window cache serves previous diagnostic fingerprint |
| **Cold Start Sensor Drift** | Gas readings jump initially | MQ heater warming up | First 120 seconds after boot ignored for emergency alert dispatch |
