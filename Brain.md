# Brain.md — Battery Vital: Intelligent Battery Safety & Environmental Monitoring System

> Complete knowledge base and architectural handbook for engineers, operators, and AI agents working with this codebase.  
> Last updated: September 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture & Data Flow](#2-system-architecture--data-flow)
3. [Hardware Integration & Sensor Suite](#3-hardware-integration--sensor-suite)
4. [Core Safety & Physics Engine](#4-core-safety--physics-engine)
5. [Technical Stack](#5-technical-stack)
6. [Complete File Structure](#6-complete-file-structure)
7. [Setup & Installation](#7-setup--installation)
8. [Features & Web Modules](#8-features--web-modules)
9. [Database Design (Firebase & MongoDB)](#9-database-design-firebase--mongodb)
10. [REST API Documentation](#10-rest-api-documentation)
11. [AI Diagnostics Engine (Gemini Integration)](#11-ai-diagnostics-engine-gemini-integration)
12. [Role-Based Access Control (RBAC) & Security](#12-role-based-access-control-rbac--security)
13. [Workflows & Data Sync Strategy](#13-workflows--data-sync-strategy)
14. [Testing & Verification](#14-testing--verification)
15. [Deployment & DevOps](#15-deployment--devops)
16. [Future Enhancements & Roadmap](#16-future-enhancements--roadmap)

---

## 1. Project Overview

### What Is Battery Vital?

**Battery Vital** is an industrial-grade, full-stack real-time battery safety and environmental monitoring platform for Electric Vehicle (EV) packs, Energy Storage Systems (ESS), and stationary solar battery banks. It bridges low-latency hardware edge telemetry with cloud persistence and Google Gemini AI predictive diagnostics.

### Core Mission

- **Real-Time Precision Monitoring**: High-accuracy voltage, current, power, shunt drop, temperature, humidity, and gas leak detection.
- **Deterministic Hardware Safety**: Physics-informed threshold evaluation and hardware actuator safety lockouts — AI interprets data but cannot override hard physical trip bounds.
- **Multi-Sensor Ambient Sensing**: Integrated environmental safety station measuring heat index, dew point, combustible gas/smoke (MQ-2), and Air Quality Index (MQ-135).
- **Multi-User Collaboration & RBAC**: Admin, Operator, and Viewer permissions controlling telemetry visibility, alert management, and remote actuator commands.
- **Bidirectional Control**: Low-latency remote command pipeline dispatching LED states, buzzer alarm patterns, and auto/manual modes to ESP32 nodes over Firebase RTDB.

---

## 2. System Architecture & Data Flow

```
ESP32 Sensor Hub (Multi-sensor Platform)
   │
   ├─ INA219 (I2C 0x40 - SDA 21, SCL 22) ──► Voltage, Current, Power, Shunt Drop
   ├─ DHT11 (GPIO4) ───────────────────────► Temperature, Humidity, Heat Index  
   ├─ MQ-2 (GPIO34) ───────────────────────► LPG, Combustible Gas, Smoke (ppm)
   ├─ MQ-135 (GPIO35) ─────────────────────► Air Quality, CO₂, VOCs (AQI)
   │
   │  HTTPS (Firebase SDK / REST)
   ▼
Firebase Realtime Database ─────────────────► Web Dashboard (useFirebase, instant push)
   │                                          ├─ Multi-user live sessions
   │                                          ├─ Real-time gauges & charts
   │                                          └─ Audio/visual alarm alerts
   │
   │  Background Sync (/api/sync-to-mongo)
   ▼
MongoDB Atlas ──────────────────────────────► Historical Archive & Analytics
   │                                          ├─ readings (time-series)
   │                                          ├─ alerts (historical event feed)
   │                                          ├─ users (RBAC profiles & sessions)
   │                                          └─ ai_diagnostics (AI evaluation logs)
   │
   ▼
Gemini AI Engine (gemini-1.5-flash / pro)
   ├─ Real-time safety analysis & risk scoring
   ├─ Predictive maintenance scheduling
   ├─ Remaining useful life & degradation estimation
   └─ Ambient hazard mitigations

Hardware Actuators (ESP32)
   ├─ Green LED (GPIO14)  ─────────────────► Normal nominal state
   ├─ Yellow LED (GPIO26) ─────────────────► Warning / elevated reading
   ├─ Red LED (GPIO27)    ─────────────────► Critical alert / hazard trip
   └─ Buzzer (GPIO25)     ─────────────────► Audible alarm (continuous, fast beep, slow beep)
```

### Telemetry Pipeline
1. **ESP32 Node** samples sensors every 1.5 seconds, evaluates internal safety thresholds, drives hardware LEDs/Buzzer, and pushes JSON packets to `/live_data/BAT001`.
2. **Firebase Realtime Database** pushes delta updates to subscribed web browsers with sub-second latency.
3. **Next.js Web Clients** render gauges, time-series charts, and trigger audio chimes upon threshold violations.
4. **Backend Sync Engine** periodically batches Firebase frames into MongoDB Atlas `readings` collection for long-term historical querying.
5. **Gemini AI Engine** assesses real-time telemetry, generates structured diagnostics, and computes failure probability forecasts.

---

## 3. Hardware Integration & Sensor Suite

### ESP32 Pin Assignment

```cpp
// ── I2C Sensors (INA219) ──
#define SDA_PIN             21    // I2C Data
#define SCL_PIN             22    // I2C Clock
#define INA219_I2C_ADDR     0x40

// ── Digital Sensors (DHT11) ──
#define DHT_PIN             4     // DHT11 Temperature & Humidity

// ── Analog Sensors (Gas & Air Quality) ──
#define MQ2_PIN             34    // MQ-2 LPG / Smoke Sensor (ADC1_CH6)
#define MQ135_PIN           35    // MQ-135 Air Quality / CO2 (ADC1_CH7)

// ── Actuator Outputs ──
#define BUZZER_PIN          25    // Active Buzzer
#define LED_GREEN           14    // Normal Operation Indicator
#define LED_YELLOW          26    // Warning State Indicator
#define LED_RED             27    // Critical Alert Indicator
```

### Sensor Specifications

| Sensor | Interface | Measurement | Operating Range | Accuracy / Resolution |
|--------|-----------|-------------|-----------------|-----------------------|
| **INA219** | I2C (0x40) | Bus Voltage | 0 – 26 V | ±0.8 mV |
|            |            | Current | ±3.2 A (Extendable) | ±0.8 mA |
|            |            | Shunt Voltage | ±320 mV | ±0.01 mV |
|            |            | Power | 0 – 83 W | Calculated (V × I) |
| **DHT11** | Digital (GPIO4) | Temperature | 0 – 50 °C | ±2.0 °C |
|           |                 | Humidity | 20 – 80 %RH | ±5.0 %RH |
| **MQ-2** | Analog (GPIO34) | LPG & Smoke | 300 – 10,000 ppm | Curve approximated |
| **MQ-135**| Analog (GPIO35) | Air Quality & CO₂ | 10 – 1,000 ppm | Standard AQI model |

### LED Status Indicators

| LED Color | GPIO | System State | Trigger Condition |
|-----------|------|--------------|-------------------|
| 🟢 **Green** | 14 | Normal | Voltage: 10.5–14.4V, Temp < 38°C, MQ-2 < 500 ppm |
| 🟡 **Yellow** | 26 | Warning | Temp: 38–45°C, MQ-2: 500–800 ppm, SOC < 15% |
| 🔴 **Red** | 27 | Critical | Voltage > 14.6V or < 10.5V, Temp > 45°C, MQ-2 > 800 ppm |

### Buzzer Sound Modes

| Pattern | Sound Sequence | Condition |
|---------|----------------|-----------|
| **Continuous** | Solid 2.4 kHz tone | Critical battery trip, thermal runaway risk, gas emergency |
| **Fast Beep** | 0.5s ON / 0.5s OFF | Warning threshold exceeded |
| **Slow Beep** | 2.0s ON / 2.0s OFF | Minor anomaly detected or acknowledged event |
| **Off** | Silent | Normal operation |

---

## 4. Core Safety & Physics Engine

### Deterministic Safety Rules (`src/lib/batterySafety.js`)

The platform enforces deterministic evaluation over raw sensor frames:
- **Voltage Band**: 10.5V – 14.6V (12V nominal Lead-Acid / 3S Li-ion).
- **Current Band**: ±15.0A maximum continuous threshold.
- **Thermal Threshold**: Warning at 38°C, Critical Trip at 45°C, Emergency at 55°C.
- **MQ-2 Gas Threshold**: Clean < 400 ppm, Warning > 500 ppm, Critical > 800 ppm.
- **SOC Calculation**: Linear Open-Circuit Voltage interpolation with Coulomb counting.

```
Safety State Hierarchy:
SAFE (0) < CAUTION (1) < WARNING (2) < CRITICAL (3) < EMERGENCY (4)
```

> [!IMPORTANT]
> **Safety Invariant**: AI diagnostics from Gemini can provide contextual explanations and suggestions, but the system's `overall_status` may **NEVER** claim a lower risk level than the deterministic safety engine verdict.

---

## 5. Technical Stack

### Frontend
- **Next.js 14.0.4** (App Router) — Server & client components, streaming routes.
- **React 18.2.0** — High-performance reactive UI.
- **Tailwind CSS & CSS Modules** — Obsidian dark mode palette, responsive glassmorphism.
- **Recharts 2.10.3** — Real-time telemetry, multi-metric curves, and area graphs.
- **Lucide React 0.294.0** — Iconography system.

### Backend & Storage
- **Firebase Realtime Database & Admin SDK 14.3.0** — Sub-second streaming & remote command polling.
- **MongoDB Atlas & Node Driver 6.3.0** — Persistent time-series telemetry, user profiles, alert logs.
- **Google Gemini API** (`gemini-1.5-flash` / `gemini-1.5-pro`) — AI safety diagnostics & RUL forecasting.

---

## 6. Complete File Structure

```
Battery_vitals/
├── .env.example                  # Environment variable template
├── .eslintrc.json                # ESLint configuration
├── next.config.js                # Next.js security headers & build config
├── package.json                  # Dependencies and scripts
├── README.md                     # Comprehensive project documentation
├── Brain.md                      # System architecture & AI knowledge base
│
├── esp32/
│   ├── BatteryVitals_v12.0.ino   # Legacy monolithic firmware
│   └── BatteryVital_v13.0/       # Modular production firmware
│       ├── BatteryVital_v13.0.ino # Main Arduino sketch
│       ├── config.h              # Pin mappings, WiFi & Firebase credentials
│       ├── sensors.h             # INA219, DHT11, MQ-2, MQ-135 reading routines
│       ├── led_control.h         # Status LEDs & buzzer alarm modes
│       └── firebase_ops.h        # RTDB payload publish & command listener
│
├── public/                       # PWA assets, manifest, icons, sound chimes
│
└── src/
    ├── app/                      # Next.js App Router Pages & APIs
    │   ├── page.js               # 🏠 Live Dashboard (multi-sensor grid)
    │   ├── battery/              # 🔋 Dedicated Battery Monitoring View
    │   │   └── page.js           # INA219 metrics, SOC tracking, cell balance
    │   ├── environmental/        # 🌡️ Environmental Station View
    │   │   └── page.js           # DHT11 temp/humidity, MQ-2/135 gas, AQI
    │   ├── analytics/            # 📊 Analytics & historical trend analysis
    │   │   └── page.js
    │   ├── controls/             # 🎛️ Actuator control panel (LED/Buzzer)
    │   │   └── page.js
    │   ├── ai/                   # 🤖 AI insights & failure predictions
    │   │   └── page.js
    │   ├── alerts/               # 🚨 Alert feed & threshold configuration
    │   │   └── page.js
    │   ├── history/              # 📜 Time-series browser & data export
    │   │   └── page.js
    │   ├── diagnostics/          # 🔧 Hardware diagnostics & RSSI telemetry
    │   │   └── page.js
    │   ├── users/                # 👥 User management & RBAC matrix
    │   │   └── page.js
    │   ├── settings/             # ⚙️ Battery & system preferences
    │   │   └── page.js
    │   ├── passport/             # 🛡️ Battery digital passport slideout
    │   ├── about/                # ℹ️ About & documentation
    │   ├── privacy/              # 🔒 Privacy policy
    │   ├── terms/                # ⚖️ Terms of service
    │   │
    │   └── api/                  # Backend REST API Endpoints
    │       ├── health/           # GET / — System health check
    │       ├── status/           # GET / — Real-time device status summary
    │       ├── telemetry/        # GET/POST / — Sensor frame snapshot & ingest
    │       ├── battery/
    │       │   ├── latest/       # GET / — Latest INA219 readings
    │       │   ├── history/      # GET / — Historical battery time-series
    │       │   ├── soc/          # GET / — SOC & runtime estimation
    │       │   └── health/       # GET / — BHI, SOH & degradation rate
    │       ├── environmental/
    │       │   ├── latest/       # GET / — Current temp, humidity, gas ppm
    │       │   ├── history/      # GET / — Environmental trend history
    │       │   ├── air-quality/  # GET / — Calculated AQI & pollutants
    │       │   └── alerts/       # GET / — Environmental threshold violations
    │       ├── control/
    │       │   ├── led/          # POST / — Green/Yellow/Red LED control
    │       │   ├── buzzer/       # POST / — Buzzer pattern mode trigger
    │       │   └── status/       # GET / — Hardware actuator output states
    │       ├── commands/         # POST / — Dispatch command to ESP32
    │       ├── analyze/          # POST / — Gemini AI safety analysis
    │       ├── predictions/      # GET/POST / — AI failure predictions
    │       ├── insights/         # GET / — Real-time AI recommendations
    │       ├── anomalies/        # GET / — Real-time anomaly detection
    │       ├── alerts/
    │       │   ├── route.js      # GET/POST / — Alert CRUD
    │       │   ├── config/       # GET/PUT / — Alert threshold settings
    │       │   └── [id]/         # PUT/DELETE / — Acknowledge / dismiss alert
    │       ├── users/
    │       │   ├── route.js      # GET/POST / — User list & creation
    │       │   ├── [id]/         # GET/PUT/DELETE / — User CRUD
    │       │   └── me/           # GET / — Active user profile & permissions
    │       ├── auth/
    │       │   ├── login/        # POST / — User authentication
    │       │   └── logout/       # POST / — Session termination
    │       ├── sync-to-mongo/    # POST / — Firebase → MongoDB delta sync
    │       └── export/           # GET / — CSV, JSON, PDF export
    │
    ├── lib/                      # Shared Server & Client Utilities
    │   ├── firebase.js           # Client Firebase initialization
    │   ├── firebaseAdmin.js      # Server Firebase Admin SDK
    │   ├── mongodb.js            # MongoDB connection pool
    │   ├── gemini.js             # Gemini AI wrapper & prompts
    │   ├── auth.js               # User management & session helpers
    │   ├── permissions.js        # RBAC permissions & role checking
    │   ├── batterySafety.js      # Deterministic safety rule engine
    │   ├── rateLimit.js          # In-memory sliding window rate limiter
    │   ├── security.js           # Parameter sanitization & error masks
    │   └── utils.js              # Formatting, unit conversions, chimes
    │
    ├── hooks/                    # Custom React Hooks
    │   ├── useFirebase.js        # RTDB real-time listener
    │   ├── useRealTimeData.js    # Aggregated live telemetry stream
    │   ├── useBattery.js         # INA219 metrics, SOC & cell balance hook
    │   ├── useEnvironmental.js   # DHT11, MQ-2, MQ-135, AQI hook
    │   ├── useAuth.js            # User session & RBAC hook
    │   ├── useAI.js              # AI diagnostics & chat hook
    │   ├── useTheme.js           # Dark/light mode switcher
    │   └── useKeyboardShortcuts.js # Global hotkeys (Ctrl+K, ?, etc.)
    │
    └── components/               # UI Component Hierarchy
        ├── layout/
        │   ├── Header.jsx        # Navigation bar & live status badge
        │   ├── MobileNav.jsx     # Mobile slide-out drawer
        │   └── Layout.jsx        # Main application shell
        ├── battery/
        │   ├── BatteryStatus.jsx # Health & BHI score overview
        │   ├── SOCIndicator.jsx  # Circular State of Charge gauge
        │   └── PowerMetrics.jsx  # Voltage, current, power, shunt grid
        ├── environmental/
        │   ├── TempHumidity.jsx  # DHT11 temperature & humidity cards
        │   ├── GasDetection.jsx  # MQ-2 & MQ-135 gas ppm monitors
        │   └── AirQualityIndex.jsx # AQI rating & spectrum breakdown
        ├── charts/
        │   ├── LiveChart.jsx     # Real-time multi-line chart
        │   ├── EnvironmentalChart.jsx # Ambient temp, hum, gas curves
        │   ├── HistoryChart.jsx  # Multi-metric historical area chart
        │   └── GaugeChart.jsx    # Semi-circular radial gauge
        ├── dashboard/
        │   ├── LiveDashboard.jsx # Modular dashboard layout wrapper
        │   ├── SensorGrid.jsx    # Multi-sensor overview widget
        │   └── StatusIndicator.jsx # Live LED & Buzzer feedback
        ├── controls/
        │   ├── ControlPanel.jsx  # Actuator override master panel
        │   ├── LEDControl.jsx    # Status LED toggles
        │   └── BuzzerControl.jsx # Buzzer alarm pattern selector
        ├── alerts/
        │   ├── AlertsList.jsx    # Live alert feed
        │   ├── AlertCard.jsx     # Individual alert card with actions
        │   └── AlertConfig.jsx   # Custom safety threshold editor
        └── ai/
            ├── AIInsights.jsx    # Gemini diagnostic display
            ├── Predictions.jsx   # Predictive failure forecast cards
            └── Recommendations.jsx # Actionable AI suggestions
```

---

## 7. Setup & Installation

### 1. Environment Configuration (`.env.local`)

```env
# Firebase Web App Config (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef

# Firebase Admin SDK (Server)
FIREBASE_ADMIN_PROJECT_ID=your-project
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/battery_vital?retryWrites=true&w=majority

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...

# App Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 2. Run Locally

```bash
npm install
npm run dev
# App will launch on http://localhost:3000
```

---

## 8. Features & Web Modules

### 1. 🏠 Live Dashboard (`/`)
- Real-time multi-sensor telemetry grid: INA219 Bus/Load Voltage, Current, Power, Shunt Drop.
- DHT11 ambient Temperature, Humidity, MQ-2 Gas/Smoke, MQ-135 AQI.
- Live streaming chart with rolling buffer.
- Hardware status feedback for Green/Yellow/Red LEDs and Active Buzzer.
- Audio alert chime with Web Audio API.

### 2. 🔋 Battery Monitor (`/battery`)
- Detailed INA219 metrics with resolution down to ±0.8 mV and ±0.8 mA.
- State of Charge (SOC) radial gauge with remaining capacity in Ah.
- Remaining runtime estimate (discharge time-to-empty / charge time-to-full).
- Cell balance distribution for 3S/4S pack configurations.
- Battery Health Index (BHI) degradation score.

### 3. 🌡️ Environmental Station (`/environmental`)
- High-precision DHT11 Temperature and Humidity tracking.
- Calculated Heat Index and Dew Point.
- MQ-2 LPG & Combustible Gas / Smoke monitor (300–10,000 ppm).
- MQ-135 Air Quality & CO₂ analyzer with 6-level standard AQI rating.
- Environmental threshold violation tracker with instant alert dispatch.

### 4. 🎛️ Control Panel (`/controls`)
- Manual actuator override for Green (GPIO14), Yellow (GPIO26), and Red (GPIO27) LEDs.
- Active Buzzer alarm mode selector (Continuous, Fast Beep, Slow Beep, Mute).
- Auto/Manual safety lock with 30-minute auto-revert countdown timer.
- Command dispatch audit log displaying round-trip latency.

### 5. 🤖 AI Insights (`/ai`)
- Gemini AI real-time safety evaluation & risk scoring (0–100).
- Predictive maintenance scheduler with recommended service dates.
- Failure probability forecasts for 30-day, 90-day, and 1-year horizons.
- Actionable thermal and electrical mitigation recommendations.

### 6. 🚨 Alerts (`/alerts`)
- Active, acknowledged, and historical alert feed.
- Severity filtering: Critical, Warning, Info.
- Custom safety threshold configuration panel (`/api/alerts/config`).
- Audible chimes for fresh critical events.

### 7. 👥 Users & Roles (`/users`)
- Multi-user team management with Role-Based Access Control (Admin, Operator, Viewer).
- Role permissions matrix.
- Team member invite, update, and delete actions.
- Simulated active user switcher for testing role capabilities.

### 8. 📊 Analytics & 📜 History (`/analytics`, `/history`)
- Historical time-series record browser powered by MongoDB Atlas.
- Charge cycle degradation analysis and energy efficiency reports.
- Data export in CSV, JSON, and PDF audit reports.

---

## 9. Database Design (Firebase & MongoDB)

### Firebase Realtime Database

```json
{
  "live_data": {
    "BAT001": {
      "timestamp": 1718000000,
      "battery": {
        "voltage": 12.6,
        "current": 2.5,
        "power": 31.5,
        "shuntVoltage": 0.025,
        "loadVoltage": 12.625,
        "soc": 85,
        "soh": 98,
        "bhi": 94,
        "safety": "SAFE"
      },
      "environmental": {
        "temperature": 25.3,
        "humidity": 58.0,
        "mq2": 340,
        "mq135": 115,
        "aqi": 42
      },
      "hardware": {
        "auto_mode": true,
        "led_green": true,
        "led_yellow": false,
        "led_red": false,
        "buzzer": false
      }
    }
  },
  "commands": {
    "BAT001": {
      "auto_mode": true,
      "green_led": true,
      "yellow_led": false,
      "red_led": false,
      "buzzer": false,
      "buzzer_mode": "off",
      "updatedAt": 1718000000
    }
  }
}
```

### MongoDB Collections

- **`readings`**: Time-series telemetry logs synced from Firebase.
- **`live_data`**: Latest snapshot per battery pack.
- **`alerts`**: Real-time and historical alert events with acknowledgment states.
- **`users`**: User profiles, credentials, assigned roles (`admin`, `operator`, `viewer`).
- **`settings`**: Custom safety threshold configuration documents.
- **`ai_diagnostics`**: Cached Gemini AI evaluation records.
- **`commands`**: Actuator command state audit logs.

---

## 10. REST API Documentation

### Summary Table

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Core** | `/api/health` | GET | System health & DB connection check |
| | `/api/status` | GET | Real-time device connectivity summary |
| | `/api/telemetry` | GET / POST | Sensor frame snapshot / ingest |
| | `/api/sync-to-mongo` | POST | Firebase → MongoDB background sync |
| | `/api/export` | GET | Export historical dataset (CSV/JSON/PDF) |
| **Battery** | `/api/battery/latest` | GET | Latest INA219 metrics |
| | `/api/battery/history` | GET | Historical battery telemetry |
| | `/api/battery/soc` | GET | SOC estimation & runtime calculations |
| | `/api/battery/health` | GET | BHI score, SOH, degradation rate |
| **Environmental** | `/api/environmental/latest` | GET | Current DHT11 & MQ-2/135 readings |
| | `/api/environmental/history` | GET | Ambient time-series history |
| | `/api/environmental/air-quality` | GET | AQI spectrum & pollutant breakdown |
| | `/api/environmental/alerts` | GET | Environmental threshold violations |
| **Controls** | `/api/control/led` | POST | Green/Yellow/Red LED control |
| | `/api/control/buzzer` | POST | Buzzer mode trigger (continuous/beep/off) |
| | `/api/control/status` | GET | Read hardware actuator output states |
| | `/api/commands` | POST | Dispatch actuator command packet to ESP32 |
| **AI & Alerts** | `/api/analyze` | POST | Gemini AI structured safety diagnostics |
| | `/api/predictions` | GET / POST | Failure probability & lifespan prediction |
| | `/api/insights` | GET | Real-time AI recommendations |
| | `/api/anomalies` | GET | Real-time electrical anomaly detection |
| | `/api/alerts` | GET / POST | Alert feed CRUD |
| | `/api/alerts/[id]` | PUT / DELETE | Acknowledge or dismiss alert |
| | `/api/alerts/config` | GET / PUT | Custom safety threshold configuration |
| **Users & Auth** | `/api/users` | GET / POST | List team members / create user |
| | `/api/users/[id]` | GET / PUT / DELETE | Individual user CRUD |
| | `/api/users/me` | GET | Active user profile & session permissions |
| | `/api/auth/login` | POST | User authentication |
| | `/api/auth/logout` | POST | Session termination |

---

## 11. AI Diagnostics Engine (Gemini Integration)

- **Model**: `gemini-1.5-flash` (fast inference) or `gemini-1.5-pro` (in-depth reasoning).
- **Execution Pipeline**: Telemetry validation → Deterministic safety verification → Fingerprint cache check → Gemini structured prompt → Response sanitization → Client delivery & MongoDB caching.
- **Resilience**: If Gemini API is unreachable or rate-limited, the system transparently falls back to the deterministic safety engine (`batterySafety.js`) with zero data fabrication.

---

## 12. Role-Based Access Control (RBAC) & Security

### Permission Matrix (`src/lib/permissions.js`)

| Permission | 🛡️ Admin | ⚡ Operator | 👁️ Viewer |
|------------|:--------:|:----------:|:---------:|
| `view_telemetry` | ✅ | ✅ | ✅ |
| `control_hardware` | ✅ | ✅ | ❌ |
| `manage_alerts` | ✅ | ✅ | 🟡 View Only |
| `manage_users` | ✅ | ❌ | ❌ |
| `access_ai` | ✅ | ✅ | ✅ |
| `export_data` | ✅ | ✅ | ✅ |
| `edit_settings` | ✅ | ❌ | ❌ |

### Security Measures
- **Actuator Lockout**: If battery is in `CRITICAL` or `EMERGENCY` state, manual actuator controls are disabled to prevent unsafe overrides.
- **Server Secret Isolation**: `GEMINI_API_KEY`, `MONGODB_URI`, and `FIREBASE_ADMIN_PRIVATE_KEY` are strictly server-side.
- **Rate Limiting**: Sliding-window rate limiters protect all AI, command dispatch, and database ingest routes.

---

## 13. Workflows & Data Sync Strategy

- **Real-Time Loop**: ESP32 publishes frames every 1.5s to Firebase RTDB.
- **Historical Persistence**: `/api/sync-to-mongo` endpoint pulls delta snapshots and bulk-inserts them into MongoDB Atlas `readings` collection.
- **Automated Sync**: Triggered via scheduled background cron worker or serverless cloud function every 5–15 minutes.

---

## 14. Testing & Verification

```bash
# Lint checks
npm run lint

# Production build verification
npm run build

# Test health endpoint
curl http://localhost:3000/api/health

# Test battery latest
curl http://localhost:3000/api/battery/latest

# Test environmental latest
curl http://localhost:3000/api/environmental/latest

# Simulate telemetry push
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"batteryId": "BAT001", "voltage": 12.6, "current": 2.1, "temperature": 26.5, "mq2": 320}'
```

---

## 15. Deployment & DevOps

- **Vercel**: Optimized for Next.js App Router with automatic edge caching and serverless functions.
- **Docker**: Containerized deployment via `Dockerfile`.
- **Environment Parity**: Complete `.env.example` ensuring smooth staging-to-production transitions.

---

## 16. Future Enhancements & Roadmap

- [ ] Multi-pack aggregation & fleet dashboard.
- [ ] Bluetooth BLE local connection fallback for ESP32.
- [ ] Direct solar MPPT charge controller telemetry integration.
- [ ] Push notifications via Web Push API and Telegram / SMS webhooks.

---

**Battery Vital — Engineered for safer, smarter energy systems.**
