# Battery Vital — Product Requirements Document (PRD)

## Executive Summary
Battery Vital is an industrial-grade, intelligent, real-time battery safety and environmental monitoring system engineered for Electric Vehicle (EV) battery packs, Energy Storage Systems (ESS), and stationary solar installations. It unites edge-computed multi-sensor telemetry, hardware-enforced fail-safes, cloud persistence, and Google Gemini AI diagnostics to prevent thermal runaway, detect electrical and atmospheric hazards, and optimize battery asset longevity.

---

## 1. Product Vision & Goals

### 1.1 Core Product Description
A full-stack IoT platform bridging ESP32 edge sensor nodes with real-time cloud data pipelines (Firebase Realtime Database), long-term time-series databases (MongoDB Atlas), and LLM-assisted predictive diagnostics (Google Gemini 1.5 Flash/Pro), providing:
- **Precision Electrical Telemetry**: Live voltage, current, power, shunt voltage, internal resistance, State of Charge (SOC), and State of Health (SOH).
- **Comprehensive Environmental Station**: Ambient temperature, relative humidity, heat index, dew point, combustible gas/smoke (MQ-2), and Air Quality Index (MQ-135).
- **Deterministic Hardware Safety Actuators**: Autonomous multi-color LED indicators and multi-mode buzzer alarms enforcing safety trip bounds even during network loss.
- **Role-Based Web Management Portal**: Next.js 14 responsive dashboard with Admin, Operator, and Viewer permission tiers.
- **AI Diagnostics & Predictive Failure Modeling**: Contextual explanation of telemetry anomalies, risk scoring (0–100), remaining useful life (RUL) trend estimation, and actionable maintenance suggestions.

### 1.2 Key Value Propositions
1. **Prevent Catastrophic Thermal Runaway**: Multi-stage thermal and combustible gas trip thresholds trigger immediate physical alarms before thermal runaway becomes irreversible.
2. **Deterministic Safety Superiority**: Generative AI provides contextual insights but can **never** override or downgrade deterministic hardware safety trip bounds.
3. **Lifespan Maximization**: SOH tracking, degradation rate computation, and open-circuit voltage calibration protect battery chemistry from overcharge and deep-discharge abuse.
4. **Sub-Second Fleet Visibility**: Sub-500ms real-time telemetry streaming via Firebase RTDB enables proactive monitoring for distributed storage facilities.
5. **Zero-Configuration Disaster Recovery**: Resilient local-only fallback keeps hardware audio-visual alarms functioning independently of cloud connectivity.

---

## 2. Target Users & Personas

### 2.1 Primary User Personas

#### 1. EV Fleet Operators (Priority 1)
- **Profile**: Operations engineers and fleet managers overseeing 10 to 500 electric commercial vehicles or delivery vans.
- **Pain Points**:
  - Unexpected pack failures causing vehicle downtime ($2,000–$5,000 per incident).
  - Manual periodic voltage and impedance checks are labor-intensive and prone to human error.
  - Lack of unified real-time visibility across operating vehicles and charging depots.
- **Key Use Cases**:
  - Centralized fleet view of SOC, SOH, and Battery Health Index (BHI).
  - Immediate audio-visual and dashboard alerts for overvoltage, undervoltage, and thermal drift.
  - Automated scheduling of pack maintenance based on measured internal resistance drift.
- **Success Metrics**: 40% reduction in unplanned roadside downtime; 25% battery pack lifespan extension.

#### 2. Solar & ESS System Integrators (Priority 1)
- **Profile**: Installers and maintenance contractors for residential and light-commercial solar energy storage systems (12V/24V/48V packs).
- **Pain Points**:
  - Degradation disputes and warranty claim friction due to unmonitored environmental stress (ambient heat, damp enclosures).
  - Gas buildup in enclosed battery sheds posing fire and explosion risks.
  - High truck-roll costs to diagnose minor cell imbalance or nuisance trips.
- **Key Use Cases**:
  - 24/7 continuous logging of enclosure temperature, humidity, heat index, and combustible gas.
  - Cloud-synced historical telemetry exportable as CSV/PDF audit trails for warranty validation.
  - Remote actuator diagnostics and live telemetry inspection before dispatching technicians.
- **Success Metrics**: 50% reduction in warranty claim disputes; 30% increase in customer satisfaction.

#### 3. Industrial Facility & Data Center Managers (Priority 2)
- **Profile**: Facility engineers managing critical UPS battery banks (lead-acid and lithium chemistry) for data centers, hospitals, and industrial plants.
- **Pain Points**:
  - Strict compliance mandates requiring documented atmospheric and safety monitoring in battery rooms.
  - Silent float-charge degradation that escapes periodic manual inspections.
  - Inability to tie battery room atmospheric air quality (VOCs/CO₂) to facility BMS systems.
- **Key Use Cases**:
  - Continuous MQ-135 air quality index tracking and MQ-2 smoke/gas detection.
  - Automated compliance logging with MongoDB historical storage.
  - Role-based access control preventing unauthorized tampering with hardware controls.
- **Success Metrics**: 100% safety audit compliance; zero undetected battery room thermal events.

#### 4. DIY Energy Enthusiasts & Hardware Prototypers (Priority 3)
- **Profile**: Off-grid cabin owners, hobbyist battery builders, and engineering students working with second-life 18650/21700 lithium cells or LiFePO4 packs.
- **Pain Points**:
  - High anxiety regarding DIY battery fires without expensive commercial BMS equipment.
  - Limited understanding of safe continuous current bounds and thermal runaway physics.
- **Key Use Cases**:
  - Affordable (<$100 BOM) open monitoring hardware with industrial-grade software.
  - Gemini AI natural-language explanations of battery health metrics and safety recommendations.
  - Interactive web controls to verify LED and buzzer alarm functionality.
- **Success Metrics**: Safe operation of DIY packs; positive feedback on educational AI insights.

---

## 3. Core Features & Functional Requirements

### 3.1 Precision Electrical Telemetry Monitoring
- **Hardware Sensor**: Texas Instruments INA219 Zero-Drift Bi-directional Current/Power Monitor (I2C address `0x40`, SDA: GPIO 21, SCL: GPIO 22).
- **Metrics Tracked**:
  - **Bus Voltage**: 0.0V to 26.0V (±0.8mV resolution, ±0.5% precision).
  - **Shunt Drop Voltage**: ±320mV range (±0.01mV resolution).
  - **Load Voltage**: Calculated as $V_{\text{load}} = V_{\text{bus}} + V_{\text{shunt}}$.
  - **Current Flow**: ±3.2A bidirectional (extendable to ±15.0A with external 0.01Ω shunt).
  - **Instantaneous Power**: 0W to 83W (calculated as $P = V_{\text{bus}} \times I$).
  - **Internal Resistance Estimate**: Real-time $\Delta V / \Delta I$ dynamic resistance tracking.
  - **State of Charge (SOC)**: Dynamic interpolation using calibrated Open Circuit Voltage (OCV) curves and Coulomb counting.
  - **State of Health (SOH)**: Baseline capacity retention tracking versus nominal rating.
  - **Battery Health Index (BHI)**: Multi-parameter composite penalty index (0–100) combining voltage stress, thermal stress, gas exposure, and resistance drift.
- **Sampling Frequency**: 1.5-second loop cycle.
- **Nominal Operating Windows (12V Nominal / 4S LiFePO4 / 3S Li-ion)**:
  - Normal Operating Band: 10.5V – 14.4V.
  - Deep-Discharge Emergency: <9.5V.
  - Overvoltage Trip: >14.6V.
  - Continuous Overcurrent: >15.0A.

### 3.2 Integrated Environmental Safety Station
- **Hardware Sensors**:
  - **DHT11** (Digital, GPIO 4): Temperature (0°C to 50°C ±2.0°C), Relative Humidity (20% to 80%RH ±5.0%RH).
  - **MQ-2** (Analog, GPIO 34 / ADC1_CH6): Combustible Gas, LPG, Propane, Methane, Hydrogen, Smoke (300 to 10,000 ppm).
  - **MQ-135** (Analog, GPIO 35 / ADC1_CH7): Air Quality, Ammonia, Benzene, Alcohol, Smoke, CO₂ (10 to 1,000 ppm).
- **Derived Environmental Metrics**:
  - **Heat Index (°C)**: Rothfusz regression model combining temperature and relative humidity.
  - **Dew Point (°C)**: Magnus-Tetens approximation of condensation threshold.
  - **Air Quality Index (AQI)**: Standardized 0–500 index mapping calculated from calibrated MQ-135 baseline resistance.
- **Environmental Alert Thresholds**:
  - Temperature Caution: >38.0°C.
  - Temperature Critical: >45.0°C.
  - Thermal Runaway Edge: >55.0°C.
  - MQ-2 Gas Elevated: >1,500 ADC counts / >500 ppm.
  - MQ-2 Gas Hazard Trip: >3,000 ADC counts / >800 ppm.
  - AQI Warning: >150 (Unhealthy for sensitive groups).

### 3.3 Autonomous Hardware Safety Actuation
- **Hardware Actuators**:
  - **Green LED** (GPIO 14): Normal nominal state.
  - **Yellow LED** (GPIO 26): Warning / caution state.
  - **Red LED** (GPIO 27): Critical hazard trip.
  - **Active Buzzer** (GPIO 25): Audible alarm (Silent, Slow Beep, Fast Beep, Continuous Alarm).
- **State Machine Hierarchy**:
  ```
  [Normal (Green ON)]
      │ (Temp > 38°C OR MQ2 > 500ppm OR SOC < 15% OR Volt < 10.5V)
      ▼
  [Warning (Yellow ON, Buzzer Slow Beep 2s/2s)]
      │ (Temp > 45°C OR MQ2 > 800ppm OR Volt > 14.6V OR Volt < 10.0V)
      ▼
  [Critical (Red ON, Buzzer Fast Beep 0.5s/0.5s)]
      │ (Temp > 55°C [Runaway Edge] OR MQ2 > 1500ppm [Explosion Risk] OR Volt < 9.5V)
      ▼
  [Emergency (Red Flashing, Buzzer Continuous 2.4kHz Alarm)]
  ```
- **Failsafe Invariant**: Hardware actuators operate autonomously in firmware loop. If Wi-Fi or cloud connection drops, local pins continue enforcing physical safety trips.

### 3.4 Full-Stack Next.js Web Management Platform
- **Pages & Modules**:
  1. `Live Dashboard` (`/`): Real-time multi-sensor telemetry grid, dynamic status banners, audio alarm triggers.
  2. `Battery Monitoring` (`/battery`): Deep-dive into INA219 metrics, live SOC/SOH gauges, voltage/current balance curves.
  3. `Environmental Station` (`/environmental`): Ambient temperature, humidity, heat index, dew point, MQ-2 and MQ-135 trend graphs.
  4. `Analytics & Trends` (`/analytics`): Multi-day historical telemetry analysis, peak load distribution, efficiency metrics.
  5. `Control Panel` (`/controls`): Bidirectional actuator overrides (LED toggle, buzzer sound mode, auto/manual mode switch).
  6. `AI Insights` (`/ai`): Gemini diagnostic reports, failure probability forecasts, maintenance schedule generator.
  7. `Alert Management` (`/alerts`): Live alert feed, acknowledgment workflow, configurable threshold limits.
  8. `Time-Series History` (`/history`): Tabular historical query browser with CSV and JSON data export.
  9. `Hardware Diagnostics` (`/diagnostics`): ESP32 system telemetry, Wi-Fi RSSI signal strength, heap memory, sensor probe health.
  10. `User Management` (`/users`): Team member directory, role assignment, and access audit log.
  11. `System Settings` (`/settings`): Nominal battery chemistry parameters, alert dispatch webhooks, theme toggles.

### 3.5 AI Diagnostic & Predictive Maintenance Engine
- **LLM Engine**: Google Gemini API (`gemini-1.5-flash` for high-throughput inference; `gemini-1.5-pro` for deep root-cause reasoning).
- **Input Pipeline**: Telemetry frame passes through `src/lib/batterySafety.js` validation, clamping impossible values, verifying staleness, and computing the deterministic safety state before being provided to Gemini.
- **Capabilities**:
  - **Plain-Language Summary**: Synthesizes multi-sensor telemetry into clear technical status summaries.
  - **Risk Scoring (0–100)**: Evaluates composite operational risk based on measured electrical and atmospheric stress.
  - **Degradation & Failure Probability**: Estimates 30-day, 90-day, and 1-year failure probability based strictly on observed degradation trends.
  - **Grounded Action Items**: Prescribes specific technical remediations tied directly to measured values.
- **Safety Invariants**:
  - AI can **never** fabricate telemetry or invent missing sensor channels.
  - AI risk level can **never** be lower than the deterministic engine severity ranking.
  - AI has zero direct actuator control authority; commands are strictly manual or firmware-driven.

### 3.6 Role-Based Access Control (RBAC)
- **Role Hierarchy**:
  - **Admin**: Full access across telemetry, actuator controls, threshold tuning, data export, and user management.
  - **Operator**: Operational access to telemetry, live actuator overrides, alert acknowledgment, AI reports, and data exports. No user administration.
  - **Viewer**: Read-only access to dashboard, charts, historical telemetry, and AI summaries. Actuator controls and threshold modifications are strictly locked.

### 3.7 Configurable Battery Profiles & Hardware Operating Envelope
- **Physical Hardware Constraint**: The Texas Instruments INA219 bus voltage monitor operates with a physical ceiling of 0.0V to 26.0V. To ensure a 1.0V engineering headroom margin, the system enforces a maximum allowable continuous battery voltage of **25.0V**, with a continuous current limit of **15.0A** and power rating of **200.0W**.
- **Generic Edge + Web Profile Architecture**: The ESP32 acts as a universal measurement and protection controller. The web application defines the exact battery under test and passes operating bounds to the validation engine.
- **Hardware Compatibility Engine (`src/lib/hardwareCompatibility.js`)**: Evaluates battery profiles before commissioning with typed outcome states:
  - `COMPATIBLE`: Nominal and maximum values fall safely within INA219 and shunt limits.
  - `OUT_OF_RANGE_REJECTION`: Pack maximum voltage exceeds 25.0V, continuous current exceeds 15.0A, or power exceeds 200W.
  - `UNSAFE_CONFIGURATION`: Inconsistent envelope (e.g., $V_{\text{min}} \ge V_{\text{max}}$, negative capacity, missing thermal boundaries).
  - `PROFILE_MISMATCH`: Live measured open-circuit voltage deviates by >20% from profile nominal voltage.
  - `UNKNOWN_BATTERY_STATE`: Insufficient sensor telemetry to verify chemistry bounds.
- **Profile Parameters**: Name, chemistry (`LIFEPO4`, `LI_ION`, `LEAD_ACID`, `NIMH`, `CUSTOM`), series count, parallel count, nominal voltage, min/max voltage limits, continuous/peak current, power rating, capacity (Ah/Wh), charge/discharge temperature bands, cycle life rating, serial number, cell model, manufacturer, and BMS type.
- **Visual Cross-Verification**: Multimodal AI verification (`/api/ai/profile-verify` and `/api/ai/label-scan`) allows engineers to photograph physical battery labels or upload datasheets to cross-reference configured parameters.

### 3.8 Battery Connection Lifecycle & Session Tracking
- **Automated Contact Detection**: The system continuously monitors terminal voltage across the INA219 bus to detect physical battery attachment and detachment without requiring extra mechanical switch hardware:
  - `DISCONNECTED`: Bus voltage $<0.5\text{ V}$.
  - `CONNECTING`: Voltage rises above $0.5\text{ V}$ but remains unstable for $<3\text{ seconds}$.
  - `STABILIZING`: In-rush capacitive settling period ($3–10\text{ seconds}$).
  - `CONNECTED`: Voltage stabilized within expected chemistry band; normal telemetry logging begins.
  - `UNSTABLE_CONTACT`: Intermittent voltage fluctuations ($>1.5\text{ V}$ variation in $<1\text{ s}$) indicative of loose terminals or contactor bounce.
  - `DISCONNECTING`: Sudden drop towards $0\text{ V}$ under non-load conditions.
- **Session Identification (`src/lib/connectionEvents.js`)**: Each continuous attachment generates a cryptographically random UUIDv4 `sessionId`. All electrical metrics, peak temperatures, Ampere-hour throughput, and anomalous events are scoped to this session in MongoDB `connection_events`.

### 3.9 Fault Latching & Latched Recovery State Machine
- **Non-Clearing Hazard Protection (`src/lib/batterySafety.js`)**: Transient sensor recovery must not mask serious historical electrical or thermal incidents.
- **State Machine Hierarchy**:
  ```
  SAFE (0) < CAUTION (1) < WARNING (2) < CRITICAL (3) < EMERGENCY (4)
  ```
- **Latching Invariant (`evaluateLatchedSafety`)**:
  - If a system trips to `CRITICAL` or `EMERGENCY` (e.g., cell temperature exceeded 50°C or gas spiked above 800 ppm), the system latches into `RECOVERY` even if ambient temperatures drop back to nominal.
  - The system remains latched in `RECOVERY` (maintaining audio-visual warnings) until an authenticated operator or admin dispatches an explicit `manualReset` command.

### 3.10 Derived Electrical & Behavioral Analytics (`src/lib/batteryAnalytics.js`)
- **Dynamic Voltage Sag Analysis (`analyzeVoltageSag`)**: Quantifies terminal voltage drops under load onset ($\Delta V = V_{\text{before}} - V_{\text{after}}$) relative to current step jump ($\Delta I = I_{\text{after}} - I_{\text{before}}$). Computes instantaneous load impedance $R_{\text{sag}} = \Delta V / \Delta I$ and classifies sag severity (`NORMAL`, `MODERATE`, `SEVERE`).
- **Current Oscillation Detection (`detectAbnormalCurrentOscillation`)**: Analyzes time-series standard deviation and polarity shift frequency to flag contactor chattering, faulty solar MPPT charge hunting, or loose high-resistance terminations.
- **Profile Inconsistency Monitoring (`checkProfileInconsistency`)**: Continuously compares real-time telemetry against the active battery profile, triggering immediate operator alerts if charging voltage exceeds profile max or discharge current exceeds C-rate limits.

### 3.11 Deterministic Fault Fingerprinting & Recurrence Deduplication
- **SHA-256 Signature Generation (`src/lib/faultFingerprint.js`)**: Generates deterministic hashes based on `deviceId + failureType + metricViolated + severityBucket`.
- **Sliding-Window Correlation**: Multiple identical alarm triggers occurring within a 60-second window are consolidated into a single incident with an incremental recurrence counter (`recurrenceCount × N`), eliminating alert feed fatigue while highlighting chronic repeating faults.

### 3.12 Hardware Boot Self-Test & Diagnostics
- **8-Point Power-On Verification (`selftest.h`)**: At boot, the ESP32 performs an autonomous 8-check diagnostic sweep:
  1. `ina_ack`: I2C handshake acknowledgment from INA219 at address `0x40`.
  2. `dht_ok`: Successful digital read from DHT11 on GPIO 4.
  3. `mq2_ok`: Analog ADC reading $>50$ counts on GPIO 34 (verifies heater continuity).
  4. `mq135_ok`: Analog ADC reading $>50$ counts on GPIO 35.
  5. `gpio_ok`: Test toggle of status pin registers.
  6. `buzzer_ok`: 50ms audible confirmation chirp on GPIO 25.
  7. `wifi_ok`: Station association and IP assignment.
  8. `config_ok`: Validation of non-volatile configuration memory.
- Results are published to Firebase RTDB under `/live_data/{deviceId}/self_test` and visualized in the `/diagnostics` hardware matrix.

### 3.13 Shunt Zero-Current Offset Calibration & Dynamic Confidence
- **Remote Zero-Current Calibration (`CALIBRATE_ZERO`)**: Operators can trigger shunt zero-offset calibration via `/api/battery/calibrate`. The ESP32 samples 50 consecutive readings with load disconnected, computes the offset delta, stores it in NVS, and applies it to all subsequent current and power measurements.
- **Dynamic Sensor Confidence Gating (`src/lib/batterySafety.js` & `sensors.h`)**:
  - `inaConfidence`: 1.0 under nominal operation; 0.0 upon I2C bus lockup.
  - `dhtConfidence`: 1.0 under valid checksum; degrades upon timing errors.
  - `mqConfidence`: Scaled from 0.2 to 1.0 during the mandatory 180-second gas sensor heater warmup phase.
  - Safety calculations weight gas sensor hazard readings by `mqConfidence`, preventing false thermal runaway alarms while heaters burn off atmospheric moisture during startup.

### 3.14 AI Free-Tier Operational Resilience & Multi-Provider Architecture
- **Zero-Cost Free-Tier Guardrail (`src/lib/aiModels.js`)**: Enforces an explicit allowlist of free models (`gemini-1.5-flash`, `gemini-1.5-pro`, `liquid/lfm-40b:free`). Calling non-whitelisted paid models throws an immediate `ConfigurationError`.
- **Multi-Provider Fallback Cascade (`src/lib/aiProvider.js`)**:
  1. Primary: Google Gemini 1.5 Flash via Generative Language API.
  2. Secondary Fallback: OpenRouter Free Tier (`liquid/lfm-40b:free`) with required headers (`HTTP-Referer`, `X-Title`).
  3. Tertiary Deterministic Fallback: Static rule-based diagnostics derived directly from deterministic safety engine flags.
- **Operational Guardrails**:
  - Daily request caps (1,400 calls/day on Gemini) with in-memory quota tracking.
  - Per-task request deduplication within 30-second windows.
  - Granular per-task timeouts via `AbortController` (12s for analysis, 15s for vision).
  - Circuit breakers preventing cascading external provider failures.
- **Sensor-Fusion Explanation Mode**: When Battery Health Index (BHI) is elevated, the prompt forces the AI model to explicitly cite which sensor channels (`voltage`, `temperature`, `gas`, `current`) drove the penalty score.

### 3.15 Digital Battery Passport & Provenance (`/passport`)
- **EU Battery Regulation Compliance Alignment**: Comprehensive battery asset passport displaying:
  - Battery identification, serial number, chemistry, and nominal specifications.
  - Real-time SOH, BHI, and cumulative session connection history.
  - Complete fingerprinted fault log with recurrence multipliers.
  - Provenance box documenting manufacturer, cell model, installation date, and rated cycle life.

---

## 4. Non-Functional Requirements (NFRs)

### 4.1 Latency & Performance
- **Telemetry Ingest**: ESP32 pushes sensor frames to Firebase RTDB every 1,500ms.
- **Client Push Latency**: Web browsers receive live telemetry updates within <500ms via WebSocket subscription.
- **Bidirectional Control Latency**: Actuator commands dispatched from the web UI are executed by the ESP32 within <2,000ms.
- **AI Diagnostic Latency**: Gemini inference completed within <2,500ms using `gemini-1.5-flash`.
- **Database Sync Interval**: Firebase RTDB batches synchronize to MongoDB Atlas every 5 minutes.

### 4.2 Reliability & Availability
- **System Uptime**: 99.5% target availability for cloud web platform and APIs.
- **Edge Fault Tolerance**: Hardware safety loop continues executing uninterrupted during Wi-Fi disconnects, router crashes, or cloud outages.
- **Watchdog Protection**: 30-second hardware watchdog timer (`esp_task_wdt`) auto-reboots ESP32 in the event of firmware lockup.
- **Data Persistence**: Telemetry retained in Firebase RTDB for 90 days; long-term time-series retained in MongoDB Atlas for up to 5 years.

### 4.3 Security & Integrity
- **Transport Encryption**: Enforce TLS 1.3 across all client-to-cloud and ESP32-to-Firebase HTTPS/WSS connections.
- **Secret Isolation**: Server-side API keys (`GEMINI_API_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`, `MONGODB_URI`) are strictly isolated to server runtime and never exposed in browser bundles.
- **API Rate Limiting**: In-memory sliding-window limiter protecting AI endpoints (60 req/min), command dispatch (120 req/min), and export queries (10 req/hr).
- **Deterministic Input Sanitization**: Sensor inputs outside plausible physical bounds are flagged and stripped prior to database entry and LLM consumption.

### 4.4 Standards & Environmental Alignment
- **UL 1973 / UL 9540A Alignment**: Adheres to energy storage safety practices by monitoring thermal runaway precursor gases (combustible hydrocarbons and VOCs) alongside cell temperature.
- **EPA Air Quality Index**: Standardized AQI calculations for atmospheric health monitoring in inhabited battery rooms.

---

## 5. Success Metrics & Key Performance Indicators (KPIs)

| Metric | Target | Verification Method |
|--------|--------|---------------------|
| **Thermal Precursor Detection** | 100% of elevated gas/temp events detected | Hardware environmental stress testing |
| **Telemetry Ingest Latency** | <500ms push to browser | Network timeline audit via Chrome DevTools |
| **Edge Autonomy** | 0 safety failures during Wi-Fi drops | Physical disconnect verification |
| **AI Hallucination Rate** | 0 fabricated telemetry points | Automated unit assertions on structured AI outputs |
| **False Positive Alarm Rate** | <1.0% under stable conditions | 72-hour continuous burn-in logging |
| **Battery Lifespan Impact** | 20–25% improvement in cycle life | SOH degradation tracking vs unmanaged baseline |

---

## 6. Out of Scope (Explicitly Deferred)

1. **High-Voltage Contactor / Solid-State Relay Disconnect**: Direct physical battery power cut-off is left to external BMS circuit breakers to avoid hardware liability.
2. **Native iOS/Android App**: Focus is placed on responsive PWA web design; native React Native shell is deferred to Phase 5.
3. **Complex Chemistry Auto-Detection**: Cell chemistry defaults to LiFePO4 4S (12.8V) / Li-ion 3S (11.1V) / Lead-Acid (12.0V) and must be configured in settings.
4. **On-Device Edge Neural Networks**: All AI reasoning is executed via Google Gemini cloud APIs; edge ESP32 executes strictly deterministic C++ math.

---

## 7. Technical Glossary

- **AQI**: Air Quality Index (standardized scale from 0 to 500 indicating air purity).
- **BHI**: Battery Health Index (0–100 composite operational penalty score).
- **Coulomb Counting**: Method of tracking charge accumulation by integrating current over time ($\int I \, dt$).
- **Dew Point**: Temperature at which ambient water vapor condenses into liquid dew.
- **Heat Index**: Perceived temperature combining dry-bulb ambient temperature with relative humidity.
- **OCV**: Open Circuit Voltage (equilibrium battery terminal voltage with zero load).
- **RUL**: Remaining Useful Life (estimated operational duration before battery capacity drops below 80% SOH).
- **SOC**: State of Charge (remaining usable energy expressed as 0–100%).
- **SOH**: State of Health (ratio of current maximum capacity versus original nameplate rating).
- **Thermal Runaway**: Self-sustaining exothermic reaction caused by internal short circuit or overtemperature leading to rapid catastrophic failure.
