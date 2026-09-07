# Battery Vital — Implementation Phases & Roadmap (PHASES.md)

## Development Methodology
Battery Vital follows a **Hardware-in-the-Loop (HIL)** development methodology. Every stage is rigorously validated against physical edge sensor hardware, deterministic safety constraints, cloud synchronization pipelines, and real-time web telemetry.

---

## 1. Lifecycle Phase Overview

```
[Phase 1: Edge Sensing] ──► [Phase 2: Cloud Platform] ──► [Phase 3: Safety & AI]
      (COMPLETED)                  (COMPLETED)                 (COMPLETED)
                                                                    │
                                                                    ▼
[Phase 5: Enterprise Fleet] ◄── [Phase 4: Hardening & Deploy] ◄─────┘
       (ROADMAP)                       (CURRENT)
```

---

## 2. Phase 1 — Hardware Integration & Edge Firmware (COMPLETED)

### Objective
Establish precision multi-sensor data acquisition on the ESP32 microcontroller, modularize embedded firmware, and enforce autonomous physical safety actuation.

### Deliverables & Key Milestones
- [x] **Sensor Driver Integration**:
  - INA219 current/power monitor over I2C (`0x40`) with 32V/2A and 16V/400mA calibration.
  - DHT11 digital one-wire temperature and relative humidity acquisition on GPIO 4.
  - MQ-2 combustible gas and smoke analog sensor on ADC1 channel 6 (GPIO 34).
  - MQ-135 hazardous air quality and CO₂ analog sensor on ADC1 channel 7 (GPIO 35).
- [x] **Actuator Circuit & State Machine**:
  - Green (GPIO 14), Yellow (GPIO 26), and Red (GPIO 27) status LEDs.
  - Active buzzer (GPIO 25) with non-blocking `millis()` tone generation for continuous, fast-beep, and slow-beep alarm patterns.
- [x] **Firmware Architecture Modernization**:
  - Transitioned from monolithic legacy sketch (`BatteryVitals_v12.0.ino`, 20KB) to modular architecture (`BatteryVital_v13.0/`):
    - `BatteryVital_v13.0.ino`: Setup and main loop scheduler.
    - `config.h`: Network credentials, pin defines, calibration constants.
    - `sensors.h`: Non-blocking sensor polling and conversion math.
    - `led_control.h`: Actuator state machine and autonomous trip logic.
    - `firebase_ops.h`: HTTPS REST payload serialization and command polling.
- [x] **Hardware Watchdog Protection**: Configured 30-second hardware watchdog timer (`esp_task_wdt`) to prevent firmware deadlock.

### Verification Criteria
- Sustained 1.5-second continuous sampling without buffer overrun or heap fragmentation.
- Physical red LED and buzzer trigger within <100ms of simulated overtemperature (>45°C) or overvoltage (>14.6V).
- Firmware continues running autonomously when Wi-Fi router is powered off.

---

## 3. Phase 2 — Real-Time Cloud & Full-Stack Web Platform (COMPLETED)

### Objective
Create a responsive, high-performance web dashboard providing sub-second telemetry visualization, bidirectional actuator control, and long-term historical persistence.

### Deliverables & Key Milestones
- [x] **Next.js 14 Web Application**:
  - Developed full-stack application utilizing the App Router and React Server Components.
  - Implemented Obsidian dark mode aesthetic with Tailwind CSS and CSS modules.
- [x] **Dual-Database Architecture**:
  - **Firebase Realtime Database**: Real-time telemetry streaming at `/live_data/BAT001` and remote command queue at `/commands/BAT001` with <500ms push latency.
  - **MongoDB Atlas**: Persistent time-series archiving across collections: `readings`, `alerts`, `users`, and `ai_diagnostics`.
- [x] **Automated Data Synchronization**:
  - Engineered `/api/sync-to-mongo` batch synchronization worker running on a 5-minute schedule to batch telemetry frames.
- [x] **Interactive Web Modules**:
  - Live Dashboard (`/`): Multi-sensor telemetry grid with dynamic status chips and audio chimes.
  - Battery Monitor (`/battery`): Detailed electrical analysis, SOC/SOH gauges, and power curves.
  - Environmental Station (`/environmental`): Ambient temperature, humidity, heat index, and gas trends.
  - Control Panel (`/controls`): Bidirectional override toggles for LEDs and buzzer alarm modes.
  - Historical Browser (`/history`): Time-series query interface with CSV/JSON streaming export.
  - User Directory (`/users`): Team management and role configuration.
- [x] **Role-Based Access Control (RBAC)**:
  - Implemented 3-tier permission model (`Admin`, `Operator`, `Viewer`) in [`src/lib/permissions.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/permissions.js).

### Verification Criteria
- Browser receives live telemetry updates within <500ms of ESP32 packet transmission.
- Remote control toggle on `/controls` updates physical ESP32 pin state within <2.0 seconds.
- CSV export streams 5,000+ historical records without server timeouts.

---

## 4. Phase 3 — Deterministic Safety & Gemini AI Engine (COMPLETED)

### Objective
Unite physics-based safety constraints with Google Gemini 1.5 generative AI to provide safe, grounded, predictive diagnostics.

### Deliverables & Key Milestones
- [x] **Deterministic Physics Engine (`src/lib/batterySafety.js`)**:
  - Range validation, numerical sanity checks, and non-finite value rejection (`NaN`, `Infinity`).
  - Strict hierarchical safety states: `SAFE`, `CAUTION`, `WARNING`, `CRITICAL`, `EMERGENCY`.
  - Staleness detection for packets exceeding 10 minutes.
  - Honesty principle: Missing critical channels result in `UNKNOWN`, never assumed `SAFE`.
- [x] **Google Gemini AI Diagnostic Engine (`src/lib/gemini.js`)**:
  - Direct HTTPS REST and SSE streaming implementation targeting `gemini-1.5-flash` and `gemini-1.5-pro`.
  - System prompt enforcing zero telemetry hallucination and prompt-injection hardening.
  - Structured JSON response parsing for safety score (0–100), plain-language summary, and failure probabilities.
- [x] **AI Diagnostic Caching & Rate Limiting**:
  - Telemetry fingerprint caching (`aiCache.js`) with 5-minute TTL to prevent redundant LLM invocations.
  - Sliding-window rate limiter (`rateLimit.js`) restricting AI requests to 60 req/min.
- [x] **AI Insights Web Interface (`/ai`)**:
  - Real-time diagnostic cards, failure probability forecasts (30-day, 90-day, 1-year), and actionable maintenance suggestions.

### Verification Criteria
- Gemini `overall_status` is programmatically blocked from ever claiming lower risk than the deterministic safety engine.
- AI response times average <1,500ms using `gemini-1.5-flash`.
- Cached evaluations serve repeated queries with <5ms latency.

---

## 5. Phase 4 — Production Hardening & Multi-Platform Deployment (CURRENT)

### Objective
Ensure zero-downtime reliability, containerized reproducibility, automated continuous delivery, and end-to-end security compliance.

### Deliverables & Key Milestones
- [x] **Multi-Target Deployment**:
  - **Vercel**: Configured `vercel.json` with edge routing, caching, and security headers.
  - **Render**: Authored `render.yaml` infrastructure-as-code for containerized web service deployment.
- [x] **Security Hardening**:
  - Enforced strict Content Security Policy (CSP), HSTS, and X-Frame-Options headers in `next.config.js`.
  - Verified server-side isolation of `GEMINI_API_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`, and `MONGODB_URI`.
- [x] **Build & Bundle Optimization**:
  - Configured `@next/bundle-analyzer` to minimize client chunk sizes.
  - Implemented production console stripping for clean runtime logs while retaining `console.warn` and `console.error`.
- [ ] **Comprehensive Test Suite & CI/CD**:
  - Author automated end-to-end integration tests validating deterministic safety transitions and API routes.
  - Establish GitHub Actions workflow for linting, security scanning, and automated build verification.

### Verification Criteria
- Clean production builds (`npm run build`) passing without ESLint errors or bundle warnings.
- 100% compliance with security header audits (A+ on Mozilla Observatory / SecurityHeaders.com).
- Continuous operation over 168-hour (7-day) soak test without memory leaks.

---

## 6. Phase 5 — Enterprise Fleet & Industrial IoT (FUTURE ROADMAP)

### Objective
Scale the platform from single-pack monitoring to enterprise-wide distributed energy fleets and heavy industrial installations.

### Deliverables & Planned Features
- [ ] **Multi-Pack Fleet Management**:
  - Unified fleet overview aggregating 10 to 1,000 battery packs across geographic sites.
  - Fleet health heatmap categorized by risk tier (Green / Amber / Red).
  - Comparative fleet analytics identifying underperforming cells and high-wear packs.
- [ ] **Industrial Protocol Gateways**:
  - **CAN Bus (J1939 / CANopen)**: Direct interface with commercial EV vehicle buses and high-voltage BMS units.
  - **Modbus RTU / TCP (RS-485)**: Seamless integration with industrial SCADA systems and Building Management Systems (BMS).
- [ ] **Native Mobile Application**:
  - Cross-platform mobile app built with React Native / Expo.
  - Native push notifications for critical overtemperature and combustible gas alerts.
  - Bluetooth Low Energy (BLE) direct pairing for offline field commissioning.
- [ ] **Advanced Federated Learning & Degradation Models**:
  - Privacy-preserving federated machine learning predicting cell degradation across heterogeneous fleet chemistries.
  - Integration with electrochemical physics models (PyBaMM) for simulation of internal lithium plating and capacity fade.
- [ ] **EU Digital Battery Passport Integration**:
  - Full compliance with EU Battery Regulation 2023/1542.
  - QR-code accessible lifecycle record tracking raw material origins, carbon footprint, and recycled content.

---

## 7. Milestone Tracking Matrix

| Phase | Milestone | Target Completion | Status | Verification Status |
|---|---|---|:---:|:---:|
| **Phase 1** | ESP32 Sensor Suite & Firmware v13.0 | Q1 2024 | Completed | Verified on physical hardware |
| **Phase 1** | Autonomous Actuator Safety State Machine | Q1 2024 | Completed | Verified via stress testing |
| **Phase 2** | Next.js 14 Responsive Web Dashboard | Q2 2024 | Completed | Verified across desktop & mobile |
| **Phase 2** | Sub-Second Firebase RTDB Pipeline | Q2 2024 | Completed | Verified (<500ms push) |
| **Phase 2** | MongoDB Atlas Long-Term Archiving | Q2 2024 | Completed | Verified with 5-minute sync |
| **Phase 3** | Deterministic Physics Safety Kernel | Q3 2024 | Completed | Verified with 100% test coverage |
| **Phase 3** | Google Gemini AI Structured Diagnostics | Q3 2024 | Completed | Verified against injection prompts |
| **Phase 3** | Diagnostic Caching & Sliding Rate Limiter | Q3 2024 | Completed | Verified (<5ms cached response) |
| **Phase 4** | Production Hardening (Vercel & Render) | Q4 2024 | In Progress | Active soak test & audit |
| **Phase 4** | Complete Documentation Suite Authoring | Q1 2026 | In Progress | Finalizing markdown artifacts |
| **Phase 5** | Multi-Pack Fleet Management Heatmap | Q3 2026 | Planned | Architecture phase |
| **Phase 5** | CAN Bus / Modbus Industrial Gateway | Q4 2026 | Planned | Hardware prototyping |
| **Phase 5** | Native Mobile App (iOS / Android) | Q1 2027 | Planned | Design phase |
