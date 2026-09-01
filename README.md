# Battery Vital — Intelligent Battery Safety & Environmental Monitoring System

A comprehensive full-stack battery monitoring and safety dashboard for EV/ESS battery packs with integrated environmental sensing. Built on Next.js (App Router) with Firebase Realtime Database live streaming, MongoDB Atlas persistence, and Gemini AI-driven analysis, predictive alerts, and multi-user collaboration.

---

## 🎯 Features

### 🔋 Battery Monitoring
- **Real-time telemetry** via INA219 sensor (Bus Voltage, Shunt Voltage, Load Voltage, Current, Power)
- **State of Charge (SOC)** estimation and tracking with high precision
- **Cell-level & pack monitoring** with imbalance detection
- **Power consumption analytics** and efficiency metrics
- **Battery health scoring (BHI/SOH)** and degradation tracking with lifespan estimation

### 🌡️ Environmental Monitoring
- **Temperature & Humidity** tracking (DHT11 sensor) with heat index calculation
- **Gas leak & smoke detection** (MQ-2: LPG/Smoke, MQ-135: Air Quality/CO₂)
- **Air Quality Index (AQI)** calculation and hazard categorization
- **Multi-zone environmental mapping** and thermal correlation analysis
- **Threshold-based automatic alerts** for early hazard prevention

### 🚨 Smart Safety System
- **Visual indicators** (Green/Yellow/Red LED hardware & UI status)
- **Audible alarms** (Buzzer for critical events: continuous, fast beep, slow beep)
- **AI-powered anomaly detection** for sudden voltage drops, spikes, or gas jumps
- **Predictive failure analysis** with remaining useful life forecasting
- **Automatic emergency protocols** and safety locks

### 🤖 AI Intelligence (Gemini)
- Real-time safety analysis and instant recommendations
- Predictive maintenance scheduling and replacement forecasting
- Battery lifespan estimation (30-day, 90-day, 1-year failure probability)
- Environmental hazard assessment and thermal runaway prevention
- Pattern recognition for abnormal electrical and ambient behavior

### 👥 Multi-User Collaboration & RBAC
- Role-Based Access Control: **Admin**, **Operator**, and **Viewer**
- Fine-grained permission matrix for actuator commands and safety overrides
- Multi-user live sessions and audit logging

### 📊 Advanced Analytics
- Historical trend analysis and time-series browsing
- Comparative performance metrics across charge/discharge cycles
- Energy efficiency reports and electricity cost calculations
- Environmental correlation studies (Temperature vs. Internal Resistance/Current)
- Export capabilities (**CSV**, **PDF**, **JSON**)

---

## 🏗️ Architecture

```
ESP32 Sensor Hub (Multi-sensor Platform)
   │
   ├─ INA219 (I2C 0x40 - SDA 21, SCL 22) ──► Voltage, Current, Power
   ├─ DHT11 (GPIO4) ───────────────────────► Temperature, Humidity  
   ├─ MQ-2 (GPIO34) ───────────────────────► LPG, Smoke Detection
   ├─ MQ-135 (GPIO35) ─────────────────────► Air Quality, CO₂
   │
   │  HTTPS (Firebase SDK / REST)
   ▼
Firebase Realtime Database ─────────────────► Website (real-time listener, instant updates)
   │                                          ├─ Multi-user sessions
   │                                          ├─ Live charts & gauges
   │                                          └─ Instant notifications
   │
   │  Background sync (Cron / Cloud Function)
   ▼
MongoDB Atlas ──────────────────────────────► Long-term storage & analytics
   │                                          ├─ Historical time-series data
   │                                          ├─ User profiles & permissions
   │                                          └─ AI training datasets
   │
   ▼
Gemini AI Engine
   ├─ Real-time safety analysis
   ├─ Predictive maintenance
   ├─ Environmental risk assessment
   └─ Automated recommendations

Hardware Outputs (ESP32)
   ├─ Green LED (GPIO14)  ─────────────────► Normal operation
   ├─ Yellow LED (GPIO26) ─────────────────► Warning state
   ├─ Red LED (GPIO27)    ─────────────────► Critical alert
   └─ Buzzer (GPIO25)     ─────────────────► Audible alarm (Continuous, Fast/Slow Beep)
```

### Data Flow
1. **ESP32 devices** publish sensor readings to **Firebase RTDB** (`/live_data/{DEVICE_ID}`)
2. **Web clients** subscribe to real-time updates with zero latency
3. **Background workers** sync Firebase → MongoDB for persistence (`/api/sync-to-mongo`)
4. **Gemini AI** analyzes patterns and generates safety insights (`/api/analyze`)
5. **Alert system** triggers multi-channel notifications (in-app, email, SMS, push, buzzer/LEDs)

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** (App Router) — Server-side rendering, streaming & REST API routes
- **React 18** — High-performance interactive UI
- **Recharts** — Interactive responsive charts, sparklines & area visualizations
- **Lucide React** — Clean modern icon system
- **Tailwind CSS & CSS Modules** — Obsidian dark mode theme & responsive styling

### Backend & Database
- **Firebase Realtime Database** — Sub-second live data streaming & bidirectional command dispatch
- **Firebase Admin SDK** — Secure server-side telemetry & state management
- **MongoDB Atlas** — Time-series storage, alert logs, and user profile management
- **Next.js API Routes** — RESTful backend endpoints

### AI & Analytics
- **Google Gemini AI** (`gemini-1.5-flash` / `gemini-1.5-pro`) — Real-time telemetry diagnostics & maintenance predictions
- **Deterministic Safety Engine** — Physics-informed threshold validation preventing hallucinated safety states
- **Custom Algorithms** — State of Charge (SOC) tracking, Coulomb counting, AQI calculation

### Hardware Integration
- **ESP32** (WiFi/Bluetooth dual-core MCU)
- **INA219** — High-precision current/voltage sensor (I2C 0x40)
- **DHT11** — Temperature/Humidity sensor (GPIO4)
- **MQ-2 / MQ-135** — Gas & air quality sensors (Analog GPIO34 / GPIO35)
- **Visual/Audio Actuators** — LEDs (GPIO14, GPIO26, GPIO27) & Active Buzzer (GPIO25)

---

## 📁 Project Structure

```
battery-vital/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.js               # 🏠 Live Dashboard (multi-sensor view)
│   │   ├── battery/              # 🔋 Battery-specific metrics & INA219 analytics
│   │   ├── environmental/        # 🌡️ Temperature, Humidity, Gas & AQI monitoring
│   │   ├── analytics/            # 📊 Historical charts & efficiency reports
│   │   ├── controls/             # 🎛️ Device control panel (LED/Buzzer actuators)
│   │   ├── ai/                   # 🤖 AI insights, predictions & recommendations
│   │   ├── alerts/               # 🚨 Alert management, history & thresholds
│   │   ├── history/              # 📜 Time-series data browser & export
│   │   ├── diagnostics/          # 🔧 System health & hardware status
│   │   ├── users/                # 👥 User management & RBAC permissions
│   │   ├── settings/             # ⚙️ User preferences & system configuration
│   │   └── api/                  # 🔌 Backend REST API routes
│   │       ├── health/           # System health check
│   │       ├── status/           # Device status summary
│   │       ├── telemetry/        # Real-time sensor data ingest/snapshot
│   │       ├── battery/          # Battery telemetry, history, SOC & health APIs
│   │       ├── environmental/    # Temp, humidity, gas & AQI endpoints
│   │       ├── control/          # LED/Buzzer hardware actuation
│   │       ├── commands/         # Command dispatch pipeline to ESP32
│   │       ├── analyze/          # Gemini AI safety analysis
│   │       ├── predictions/      # Failure & lifespan prediction
│   │       ├── insights/         # AI-generated insights & recommendations
│   │       ├── anomalies/        # Real-time anomaly detection
│   │       ├── alerts/           # Alert CRUD & threshold config
│   │       ├── users/            # User profiles & RBAC
│   │       ├── auth/             # Authentication & session control
│   │       ├── history/          # Historical time-series query
│   │       ├── export/           # CSV / JSON / PDF export
│   │       └── sync-to-mongo/    # Firebase → MongoDB background sync
│   │
│   ├── lib/
│   │   ├── firebase.js           # Client-side Firebase initialization
│   │   ├── firebaseAdmin.js      # Server-side Firebase Admin SDK
│   │   ├── mongodb.js            # MongoDB Atlas connection pool
│   │   ├── gemini.js             # Gemini AI wrapper & prompt templates
│   │   ├── auth.js               # Authentication & session helpers
│   │   ├── permissions.js        # Role-based access control rules
│   │   ├── batterySafety.js      # Deterministic safety rule engine
│   │   └── utils.js              # Shared math, formatting & status helpers
│   │
│   ├── hooks/
│   │   ├── useFirebase.js        # Real-time Firebase RTDB hook
│   │   ├── useRealTimeData.js    # Aggregated live telemetry stream
│   │   ├── useBattery.js         # Battery-specific metrics & SOC hook
│   │   ├── useEnvironmental.js   # Environmental sensing & AQI hook
│   │   ├── useAI.js              # AI insights & predictions hook
│   │   ├── useAuth.js            # User authentication & session hook
│   │   └── useTheme.js           # Dark/Light theme switcher
│   │
│   └── components/
│       ├── layout/
│       │   ├── Header.jsx        # Top navigation & status bar
│       │   ├── MobileNav.jsx     # Mobile slide-out navigation
│       │   └── Layout.jsx        # Main application shell
│       ├── dashboard/
│       │   ├── LiveDashboard.jsx # Main live dashboard grid
│       │   ├── MetricCard.jsx    # Telemetry card with sparklines
│       │   ├── SensorGrid.jsx    # Multi-sensor overview widget
│       │   └── StatusIndicator.jsx # LED & Buzzer status visualizer
│       ├── charts/
│       │   ├── LiveChart.jsx     # Real-time line chart
│       │   ├── GaugeChart.jsx    # Circular gauge for voltage/SOC/AQI
│       │   ├── HistoryChart.jsx  # Historical multi-metric area chart
│       │   └── EnvironmentalChart.jsx # Ambient temp, humidity & gas chart
│       ├── battery/
│       │   ├── BatteryStatus.jsx # Battery health & BHI score card
│       │   ├── SOCIndicator.jsx  # State of Charge circular gauge
│       │   └── PowerMetrics.jsx  # Voltage, current, power & shunt display
│       ├── environmental/
│       │   ├── TempHumidity.jsx  # DHT11 temperature & humidity display
│       │   ├── GasDetection.jsx  # MQ-2 / MQ-135 gas PPM monitor
│       │   └── AirQualityIndex.jsx # Calculated AQI gauge & breakdown
│       ├── controls/
│       │   ├── ControlPanel.jsx  # Master control interface
│       │   ├── LEDControl.jsx    # Dedicated LED state toggle
│       │   └── BuzzerControl.jsx # Buzzer alarm mode selector
│       ├── alerts/
│       │   ├── AlertsList.jsx    # Real-time alert feed
│       │   ├── AlertCard.jsx     # Individual alert card with dismiss
│       │   └── AlertConfig.jsx   # Threshold configuration panel
│       └── ai/
│           ├── AIInsights.jsx    # Diagnostic safety display
│           ├── Predictions.jsx   # Failure prediction cards
│           └── Recommendations.jsx # Actionable AI suggestions
│
├── esp32/
│   └── BatteryVital_v13.0/
│       ├── BatteryVital_v13.0.ino # Main ESP32 firmware sketch
│       ├── sensors.h             # INA219, DHT11, MQ-2, MQ-135 reading routines
│       ├── firebase_ops.h        # RTDB payload transmit & command polling
│       ├── led_control.h         # LED indicators & buzzer sound patterns
│       └── config.h              # Pin mappings & WiFi/Firebase credentials
│
├── public/
│   ├── icons/                    # App icons & PWA assets
│   └── sounds/                   # Alert sound effects
│
├── .env.example                  # Environment variables template
├── .env.local                    # Local environment secrets (git-ignored)
├── package.json
├── next.config.js
└── README.md
```

---

## 🔌 API Endpoints Reference

### Core System
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | System health, database connectivity & uptime |
| `/api/status` | GET | Real-time device status summary & connection quality |
| `/api/telemetry` | GET / POST | Ingest sensor frames / retrieve latest snapshot |

### Battery Monitoring
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/battery/latest` | GET | Current battery telemetry (INA219 voltage, current, power) |
| `/api/battery/history` | GET | Historical battery time-series data with range filters |
| `/api/battery/soc` | GET | State of Charge (SOC) tracking & estimation |
| `/api/battery/health` | GET | Battery Health Index (BHI), SOH & degradation analysis |

### Environmental Monitoring
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/environmental/latest` | GET | Current temperature, humidity, and gas PPM levels |
| `/api/environmental/history` | GET | Environmental trend history (time-series) |
| `/api/environmental/air-quality` | GET | Calculated Air Quality Index (AQI) from MQ-135 |
| `/api/environmental/alerts` | GET | Active environmental threshold violations |

### Device Control
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/control/led` | POST | Set hardware LED states (Green, Yellow, Red) |
| `/api/control/buzzer` | POST | Trigger / silence buzzer with pattern mode |
| `/api/control/status` | GET | Read current hardware actuator states |
| `/api/commands` | POST | Dispatch low-level actuator command to ESP32 |

### AI & Analytics
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analyze` | POST | Gemini AI safety diagnostics & hazard assessment |
| `/api/predictions` | GET / POST | Failure probability forecasts & maintenance schedule |
| `/api/insights` | GET | Real-time AI recommendations & observations |
| `/api/anomalies` | GET | Detected anomalies and electrical pattern deviations |

### Alerts & Notifications
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/alerts` | GET / POST | Fetch active alerts or submit manual alert event |
| `/api/alerts/:id` | PUT / DELETE | Acknowledge, resolve, or dismiss specific alert |
| `/api/alerts/config` | GET / PUT | Read and update safety threshold limits |

### User Management & RBAC
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users` | GET / POST | List team members / invite new user (Admin only) |
| `/api/users/:id` | GET / PUT / DELETE | User profile CRUD & role assignment |
| `/api/users/me` | GET | Active user session & effective permissions |
| `/api/auth/login` | POST | User authentication & token issuance |
| `/api/auth/logout` | POST | Terminate user session |

### Data Sync & Export
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sync-to-mongo` | POST | Trigger manual or cron sync from Firebase to MongoDB |
| `/api/export` | GET | Export telemetry dataset in CSV, JSON, or PDF |
| `/api/history` | GET | Query aggregated historical database records |

---

## 🔧 Hardware Configuration

### ESP32 Pin Mapping

```cpp
// ── I2C Sensors ──
#define SDA_PIN     21    // I2C Data (INA219)
#define SCL_PIN     22    // I2C Clock (INA219)
// INA219 Address: 0x40

// ── Digital Sensors ──
#define DHT_PIN     4     // DHT11 Temperature/Humidity

// ── Analog Sensors ──
#define MQ2_PIN     34    // MQ-2 LPG/Smoke sensor (ADC1_CH6)
#define MQ135_PIN   35    // MQ-135 Air Quality/CO₂ sensor (ADC1_CH7)

// ── Actuator Outputs ──
#define BUZZER_PIN  25    // Active Buzzer
#define LED_GREEN   14    // Normal operation indicator
#define LED_YELLOW  26    // Warning state indicator
#define LED_RED     27    // Critical alert indicator
```

### Sensor Specifications

| Sensor | Interface | Measurement | Operating Range | Accuracy / Resolution |
|--------|-----------|-------------|-----------------|-----------------------|
| **INA219** | I2C (0x40) | Bus Voltage | 0 – 26 V | ±0.8 mV |
|            |            | Current | ±3.2 A | ±0.8 mA |
|            |            | Power | 0 – 83 W | Calculated |
| **DHT11** | Digital (GPIO4) | Temperature | 0 – 50 °C | ±2.0 °C |
|           |                 | Humidity | 20 – 80 %RH | ±5.0 %RH |
| **MQ-2** | Analog (GPIO34) | LPG & Smoke | 300 – 10,000 ppm | Analog voltage curve |
| **MQ-135**| Analog (GPIO35) | Air Quality & CO₂ | 10 – 1,000 ppm | Analog voltage curve |

### LED Status Indicators

| LED Color | GPIO | System State | Condition |
|-----------|------|--------------|-----------|
| 🟢 **Green** | 14 | Normal | All battery & ambient parameters within nominal thresholds |
| 🟡 **Yellow** | 26 | Warning | Minor threshold excursion (e.g., elevated temp or slight gas trace) |
| 🔴 **Red** | 27 | Critical | Dangerous levels detected (overvoltage, overtemp, high smoke/gas) |

### Buzzer Alarm Patterns

| Pattern | Sound Timing | Trigger Condition |
|---------|--------------|-------------------|
| **Continuous** | Solid high tone | Critical battery hazard, thermal runaway risk, gas emergency |
| **Fast Beep** | 0.5s ON / 0.5s OFF | Warning threshold exceeded (high load, high temp) |
| **Slow Beep** | 2.0s ON / 2.0s OFF | Minor anomaly detected or system alert notification |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and **npm**
- **Firebase Project** with Realtime Database enabled
- **MongoDB Atlas** database cluster (free M0 tier or higher)
- **Google AI Studio** API key (for Gemini diagnostics)
- **ESP32 Development Board** with INA219, DHT11, MQ-2, MQ-135 sensors, LEDs & Buzzer

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/yourusername/battery-vital.git
cd battery-vital
npm install
```

### 2. Environment Configuration

Create `.env.local` based on `.env.example`:

```env
# Firebase Web App Config (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Firebase Admin SDK (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your-project
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster0.mongodb.net/battery_vital?retryWrites=true&w=majority

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...

# Application URL & Environment
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Firebase Realtime Database Setup

1. Enable Firebase Realtime Database in your Firebase Console.
2. Initialize data structure:
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
        "soc": 85,
        "soh": 98,
        "bhi": 94,
        "safety": "SAFE"
      },
      "environmental": {
        "temperature": 25.3,
        "humidity": 60.0,
        "mq2": 450,
        "mq135": 120,
        "aqi": 42
      },
      "hardware": {
        "led_green": true,
        "led_yellow": false,
        "led_red": false,
        "buzzer": false,
        "mode": "auto"
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
      "timestamp": 1718000000
    }
  }
}
```

3. Security Rules:
```json
{
  "rules": {
    "live_data": {
      ".read": true,
      ".write": "auth != null"
    },
    "commands": {
      ".read": true,
      ".write": "auth != null"
    },
    "alerts": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

### 4. ESP32 Firmware Setup & Flash

1. Open `esp32/BatteryVital_v13.0/BatteryVital_v13.0.ino` in Arduino IDE or PlatformIO.
2. Install required Arduino libraries:
   - `Firebase ESP32 Client` (by Mobizt)
   - `Adafruit INA219`
   - `DHT sensor library` (Adafruit)
   - `ArduinoJson`
3. Edit `esp32/BatteryVital_v13.0/config.h` with your WiFi SSID, password, and Firebase credentials.
4. Select board **ESP32 Dev Module** and flash via USB.

### 5. Run Web Dashboard

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📊 Dashboard Pages & Navigation

### 🏠 Live Dashboard (`/`)
- Real-time multi-sensor grid with live gauges and status tiles
- Battery voltage, current, power, SOC ring, and shunt voltage display
- Ambient temperature, humidity, and MQ-2/MQ-135 gas monitor with AQI
- Live streaming multi-metric time-series chart
- Hardware LED & Buzzer indicator panel
- Active alerts banner with audio chime support

### 🔋 Battery Monitor (`/battery`)
- In-depth INA219 telemetry (Bus Voltage, Shunt Voltage, Load Voltage, Current, Power)
- State of Charge (SOC) tracking with charge/discharge phase indicator
- Battery Health Index (BHI) & State of Health (SOH) degradation curves
- Cell balancing overview and internal resistance calculation
- Power consumption analytics and remaining runtime estimation

### 🌡️ Environmental Monitor (`/environmental`)
- DHT11 high-precision Temperature & Humidity tracker with Heat Index and Dew Point
- MQ-2 Gas & Smoke detector with concentration in PPM
- MQ-135 Air Quality & CO₂ analyzer with standard AQI rating
- Multi-sensor ambient correlation graphs (Temperature vs. Battery Load)
- Environmental threshold violation tracker

### 📊 Analytics (`/analytics`)
- Historical comparison charts & customizable date range queries
- Energy throughput, efficiency metrics, and electricity cost calculator
- Charge cycle degradation analysis
- CSV, PDF, and JSON data export engine

### 🎛️ Control Panel (`/controls`)
- Manual actuator override (Green, Yellow, Red LEDs)
- Buzzer triggering with pattern selection (Continuous, Fast Beep, Slow Beep, Silence)
- Auto/Manual safety lock mode switch with auto-revert timer
- Low-latency remote command dispatch pipeline and command audit log

### 🤖 AI Insights (`/ai`)
- Gemini AI real-time safety analysis and risk scoring
- Predictive maintenance scheduler and replacement date forecasting
- Failure probability breakdown (30-day, 90-day, 1-year estimates)
- Automated actionable recommendations for thermal and electrical mitigation
- Anomaly detection log with pattern deviation insights

### 🚨 Alerts (`/alerts`)
- Active, acknowledged, and resolved alert feed
- Severity filtering (Critical, Warning, Info)
- Customizable threshold configuration for battery and environmental limits
- Audio chime triggers for critical events

### 📜 History (`/history`)
- Historical time-series record browser powered by MongoDB Atlas
- Session comparison and overlay tool
- Data export center (CSV, JSON, PDF audit reports)

### 🔧 Diagnostics (`/diagnostics`)
- Sensor hardware connectivity status (INA219, DHT11, MQ-2, MQ-135, LEDs, Buzzer)
- ESP32 runtime diagnostics: WiFi RSSI signal strength, heap memory, packet rate
- Firebase RTDB stream latency and MongoDB sync health

### 👥 Users & Roles (`/users`)
- Multi-user team management
- Role-based permissions (Admin, Operator, Viewer)
- Active session monitor and user activity logs

### ⚙️ Settings (`/settings`)
- Device naming and battery chemistry profiles (Li-ion, LiFePO4, LTO, Lead-Acid)
- Custom alarm threshold editor
- Notification preferences (Audio chimes, browser push)
- System backup and MongoDB sync interval settings

---

## 🔐 User Roles & Permissions

| Role | View Telemetry | Control Actuators | Manage Alerts | Manage Users | AI Diagnostics |
|------|:--------------:|:-----------------:|:-------------:|:------------:|:--------------:|
| 🛡️ **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| ⚡ **Operator** | ✅ | ✅ | ✅ | ❌ | ✅ |
| 👁️ **Viewer** | ✅ | ❌ | 🟡 Read Only | ❌ | ✅ |

---

## 🤖 AI Features (Gemini Integration)

### 1. Real-Time Safety Diagnostics
```json
POST /api/analyze
{
  "batteryId": "BAT001",
  "voltage": 12.6,
  "current": 2.5,
  "temperature": 28.5,
  "gasMq2": 420
}
```
**Response:**
```json
{
  "safety_score": 94,
  "risk_level": "low",
  "summary": "Battery pack operating within nominal electrical and thermal limits.",
  "recommendations": [
    "Maintain ambient ventilation below 35°C during high current draw.",
    "Gas sensors show clean baseline ambient conditions."
  ],
  "predicted_issues": []
}
```

### 2. Predictive Maintenance
```json
GET /api/predictions?batteryId=BAT001
```
**Response:**
```json
{
  "battery_health": 92,
  "estimated_lifespan": "22 months",
  "next_maintenance": "2024-06-15",
  "failure_probability": {
    "30_days": 2.4,
    "90_days": 8.1,
    "1_year": 24.5
  }
}
```

---

## 📱 Alert System & Thresholds

### Alert Categories
1. **Battery Alerts**: Overvoltage, Undervoltage, Overcurrent, Overtemperature, Critical SOC.
2. **Environmental Alerts**: High Ambient Temperature, High Humidity, Smoke Detection (MQ-2), Poor Air Quality / High CO₂ (MQ-135).
3. **Hardware Alerts**: I2C Bus Fault, Sensor Disconnect, WiFi Drop, Command Timeout.

### Default Safety Thresholds
```json
{
  "battery": {
    "voltage_min": 10.5,
    "voltage_max": 14.6,
    "current_max": 15.0,
    "temperature_max": 45.0
  },
  "environmental": {
    "temperature_max": 40.0,
    "humidity_max": 80.0,
    "mq2_threshold": 800,
    "mq135_threshold": 400
  }
}
```

---

## 🔄 Data Sync & Persistence Strategy

- **Real-Time Stream**: ESP32 pushes to Firebase RTDB every 1–2 seconds.
- **MongoDB Persistence**: The `/api/sync-to-mongo` endpoint pulls delta snapshots and writes time-series documents to the `telemetry` collection.
- **Auto Sync**: Can be triggered via external cron job, Next.js background workers, or serverless scheduled functions every 5–15 minutes.

---

## 🧪 Testing & Verification

```bash
# Run unit & lint checks
npm run lint

# Check system health
curl http://localhost:3000/api/health

# Check battery metrics
curl http://localhost:3000/api/battery/latest

# Check environmental metrics
curl http://localhost:3000/api/environmental/latest

# Simulate telemetry ingest
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "batteryId": "BAT001",
    "voltage": 12.58,
    "current": 2.34,
    "temperature": 27.2,
    "humidity": 55.0,
    "mq2": 320,
    "mq135": 110
  }'
```

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel --prod
```

### Docker Deployment
```bash
docker build -t battery-vital .
docker run -p 3000:3000 --env-file .env.local battery-vital
```

---

## 🛡️ Security Best Practices

- **Strict Validation**: All API routes validate, clamp, and sanitize incoming parameters.
- **Physics-Informed Safety**: Hardware state evaluates against deterministic bounds — AI cannot unsafely override hardware trip limits.
- **Environment Isolation**: All database credentials and Gemini API keys are server-side only and never leaked to the client bundle.
- **Rate Limiting**: AI analysis and command dispatch endpoints are protected by in-memory sliding-window rate limiters.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**.

---

**Built with ❤️ for safer, smarter battery energy storage systems.**
