# Battery Vital — Intelligent Battery Safety System

A full-stack battery monitoring and safety dashboard for EV/ESS battery packs. Built on Next.js (Pages Router) with MongoDB persistence, MQTT device ingestion, and Gemini AI-driven analysis and predictive alerts.

## Architecture

```
ESP32 devices
   │  MQTT publish (telemetry)
   ▼
MQTT broker ──► /api/mqtt-bridge ──► MongoDB
                                        │
   Browsers ──► Next.js Pages/Routes ───┘
                    │
                    └──► /api/analyze & /api/predictions ──► Gemini AI
```

- **ESP32 devices** publish battery telemetry (voltage, current, temperature, SOC) over MQTT.
- **MQTT bridge** (`/api/mqtt-bridge` + `src/lib/mqtt.js`) subscribes to the broker and writes readings into MongoDB.
- **Next.js API routes** (`src/pages/api/*`) expose the data via REST and trigger AI analysis.
- **Gemini AI** (`src/lib/gemini.js`, `/api/analyze`, `/api/predictions`) generates insights, safety recommendations, and short-term failure predictions.
- **Realtime UI** uses `src/hooks` (`useMQTT`, `useRealTimeData`, `useAI`) and Server-Sent Events / polling to update live charts.

## Tech Stack

- Next.js 14 (Pages Router), React 18
- MongoDB (via `mongodb` driver) — `src/lib/mongodb.js`
- MQTT (via `mqtt` client) — `src/lib/mqtt.js`
- Google Gemini AI — `src/lib/gemini.js`
- Recharts for live/history charts, lucide-react icons

## Project Structure

```
pages/                 # Next.js pages and API routes under /api
  index.js             # Dashboard
  analytics.js         # Analytics / charts
  settings.js          # Configuration
  alerts.js            # Alerts feed
  history.js           # Historical telemetry
  controls.js          # Device control panel
  ai.js                # AI insights / predictions
  _app.js              # Root App (global styles + PWA/SW registration)
  _document.js         # Custom document (fonts, manifest, favicon)
  404.js               # Custom not-found page
src/
  lib/
    mongodb.js         # Mongo client & connection
    mqtt.js            # MQTT bridge client & subscription
    gemini.js          # Gemini API wrapper
    utils.js           # Shared helpers
  hooks/
    useMQTT.js         # Real-time MQTT data hook
    useRealTimeData.js # MQTT + HTTP polling aggregation hook
    useAI.js           # AI insights hook
  components/
    Header.jsx, Layout.jsx, MetricCard.jsx, LiveChart.jsx,
    ControlPanel.jsx, AIInsights.jsx, AlertsList.jsx
  styles/globals.css   # Global styles
  styles/*.module.css  # CSS Modules (pages + components)
public/                # Static assets (manifest, icons, sw.js, robots.txt, sitemap.xml)
```

### API Endpoints (`/api/*`)

| Endpoint | Purpose |
| --- | --- |
| `/api/health` | Service health / liveness |
| `/api/status` | System status summary |
| `/api/latest` | Latest reading(s) per pack |
| `/api/data` | Persisted telemetry data |
| `/api/history` | Historical range query |
| `/api/telemetry` | Latest telemetry snapshot |
| `/api/stats` | Aggregated statistics |
| `/api/analyze` | Gemini safety analysis |
| `/api/predictions` | Gemini failure prediction |
| `/api/alerts` | Read/create alerts |
| `/api/control` | Send control commands |
| `/api/commands` | Command dispatch |
| `/api/mqtt-bridge` | MQTT → MongoDB ingest |

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment — copy `.env.example` to `.env` and fill in values. See everything used:

   ```env
   MONGODB_URI=...
   MQTT_URL=...
   GEMINI_API_KEY=...
   ```

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

## Deployment

Deployment targets Vercel (`vercel.json`). See `.env.example` for the required environment variables.
