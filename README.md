# Battery Vital — Intelligent Battery Safety System

A full-stack battery monitoring and safety dashboard for EV/ESS battery packs. Built on Next.js (App Router) with Firebase Realtime Database live streaming, MongoDB Atlas background persistence, and Gemini AI-driven analysis and predictive alerts.

## Architecture

```
ESP32 devices
   │  HTTPS (Firebase SDK / REST)
   ▼
Firebase Realtime Database ──► Website (real-time listener, instant updates)
   │
   │  Cron job / background sync
   ▼
MongoDB (historical archive, AI training data, long-term analytics)
   │
   ▼
Gemini AI (reads from Firebase for live analysis, saves to MongoDB)
```

- **ESP32 devices** publish battery telemetry (voltage, current, temperature, SOC) directly to **Firebase Realtime Database** (`/live_data/BAT001`) and poll/listen to commands (`/commands/BAT001`).
- **Firebase Realtime Database** provides zero-latency bi-directional push updates directly to the web dashboard, replacing the earlier MQTT bridge.
- **MongoDB Atlas** maintains historical time-series logs and audit events via background sync (`/api/sync-to-mongo`).
- **Next.js API routes** (`src/app/api/*`) expose data via REST and trigger AI analysis.
- **Gemini AI** (`src/lib/gemini.js`, `/api/analyze`, `/api/predictions`) generates insights, safety recommendations, and failure predictions.

## Tech Stack

- Next.js 14 (App Router), React 18
- Firebase Realtime Database (via `firebase` client & `firebase-admin` server SDK)
- MongoDB Atlas (via `mongodb` driver) — `src/lib/mongodb.js`
- Google Gemini AI — `src/lib/gemini.js`
- Recharts for live/history charts, Lucide React icons

## Project Structure

```
src/app/               # Next.js App Router pages and API routes
  page.js              # Live Dashboard
  analytics/           # Analytics / charts
  settings/            # Configuration
  alerts/              # Alerts feed
  history/             # Historical telemetry
  controls/            # Device control panel
  ai/                  # AI insights / predictions
  diagnostics/         # System hardware diagnostics
  api/                 # Backend REST API routes
src/
  lib/
    firebase.js        # Client-side Firebase RTDB initialization & helpers
    firebaseAdmin.js   # Server-side Firebase Admin SDK
    mongodb.js         # Mongo client & connection
    gemini.js          # Gemini API wrapper
    utils.js           # Shared helpers
  hooks/
    useFirebase.js     # Real-time Firebase RTDB hook
    useRealTimeData.js # Aggregated telemetry hook
    useAI.js           # AI insights hook
  components/
    Header.jsx, Layout.jsx, MetricCard.jsx, LiveChart.jsx,
    ControlPanel.jsx, AIInsights.jsx, AlertsList.jsx
esp32/
  BatteryVitals_v12.0.ino  # Industrial ESP32 firmware with Firebase RTDB push
```

### API Endpoints (`/api/*`)

| Endpoint | Purpose |
| --- | --- |
| `/api/health` | Health & connection checks (Firebase + MongoDB) |
| `/api/status` | System status summary |
| `/api/latest` | Latest reading(s) per pack from Firebase |
| `/api/telemetry` | Latest telemetry snapshot / ingest |
| `/api/data` | Persisted telemetry data |
| `/api/history` | Historical range query from MongoDB |
| `/api/stats` | Aggregated statistics |
| `/api/analyze` | Gemini safety analysis |
| `/api/predictions` | Gemini failure prediction |
| `/api/alerts` | Read/create alerts |
| `/api/control` | Control state management |
| `/api/commands` | Control command dispatch |
| `/api/sync-to-mongo` | Firebase → MongoDB background sync |

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment — copy `.env.example` to `.env` and fill in Firebase and MongoDB credentials.

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Lint
```
