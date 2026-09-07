# Battery Vital — System Architecture Document

## 1. Architecture Overview

Battery Vital is designed as a distributed, multi-tiered Internet of Things (IoT) monitoring and predictive intelligence platform. The architecture separates ultra-low-latency physical sensing at the hardware edge from real-time web socket streaming, historical data aggregation, and generative AI diagnostic evaluation.

### 1.1 High-Level Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 User & Client Layer                               │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐             │
│  │   Admin Portal    │  │ Operator Console  │  │  Viewer Dashboard │             │
│  │  (Full Control)   │  │ (Actuators/Alerts)│  │    (Read-Only)    │             │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘             │
└────────────┼──────────────────────┼──────────────────────┼───────────────────────┘
             │                      │                      │
             └──────────────────────┼──────────────────────┘
                                    │ HTTPS / WSS
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                           Web Application Layer (Next.js 14)                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                      Next.js App Router (React 18.2)                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ Server Pages │  │ Client Views │  │  API Routes  │  │ Custom React    │  │  │
│  │  │ (SSR/Static) │  │ (Recharts)   │  │ (Edge/Node)  │  │ Hooks (Firebase)│  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └──────────────────────────────────────┬──────────────────────────────────────┘  │
│                                         │                                         │
│              ┌──────────────────────────┼──────────────────────────┐              │
│              ▼                          ▼                          ▼              │
│     ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐     │
│     │ Deterministic   │        │ RBAC & Security │        │ Rate Limiter &  │     │
│     │ Safety Engine   │        │ Verification    │        │ Request Cache   │     │
│     │ (batterySafety) │        │ (permissions.js)│        │ (aiCache.js)    │     │
│     └─────────────────┘        └─────────────────┘        └─────────────────┘     │
└──────────────────────┬──────────────────┬──────────────────────────┬──────────────┘
                       │                  │                          │
        Sub-second Push│                  │ Batch Sync (5m)          │ Structured JSON
                       ▼                  ▼                          ▼
┌──────────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────┐
│ Firebase Realtime Database   │  │ MongoDB Atlas            │  │ Google Gemini API│
│                              │  │                          │  │ (1.5 Flash/Pro)  │
│ • /live_data/{DEVICE_ID}     │  │ • readings (time-series) │  │ • Interpretation │
│ • /commands/{DEVICE_ID}      │  │ • alerts (event logs)    │  │ • Risk Scoring   │
│ • /alerts/{DEVICE_ID}        │  │ • users (RBAC profiles)  │  │ • RUL Trends     │
│ • Low-latency WebSockets     │  │ • ai_diagnostics (cache) │  │ • Recommendations│
└──────────────┬───────────────┘  └──────────────────────────┘  └──────────────────┘
               │
               │ HTTPS Telemetry (1.5s) / Long Poll (2s)
               ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 Hardware Edge Layer                               │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                            ESP32 Microcontroller                            │  │
│  │               (Dual-Core 32-bit Xtensa LX6, 240 MHz, 520 KB SRAM)           │  │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────────────────┐  │  │
│  │  │ Sensor Acquisition│  │ Local Safety Loop │  │ Autonomous Actuator Ctl │  │  │
│  │  │ (sensors.h)       │  │ (batterySafety.h) │  │ (led_control.h)         │  │  │
│  │  └─────────┬─────────┘  └─────────┬─────────┘  └────────────┬────────────┘  │  │
│  └────────────┼──────────────────────┼─────────────────────────┼───────────────┘  │
│               │                      │                         │                  │
│       ┌───────┴───────┐              │                         │                  │
│       ▼               ▼              │                         │                  │
│  ┌─────────┐    ┌──────────┐         │                         ▼                  │
│  │ INA219  │    │  DHT11   │         │            ┌────────────────────────────┐  │
│  │(I2C0x40)│    │ (GPIO 4) │         │            │ Physical Actuators         │  │
│  │ Voltage │    │  Temp    │         │            │ • Green LED (GPIO 14)      │  │
│  │ Current │    │ Humidity │         │            │ • Yellow LED (GPIO 26)     │  │
│  │ Power   │    │ HeatIdx  │         │            │ • Red LED (GPIO 27)        │  │
│  └─────────┘    └──────────┘         │            │ • Active Buzzer (GPIO 25)  │  │
│       ┌───────────────┐              │            └────────────────────────────┘  │
│       ▼               ▼              │                                            │
│  ┌─────────┐    ┌──────────┐         │                                            │
│  │  MQ-2   │    │  MQ-135  │         │                                            │
│  │(GPIO 34)│    │(GPIO 35) │         │                                            │
│  │Gas/Smoke│    │ AQI/CO₂  │         │                                            │
│  └─────────┘    └──────────┘         │                                            │
└──────────────────────────────────────┴────────────────────────────────────────────┘
```

---

## 2. Hardware Architecture & Pin Assignment

### 2.1 Pin Mapping Matrix

```cpp
// ============================================================================
// Battery Vital ESP32 v13.0 — Pin Configuration
// ============================================================================

// --- I2C Bus (INA219 High-Side Power Sensor) ---
#define SDA_PIN             21    // I2C Serial Data (requires 4.7kΩ pull-up)
#define SCL_PIN             22    // I2C Serial Clock (requires 4.7kΩ pull-up)
#define INA219_I2C_ADDR     0x40  // Default address (A0/A1 tied to GND)

// --- Digital Ambient Sensors ---
#define DHT_PIN             4     // DHT11 Single-Wire Digital Bus (3.3V)
#define DHT_TYPE            DHT11 // Temperature & Relative Humidity

// --- Analog Gas & Air Quality Sensors (ADC1 Only) ---
#define MQ2_PIN             34    // MQ-2 Combustible Gas/Smoke (ADC1_CHANNEL_6)
#define MQ135_PIN           35    // MQ-135 Hazardous Air/CO2 (ADC1_CHANNEL_7)

// --- Actuator Outputs ---
#define BUZZER_PIN          25    // Active Buzzer Driver (PWM / GPIO logic)
#define LED_GREEN           14    // Normal Status Indicator (Current limit 330Ω)
#define LED_YELLOW          26    // Warning Status Indicator (Current limit 330Ω)
#define LED_RED             27    // Critical Trip Indicator (Current limit 330Ω)

// --- System Constants ---
#define SERIAL_BAUD         115200 // Hardware UART debugging
#define LOOP_DELAY_MS       1500   // 1.5-second sampling cadence
#define WATCHDOG_TIMEOUT_S  30     // Hardware watchdog timer timeout
```

> [!IMPORTANT]
> **ADC Pin Isolation**: GPIO 34 and GPIO 35 belong to **ADC1**. GPIOs on **ADC2** must not be used for analog sensor readings because the ESP32 Wi-Fi stack takes exclusive control over ADC2 when transmitting.

### 2.2 Sensor Specifications & Operating Windows

| Sensor | Interface | Measured Metric | Physical Range | Nominal Resolution | Electrical Accuracy | Sample Interval |
|--------|-----------|-----------------|----------------|--------------------|---------------------|-----------------|
| **INA219** | I2C (3.3V) | Bus Voltage | 0.0V – 26.0V | 0.8 mV | ±0.5% | 1.5 s |
| | | Shunt Drop | ±320 mV | 0.01 mV | ±0.5% | 1.5 s |
| | | Current | ±3.2 A (Extendable) | 0.8 mA | ±1.0% | 1.5 s |
| | | Power | 0.0W – 83.2W | Calculated | $\pm(V \times I)$ | 1.5 s |
| **DHT11** | 1-Wire Digital | Temperature | 0.0°C – 50.0°C | 1.0°C | ±2.0°C | 2.0 s min |
| | | Humidity | 20.0% – 80.0%RH| 1.0% | ±5.0%RH | 2.0 s min |
| **MQ-2** | Analog (0–3.3V via divider)| Combustible Gas / Smoke | 300 – 10,000 ppm | 12-bit ADC | Semi-quantitative | 1.5 s |
| **MQ-135** | Analog (0–3.3V via divider)| Air Quality / CO₂ / VOCs | 10 – 1,000 ppm | 12-bit ADC | Semi-quantitative | 1.5 s |

### 2.3 Power Budget & Supply Distribution

```
Component Current Draw Breakdown:
  • ESP32 (Wi-Fi active TX bursts): 160 mA @ 3.3V  =  528 mW
  • INA219 (Active I2C sampling):     1 mA @ 3.3V  =    3 mW
  • DHT11 (Measuring phase):        0.5 mA @ 3.3V  =  1.7 mW
  • MQ-2 Internal Heater Coil:      150 mA @ 5.0V  =  750 mW
  • MQ-135 Internal Heater Coil:    150 mA @ 5.0V  =  750 mW
  • LED Indicators (Worst-case 2):   40 mA @ 3.3V  =  132 mW
  • Active Buzzer (Continuous):      30 mA @ 3.3V  =   99 mW
  ────────────────────────────────────────────────────────────
  Peak System Power Consumption:    ~532 mA         ≈ 2.26 W

Recommended Power Source: Dedicated 5V 2.0A Regulated Micro-USB / DC-DC Converter.
```

---

## 3. Software Architecture & Technology Stack

### 3.1 Stack Breakdown

#### Frontend Layer
- **Framework**: Next.js 14.0.4 with App Router (React Server Components + Client Boundary hydration).
- **UI Engine**: React 18.2.0 (Hooks, Context, Concurrent Rendering).
- **Styling**: Tailwind CSS 3.3.6 with custom CSS modules and an Obsidian dark-mode palette.
- **Data Visualization**: Recharts 2.10.3 (Responsive Container, AreaChart, LineChart, RadialBarChart).
- **Iconography**: Lucide React 0.294.0.

#### Serverless & Backend Layer
- **Runtime**: Node.js 18+ (Vercel Serverless Functions and Render Container Service).
- **Real-Time Gateway**: Firebase Admin SDK 14.3.0 connecting to Google Firebase Realtime Database.
- **Historical Storage**: MongoDB Node.js Driver 6.3.0 connecting to MongoDB Atlas replica set.
- **AI Diagnostics**: Direct HTTPS REST / SSE streaming to Google Generative Language API (`gemini-1.5-flash` / `gemini-1.5-pro`).
- **Safety Kernel**: Pure deterministic JavaScript module (`src/lib/batterySafety.js`) operating without external runtime dependencies.

---

## 4. Complete Project Directory Layout

```
Battery_vitals/
├── .env.example                     # Environment variables template
├── .eslintrc.json                   # Code linting rules
├── .gitignore                       # Git exclusions (node_modules, .env, .next)
├── .vercelignore                    # Vercel deployment exclusions
├── next.config.js                   # Next.js security headers, bundle analyzer, console stripping
├── package.json                     # Project manifest and dependency declarations
├── package-lock.json                # Locked dependency tree
├── render.yaml                      # Render Infrastructure as Code configuration
├── vercel.json                      # Vercel deployment routing & headers
├── Brain.md                         # Core system knowledge base & agent reference
├── README.md                        # Project overview and quickstart guide
│
├── esp32/                           # Embedded Firmware Suite
│   ├── BatteryVitals_v12.0.ino      # Monolithic legacy baseline sketch
│   └── BatteryVital_v13.0/          # Production modular firmware
│       ├── BatteryVital_v13.0.ino   # Main setup() and loop() orchestration
│       ├── config.h                 # Wi-Fi SSID, Firebase credentials, pin defines
│       ├── sensors.h                # INA219, DHT11, MQ-2, MQ-135 reading routines
│       ├── led_control.h            # Autonomous LED states & non-blocking buzzer PWM
│       └── firebase_ops.h           # RTDB JSON payload publish & /commands listener
│
├── public/                          # Static Web Assets
│   ├── favicon.ico                  # Application icon
│   ├── manifest.json                # Progressive Web App manifest
│   ├── battery-vital-icon.svg       # Vector brand logo
│   └── sounds/                      # Auditory alarm chimes (chime.mp3, alarm.mp3)
│
└── src/                             # Next.js Full-Stack Application Source
    ├── app/                         # App Router Pages & API Routes
    │   ├── layout.js                # Root layout, ThemeProvider, global metadata
    │   ├── page.js                  # 🏠 Live Dashboard (multi-sensor grid)
    │   ├── battery/page.js          # 🔋 Dedicated battery monitoring & cell metrics
    │   ├── environmental/page.js    # 🌡️ Environmental safety station & gas monitors
    │   ├── analytics/page.js        # 📊 Long-term trends & energy efficiency curves
    │   ├── controls/page.js         # 🎛️ Actuator control panel (LED/Buzzer overrides)
    │   ├── ai/page.js               # 🤖 Gemini AI diagnostics & predictive maintenance
    │   ├── alerts/page.js           # 🚨 Alert management & configurable thresholds
    │   ├── history/page.js          # 📜 Time-series tabular browser & CSV export
    │   ├── diagnostics/page.js      # 🔧 ESP32 hardware diagnostics, RSSI, heap health
    │   ├── users/page.js            # 👥 Team member management & RBAC settings
    │   ├── settings/page.js         # ⚙️ Battery pack parameters & webhook configurations
    │   ├── passport/page.js         # 🛡️ Digital Battery Passport (EU compliance view)
    │   ├── about/page.js            # ℹ️ Architecture documentation & sensor overview
    │   ├── privacy/page.js          # 🔒 Privacy policy
    │   ├── terms/page.js            # ⚖️ Terms of service
    │   │
    │   └── api/                     # Backend Serverless REST Endpoints
    │       ├── health/route.js      # GET  — System health check
    │       ├── status/route.js      # GET  — Device connectivity summary
    │       ├── telemetry/route.js   # GET/POST — Telemetry snapshot & ingest
    │       ├── battery/
    │       │   ├── latest/route.js  # GET  — Current INA219 electrical metrics
    │       │   ├── history/route.js # GET  — Historical voltage/current time-series
    │       │   ├── soc/route.js     # GET  — State of Charge & runtime forecast
    │       │   └── health/route.js  # GET  — BHI, SOH, and degradation rates
    │       ├── environmental/
    │       │   ├── latest/route.js  # GET  — Current DHT11 & gas sensor readings
    │       │   ├── history/route.js # GET  — Environmental time-series
    │       │   ├── air-quality/route.js # GET — AQI computation breakdown
    │       │   └── alerts/route.js  # GET  — Environmental limit breaches
    │       ├── control/
    │       │   ├── led/route.js     # POST — LED state dispatch
    │       │   ├── buzzer/route.js  # POST — Buzzer mode dispatch
    │       │   └── status/route.js  # GET  — Read actuator states
    │       ├── commands/route.js    # POST — Generic command queue to ESP32
    │       ├── analyze/route.js     # POST — Gemini AI safety analysis
    │       ├── predictions/route.js # GET  — Predictive failure forecasts
    │       ├── insights/route.js    # GET  — Real-time AI recommendations
    │       ├── anomalies/route.js   # GET  — Statistical anomaly detection
    │       ├── alerts/
    │       │   ├── route.js         # GET/POST — Alert feed CRUD
    │       │   ├── config/route.js  # GET/PUT — Threshold limits
    │       │   └── [id]/route.js    # PUT/DELETE — Acknowledge/clear alert
    │       ├── users/
    │       │   ├── route.js         # GET/POST — User accounts
    │       │   ├── me/route.js      # GET  — Current authenticated session
    │       │   └── [id]/route.js    # PUT/DELETE — Single user modifications
    │       ├── auth/
    │       │   ├── login/route.js   # POST — Session creation
    │       │   └── logout/route.js  # POST — Session termination
    │       ├── sync-to-mongo/route.js # POST — Firebase to MongoDB batch sync
    │       └── export/route.js      # GET  — CSV/JSON telemetry export
    │
    ├── components/                  # Modular React Components
    │   ├── layout/
    │   │   ├── Header.jsx           # Global navigation & live connection indicator
    │   │   ├── Sidebar.jsx          # Desktop navigation sidebar
    │   │   ├── MobileNav.jsx        # Mobile responsive drawer menu
    │   │   └── Layout.jsx           # Application shell container
    │   ├── dashboard/
    │   │   ├── LiveDashboard.jsx    # Primary telemetry grid
    │   │   ├── MetricCard.jsx       # Individual telemetry display card
    │   │   ├── SensorGrid.jsx       # Multi-sensor status matrix
    │   │   └── StatusIndicator.jsx  # LED and buzzer hardware mirror
    │   ├── charts/
    │   │   ├── LiveChart.jsx        # Real-time streaming line chart
    │   │   ├── HistoryChart.jsx     # Multi-metric historical area chart
    │   │   └── GaugeChart.jsx       # Radial SVG gauge for SOC and AQI
    │   ├── battery/
    │   │   ├── BatteryStatus.jsx    # Health card & SOH/BHI indicator
    │   │   └── PowerMetrics.jsx     # Voltage, Current, Power telemetry
    │   ├── environmental/
    │   │   ├── TempHumidity.jsx     # DHT11 dual display
    │   │   └── GasDetection.jsx     # MQ-2 and MQ-135 air hazard monitor
    │   ├── controls/
    │   │   ├── ControlPanel.jsx     # Master actuator override interface
    │   │   └── ActuatorToggle.jsx   # Tactile switch component
    │   ├── alerts/
    │   │   ├── AlertsList.jsx       # Live alert feed with acknowledgment
    │   │   └── AlertConfigModal.jsx # Threshold tuning modal
    │   └── ai/
    │       ├── AIInsights.jsx       # Gemini synthesis readout
    │       └── FailureForecast.jsx  # RUL and probability breakdown
    │
    ├── context/                     # React Context Providers
    │   ├── AuthContext.js           # RBAC user session state
    │   └── ThemeContext.js          # Dark/Light display preferences
    │
    ├── hooks/                       # Custom React Hooks
    │   ├── useFirebase.js           # Realtime Database listener
    │   ├── useRealTimeData.js       # Live telemetry subscription
    │   ├── useBattery.js            # Electrical metrics & SOC calculation
    │   ├── useEnvironmental.js      # DHT11 & gas calculations
    │   ├── useAuth.js               # User role & permission checks
    │   └── useAI.js                 # Gemini diagnostic queries
    │
    ├── lib/                         # Server & Client Shared Libraries
    │   ├── firebase.js              # Client-side Firebase SDK initialization
    │   ├── firebaseAdmin.js         # Server-side Firebase Admin SDK
    │   ├── mongodb.js               # MongoDB connection pool & caching
    │   ├── gemini.js                # Gemini REST/SSE diagnostic wrapper
    │   ├── batterySafety.js         # Pure deterministic safety engine
    │   ├── permissions.js           # RBAC policy & permission checks
    │   ├── auth.js                  # User authentication & session store
    │   ├── aiCache.js               # In-memory diagnostic cache
    │   ├── rateLimit.js             # Sliding-window rate limiter
    │   ├── security.js              # Input sanitization & boundary clamps
    │   └── utils.js                 # Numeric formatting and date helpers
    │
    └── styles/                      # Stylesheet Definitions
        ├── globals.css              # Global Tailwind imports & custom variables
        └── theme.css                # Obsidian color tokens & glassmorphism
```

---

## 5. End-to-End Data Pipelines

### 5.1 Real-Time Telemetry Pipeline

```
[ESP32 Hardware Loop (every 1.5s)]
  │
  ├─ 1. Sample INA219 (Vbus, Vshunt, Current, Power)
  ├─ 2. Sample DHT11 (Temp, Humidity)
  ├─ 3. Sample MQ-2 (ADC count) & MQ-135 (ADC count)
  ├─ 4. Compute Local Safety:
  │      • IF Temp > 45°C OR MQ2 > 800ppm OR Volt > 14.6V OR Volt < 10.0V:
  │            Trip RED LED + Audible Buzzer
  │      • ELSE IF Temp > 38°C OR MQ2 > 500ppm:
  │            Trip YELLOW LED + Slow Beep
  │      • ELSE:
  │            Trip GREEN LED + Silence Buzzer
  │
  └─ 5. Format JSON & HTTP PUT/PATCH to Firebase:
         Path: /live_data/BAT001
         Payload: {
           "timestamp": 1718000000,
           "battery": { voltage, current, power, shuntVoltage, soc, soh, bhi },
           "environmental": { temperature, humidity, heatIndex, dewPoint, mq2, mq135, aqi },
           "hardware": { led_green, led_yellow, led_red, buzzer, wifi_rssi, heap_free }
         }
              │
              ▼
[Firebase Realtime Database]
  │
  ├─ Sub-500ms WebSocket push to connected browsers
  │
  ▼
[Web Client (React App Router)]
  │
  ├─ useFirebase('/live_data/BAT001') receives delta payload
  ├─ Updates real-time gauges, telemetry cards, and streaming charts
  └─ Evaluates browser alarm chime: triggers audio alert if critical state tripped
              │
              ▼ (Every 5 minutes via cron/worker)
[Batch Sync Pipeline (/api/sync-to-mongo)]
  │
  ├─ Queries Firebase RTDB for records since last sync timestamp
  └─ Bulk inserts records into MongoDB Atlas `readings` collection
```

### 5.2 Bidirectional Actuator Command Pipeline

```
[Operator clicks "Toggle Red LED" or "Sound Fast Beep" on /controls]
  │
  ▼
[Frontend: POST /api/control/led or /api/control/buzzer]
  │
  ▼
[Next.js API Route Validation]
  │
  ├─ 1. Verify User Authentication & RBAC (Admin or Operator role required)
  ├─ 2. Consult Deterministic Safety Engine (batterySafety.js):
  │      • If system is in EMERGENCY or CRITICAL state, reject silencing of alarms!
  │
  └─ 3. Dispatch command to Firebase RTDB:
         Path: /commands/BAT001
         Payload: {
           "led_red": true,
           "buzzer_mode": "fast_beep",
           "auto_mode": false,
           "updatedAt": 1718000000
         }
              │
              ▼
[Firebase Realtime Database]
              │
              ▼ (Long-polling / REST listener every 2.0s)
[ESP32 Firmware (firebase_ops.h)]
  │
  ├─ Fetches /commands/BAT001
  ├─ Compares against current hardware state
  ├─ Updates GPIO pins: digitalWrite(LED_RED, HIGH), tone(BUZZER_PIN, ...)
  └─ Updates /live_data/BAT001/hardware to reflect actual executed state
```

---

## 6. Database Schemas

### 6.1 Firebase Realtime Database Structure

```json
{
  "live_data": {
    "BAT001": {
      "timestamp": 1718000000000,
      "battery": {
        "voltage": 12.62,
        "current": 2.45,
        "power": 30.92,
        "shuntVoltage": 0.0245,
        "loadVoltage": 12.64,
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

### 6.2 MongoDB Atlas Collections

#### Collection: `readings` (Time-Series Telemetry)
```javascript
{
  _id: ObjectId("66671a5c1a2b3c4d5e6f7a8b"),
  deviceId: "BAT001",
  timestamp: ISODate("2024-06-10T14:30:00.000Z"),
  battery: {
    voltage: 12.62,
    current: 2.45,
    power: 30.92,
    shuntVoltage: 0.0245,
    resistance: 12.5,
    soc: 84,
    soh: 98,
    bhi: 8
  },
  environmental: {
    temperature: 26.4,
    humidity: 52.0,
    heatIndex: 26.8,
    dewPoint: 15.6,
    mq2: 320,
    mq135: 110,
    aqi: 38
  },
  hardware: {
    led_green: true,
    led_yellow: false,
    led_red: false,
    buzzer: false
  },
  safety_status: "SAFE",
  created_at: ISODate("2024-06-10T14:35:01.000Z")
}

// Compound Indexes:
db.readings.createIndex({ deviceId: 1, timestamp: -1 })
db.readings.createIndex({ "battery.voltage": 1 })
db.readings.createIndex({ "environmental.temperature": 1 })
```

#### Collection: `alerts` (Historical Audit Log)
```javascript
{
  _id: ObjectId("66671a5c1a2b3c4d5e6f7a8c"),
  deviceId: "BAT001",
  type: "thermal_critical",
  severity: "critical",  // "info" | "warning" | "critical" | "emergency"
  message: "Cell temperature reached 46.2°C (trip threshold: 45.0°C)",
  metric: "temperature",
  threshold: 45.0,
  measured_value: 46.2,
  timestamp: ISODate("2024-06-10T14:30:00.000Z"),
  acknowledged: true,
  acknowledged_by: "usr_admin_01",
  acknowledged_at: ISODate("2024-06-10T14:31:15.000Z"),
  resolved: false,
  resolved_at: null,
  created_at: ISODate("2024-06-10T14:30:05.000Z")
}

// Indexes:
db.alerts.createIndex({ deviceId: 1, timestamp: -1 })
db.alerts.createIndex({ severity: 1, acknowledged: 1 })
```

#### Collection: `users` (RBAC Profiles)
```javascript
{
  _id: ObjectId("66671a5c1a2b3c4d5e6f7a8d"),
  id: "usr_admin_01",
  name: "Chief Battery Engineer",
  email: "admin@example.com",
  role: "admin",  // "admin" | "operator" | "viewer"
  title: "Lead Power Systems Engineer",
  department: "Energy Storage & Safety",
  avatar: "🛡️",
  status: "active",
  lastActive: ISODate("2024-06-10T14:30:00.000Z"),
  createdAt: ISODate("2024-01-01T00:00:00.000Z")
}

// Unique Indexes:
db.users.createIndex({ id: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { unique: true })
```

#### Collection: `ai_diagnostics` (Cached Diagnostic Evaluations)
```javascript
{
  _id: ObjectId("66671a5c1a2b3c4d5e6f7a8e"),
  deviceId: "BAT001",
  fingerprint: "v12.6_t26.4_bhi8_soc84",
  timestamp: ISODate("2024-06-10T14:30:00.000Z"),
  telemetry_snapshot: {
    voltage: 12.62,
    current: 2.45,
    temperature: 26.4,
    mq2: 320,
    bhi: 8
  },
  analysis: {
    overall_status: "SAFE",
    risk_score: 8,
    summary: "Battery pack operating within nominal electrical and thermal envelopes.",
    recommendations: [
      "Operating parameters nominal; continue current 2.45A discharge profile.",
      "Ambient enclosure temperature 26.4°C is optimal for LiFePO4 longevity."
    ],
    predicted_issues: [],
    failure_probability: {
      "30_days": 1.2,
      "90_days": 4.5,
      "1_year": 18.0
    }
  },
  model_used: "gemini-1.5-flash",
  response_time_ms: 1120,
  created_at: ISODate("2024-06-10T14:30:02.000Z")
}

// TTL Index (Auto-clears after 7 days):
db.ai_diagnostics.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800 })
```

---

## 7. REST API Architecture

### 7.1 Complete Endpoint Mapping

| Method | Path | Access Tier | Function / Description |
|--------|------|-------------|------------------------|
| `GET`  | `/api/health` | Public | System status, database health, and uptime |
| `GET`  | `/api/status` | Public | Real-time device connectivity and packet ping |
| `GET`  | `/api/telemetry` | Viewer | Latest multi-sensor frame snapshot |
| `POST` | `/api/telemetry` | Node / Admin | Ingest sensor data payload directly |
| `GET`  | `/api/battery/latest` | Viewer | Current INA219 readings |
| `GET`  | `/api/battery/history` | Viewer | Time-series electrical query (start, end, limit) |
| `GET`  | `/api/battery/soc` | Viewer | Calibrated SOC and estimated runtime |
| `GET`  | `/api/battery/health` | Viewer | BHI, SOH, and degradation velocity |
| `GET`  | `/api/environmental/latest` | Viewer | Current DHT11 and MQ sensor snapshot |
| `GET`  | `/api/environmental/history` | Viewer | Ambient temperature and humidity history |
| `GET`  | `/api/environmental/air-quality`| Viewer | Calibrated AQI and gas concentration curve |
| `POST` | `/api/control/led` | Operator | Set physical LED pin states (`red`, `yellow`, `green`) |
| `POST` | `/api/control/buzzer` | Operator | Set buzzer sound mode (`off`, `slow`, `fast`, `continuous`) |
| `GET`  | `/api/control/status` | Viewer | Inspect active physical actuator pin states |
| `POST` | `/api/commands` | Operator | Generic hardware command queue dispatcher |
| `POST` | `/api/analyze` | Viewer | Run Gemini AI structured diagnostic evaluation |
| `GET`  | `/api/predictions` | Viewer | RUL and failure probability models |
| `GET`  | `/api/insights` | Viewer | Actionable operational recommendations |
| `GET`  | `/api/anomalies` | Viewer | Statistical z-score outlier analysis |
| `GET`  | `/api/alerts` | Viewer | List active and historical alerts |
| `POST` | `/api/alerts` | Operator | Trigger manual operational alert |
| `PUT`  | `/api/alerts/[id]` | Operator | Acknowledge or resolve an active alert |
| `GET`  | `/api/alerts/config` | Viewer | Read safety threshold trigger limits |
| `PUT`  | `/api/alerts/config` | Admin | Update safety threshold trigger limits |
| `GET`  | `/api/users` | Admin | List system users and RBAC profiles |
| `POST` | `/api/users` | Admin | Provision new user account |
| `GET`  | `/api/users/me` | Viewer | Authenticated user profile |
| `PUT`  | `/api/users/[id]` | Admin | Update user permissions and role |
| `DELETE`| `/api/users/[id]` | Admin | Deactivate or delete user account |
| `POST` | `/api/sync-to-mongo` | Worker / Admin | Batch synchronize Firebase RTDB to MongoDB |
| `GET`  | `/api/export` | Viewer | Stream CSV or JSON historical telemetry |

---

## 8. Deployment & DevOps Architecture

### 8.1 Deployment Topology

```
Production Targets:
  1. Primary: Vercel (Edge CDN + Serverless Node.js Functions)
     • Repository: GitHub main branch auto-deploy
     • Routing: vercel.json headers, caching, and rate limiting
  2. Standalone / Docker: Render (render.yaml Node.js Web Service)
     • Continuous delivery of containerized Next.js instance
     • Long-running background workers for MongoDB synchronization
```

### 8.2 Environment Variable Configuration

```bash
# ==============================================================================
# Battery Vital — Environment Secrets Configuration
# ==============================================================================

# Client-Side Firebase Configuration (Publicly Safe)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=battery-vital.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://battery-vital-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=battery-vital
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=battery-vital.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef

# Server-Side Firebase Admin Credentials (STRICTLY CONFIDENTIAL)
FIREBASE_ADMIN_PROJECT_ID=battery-vital
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@battery-vital.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgI...\n-----END PRIVATE KEY-----\n"

# MongoDB Atlas Persistence Connection
MONGODB_URI=mongodb+srv://admin:secure_password@cluster0.mongodb.net/battery_vital?retryWrites=true&w=majority

# Google Gemini Intelligence Engine
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-1.5-flash

# Base App Configuration
NEXT_PUBLIC_APP_URL=https://battery-vital.vercel.app
NODE_ENV=production
```
