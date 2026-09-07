# Battery Vital — Engineering & Safety Rules (RULES.md)

> [!IMPORTANT]
> **Status**: Mandatory & Non-Negotiable  
> This document defines the engineering invariants, safety constraints, coding standards, and operational policies governing the Battery Vital codebase. Every contributor, engineer, and AI pair-programmer working on this repository must adhere strictly to these rules.

---

## 1. Non-Negotiable Safety & Physics Invariants

### 1.1 The Deterministic Safety Engine is the Supreme Authority
- **Primary Source of Truth**: The deterministic physics engine located at [`src/lib/batterySafety.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/batterySafety.js) is the final, unchallengeable authority on system health.
- **AI Subordination Rule**: Generative AI (Google Gemini) is an **interpretive layer only**.
  - Gemini may analyze patterns, explain physical phenomena, and propose maintenance schedules.
  - Gemini's `overall_status` may **NEVER** claim a lower risk level than the deterministic safety engine verdict.
  - If the deterministic engine asserts `CRITICAL` or `EMERGENCY`, any AI response claiming `SAFE` or `NORMAL` must be immediately intercepted and overridden before presentation to the user.
- **Severity Ranking**:
  ```
  SAFE (0) < CAUTION (1) < WARNING (2) < CRITICAL (3) < EMERGENCY (4)
  ```
  The system state is always aggregated using the highest severity violation found.

### 1.2 Hardware Safety Lockout Rule
- **Physical Trip Precedence**: If physical sensors trip a critical limit (Voltage < 10.0V or > 14.6V; Cell Temp > 45.0°C; MQ-2 Gas > 800 ppm), the ESP32 firmware executes a hardware trip:
  - **Red LED (GPIO 27)** is driven `HIGH`.
  - **Active Buzzer (GPIO 25)** is driven in continuous or fast-beep alarm mode.
- **Remote Override Invalidation**: Web UI commands dispatched via `/api/control/led` or `/api/control/buzzer` **cannot** silence physical alarms or force green LED state while a physical `CRITICAL` or `EMERGENCY` condition persists. Software requests attempting to bypass a trip must be rejected with HTTP `403 Forbidden` or `422 Unprocessable Entity`.

### 1.3 Edge Autonomy Invariant
- The ESP32 firmware safety loop runs locally in [`esp32/BatteryVital_v13.0/led_control.h`](file:///d:/Webapp/Working_webapps/Battery_vitals/esp32/BatteryVital_v13.0/led_control.h) independently of network availability.
- If Wi-Fi disconnects, the router resets, or Firebase RTDB becomes unreachable, the ESP32 must continue sampling sensors every 1.5 seconds and triggering local LED/Buzzer actuators without crashing or freezing.

---

## 2. Telemetry Validation & Sanitization Rules

### 2.1 Plausible Operational Ranges
All incoming telemetry packets—whether ingested from ESP32 or simulated—must be strictly validated and clamped against physical plausibility ranges defined in [`src/lib/batterySafety.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/batterySafety.js):

| Metric | Minimum Bound | Maximum Bound | Violation Handling |
|--------|---------------|---------------|--------------------|
| **Voltage** | 0.5 V | 100.0 V | Flag `out_of_range`; do not infer SOC |
| **Current** | -500.0 A | +500.0 A | Flag `out_of_range` |
| **Power** | -5,000.0 W | +5,000.0 W | Clamped to calculated $V \times I$ |
| **Temperature** | -40.0 °C | +150.0 °C | Flag `out_of_range` |
| **Humidity** | 0.0 %RH | 100.0 %RH | Clamped to 0–100% |
| **SOC** | 0.0 % | 100.0 % | Clamped to 0–100% |
| **SOH** | 0.0 % | 100.0 % | Clamped to 0–100% |
| **BHI** | 0.0 | 100.0 | Clamped to 0–100 |
| **Resistance** | 0.0 mΩ | 1,000.0 mΩ | Flag `out_of_range` |
| **MQ-2 Gas** | 0.0 ADC | 10,000.0 ADC | Flag `out_of_range` |
| **MQ-135 Gas** | 0.0 ADC | 10,000.0 ADC | Flag `out_of_range` |
| **RSSI** | -150.0 dBm | 0.0 dBm | Clamped to valid dBm |

### 2.2 Rejection of Non-Finite and Corrupt Data
- **No `NaN` or `Infinity`**: Any numeric field parsed as `NaN`, `Infinity`, or `-Infinity` must be caught by `isFiniteNumber()`, converted to `null`, and recorded as an `invalid_number` issue.
- **Staleness Tracking**: If packet timestamp is older than **10 minutes** ($600,000\text{ ms}$), it must be flagged as `stale_telemetry`.
- **Honesty Invariant**: If two or more essential safety channels (`voltage`, `temperature`, `bhi`) are missing or `null`, the platform **must** report status as `UNKNOWN`. It is strictly forbidden to assume a missing sensor is `SAFE`.

---

## 3. Generative AI (Gemini) Operational Constraints

All interactions with Google Gemini via [`src/lib/gemini.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/gemini.js) must follow these strict operational rules:

1. **Zero Telemetry Fabrication**: Gemini must never guess, invent, or extrapolate sensor values. If a channel is not reported in the prompt, the model must output `"not reported"`.
2. **No Redundant Calculations**: Gemini must not compute electrical arithmetic (power, energy, Coulomb integrals) that the Next.js runtime already computes. Gemini's role is physical interpretation and risk assessment.
3. **No Unsubstantiated Failure Dates**: Gemini must never output a concrete calendar failure date or precise remaining useful life (e.g., "will explode on March 14") unless supported by a statistically significant degradation slope over time. Under limited data, it must state `"insufficient data to establish RUL trend"`.
4. **Grounded Action Items**: Every recommendation must cite an actually measured metric (e.g., *"Reduce charge rate because measured temperature is 42.1°C"*).
5. **Prompt Injection Hardening**: All user-supplied notes, labels, or chat questions are treated as untrusted external data. The system prompt instructs Gemini to ignore any prompt instructions attempting to override safety rules or reveal system prompts.
6. **Structured Output Enforcement**: Gemini calls must enforce structured JSON output (`responseMimeType: 'application/json'`). Freeform markdown prose outside the JSON payload is rejected by the parser.

---

## 4. Role-Based Access Control (RBAC) Rules

RBAC policies defined in [`src/lib/permissions.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/permissions.js) must be enforced on both client UI elements and backend API routes:

```
Roles: ADMIN > OPERATOR > VIEWER
```

### 4.1 Permission Matrix

| Permission Key | Admin | Operator | Viewer | Description |
|----------------|:-----:|:--------:|:------:|-------------|
| `view_telemetry` | ✅ | ✅ | ✅ | Read live streaming telemetry and historical records |
| `control_hardware` | ✅ | ✅ | ❌ | Toggle LEDs, change buzzer sound modes, switch auto/manual |
| `manage_alerts` | ✅ | ✅ | ❌ | Acknowledge active alarms, resolve incident tickets |
| `manage_users` | ✅ | ❌ | ❌ | Create, modify roles, or deactivate team members |
| `access_ai` | ✅ | ✅ | ✅ | Query Gemini diagnostics and predictive insights |
| `export_data` | ✅ | ✅ | ✅ | Download CSV and JSON historical telemetry archives |
| `edit_settings` | ✅ | ❌ | ❌ | Change battery chemistry thresholds, API endpoints, webhooks |

### 4.2 API Route Protection
- Every mutating route (`POST`, `PUT`, `DELETE`) in `/src/app/api/` must verify caller credentials.
- If a `viewer` attempts to call `/api/control/led`, the route must return:
  ```json
  { "error": "Forbidden: Insufficient privileges to control hardware actuators", "status": 403 }
  ```

---

## 5. Coding & Repository Standards

### 5.1 Next.js & React Architecture
- **App Router Paradigm**: Utilize Next.js 14 App Router conventions. Server Components are used for static views, SEO metadata, and data fetching; Client Components (`'use client'`) are strictly isolated to interactive charts, forms, and socket listeners.
- **Client Boundary Protection**: Never import server-only modules (`mongodb.js`, `firebaseAdmin.js`, `gemini.js`) into Client Components.

### 5.2 Secret Isolation & Environment Variables
- **Rule of Least Privilege**:
  - Only variables prefixed with `NEXT_PUBLIC_` are allowed in browser code (e.g., `NEXT_PUBLIC_FIREBASE_DATABASE_URL`).
  - Sensitive secrets (`GEMINI_API_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`, `MONGODB_URI`) must **NEVER** use the `NEXT_PUBLIC_` prefix and must never appear in client bundles.
- **No Hardcoded Secrets**: Secrets must never be committed to Git. `.env.local` is git-ignored; all default references must point to `.env.example`.

### 5.3 Production Observability & Logging
- **Console Stripping**: As configured in `next.config.js`, `console.log` statements are stripped in production builds.
- **Operational Logging**: For errors, exceptions, and security alerts, engineers must use `console.warn` or `console.error` to preserve audit records in production logs.

### 5.4 Embedded Firmware Standards (ESP32)
- **Non-Blocking Operations**: The ESP32 main loop in [`BatteryVital_v13.0.ino`](file:///d:/Webapp/Working_webapps/Battery_vitals/esp32/BatteryVital_v13.0/BatteryVital_v13.0.ino) must never invoke blocking `delay()` functions for LED flashing or buzzer cadence. All timing must use `millis()` state tracking.
- **ADC Pin Discipline**: Only pins on **ADC1** (GPIO 32–39) may be used for analog sensors. Using **ADC2** pins causes silent read failures when Wi-Fi is active.
- **I2C Bus Integrity**: I2C data (GPIO 21) and clock (GPIO 22) lines must have hardware 4.7kΩ pull-up resistors to 3.3V.

### 5.5 Resilience & Graceful Degradation
- If MongoDB Atlas is temporarily unreachable, [`src/lib/auth.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/auth.js) and alerts must fall back seamlessly to in-memory caching rather than throwing unhandled runtime exceptions.
- If the Gemini API returns HTTP `429 Too Many Requests` or `503 Unavailable`, [`src/lib/gemini.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/gemini.js) must serve the cached diagnostic evaluation or return a structured fallback response containing the deterministic safety state.
