const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// ===== SECURITY MIDDLEWARE =====
try {
  const { setupSecurity } = require('../middleware/security');
  setupSecurity(app);
} catch (e) {
  console.error('[SECURITY] setup failed:', e.message);
  app.use(express.json({ limit: '1mb' }));
}

// ===== MONGODB ATLAS CONNECTION =====
let dbConnected = false;
let dbConnecting = false;
let dbPromise = null;

async function ensureDB() {
  if (dbConnected) return;
  if (dbConnecting && dbPromise) {
    await dbPromise;
    return;
  }
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not configured');

  dbConnecting = true;
  dbPromise = mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    heartbeatFrequencyMS: 30000,
    maxPoolSize: 5
  }).then(() => { dbConnected = true; dbConnecting = false; })
    .catch(err => { dbConnecting = false; throw err; });

  await dbPromise;
}

// ===== IMPORT MODELS =====
let LiveData, SensorHistory, Alert, Device, Prediction, SystemEvent, MLTrainingDataset, Command;
try {
  LiveData = require('../models/LiveData');
  SensorHistory = require('../models/SensorHistory');
  Alert = require('../models/Alert');
  Device = require('../models/Device');
  Prediction = require('../models/Prediction');
  SystemEvent = require('../models/SystemEvent');
  MLTrainingDataset = require('../models/MLTrainingDataset');
  Command = require('../models/Command');
} catch (e) {
  console.error('[MODELS] import error:', e.message);
}

// ===== IMPORT MIDDLEWARE =====
let apiLimiter, deviceLimiter, aiLimiter, writeLimiter;
let validateTelemetry, validateCommand;
let logSecurity;
try {
  const rl = require('../middleware/rateLimit');
  apiLimiter = rl.apiLimiter;
  deviceLimiter = rl.deviceLimiter;
  aiLimiter = rl.aiLimiter;
  writeLimiter = rl.writeLimiter;
} catch (e) { console.error('[RATELIMIT] import error:', e.message); }

try {
  const val = require('../middleware/validation');
  validateTelemetry = val.validateTelemetry;
  validateCommand = val.validateCommand;
} catch (e) { console.error('[VALIDATION] import error:', e.message); }

try {
  logSecurity = require('../middleware/logger').logSecurity;
} catch (e) { logSecurity = (type, details) => console.error(`[SECURITY] ${type}`, details); }

// Safe middleware wrapper — never let middleware crash the whole function
function safeUse(mw, fallback) {
  if (mw) {
    app.use((req, res, next) => {
      try { mw(req, res, next); } catch (e) { next(); }
    });
  } else if (fallback) {
    app.use(fallback);
  }
}

// Apply rate limiters safely
if (apiLimiter) app.use('/api', apiLimiter);

// ===== API ROUTES =====

// ===== ESP32: POST /api/data =====
app.post('/api/data', async (req, res) => {
  try {
    await ensureDB();
    if (!LiveData || !SensorHistory) throw new Error('Models not loaded');

    const d = req.body;
    const batteryId = d.batteryId || 'BAT001';
    const now = new Date();

    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' };
    const safety = safetyMap[d.state] || 'SAFE';

    await LiveData.findOneAndUpdate(
      { batteryId },
      {
        batteryId,
        voltage:     d.voltage,
        current:     d.current     != null ? d.current / 1000 : null,
        power:       d.power       != null ? d.power   / 1000 : null,
        soc:         d.soc,
        soh:         d.soh,
        temperature: d.temperature,
        humidity:    d.humidity,
        gasIndex:    { mq2: d.mq2, mq135: d.mq135 },
        safety,
        bhi:         d.bhi,
        outputs:     {
          auto:   d.auto_mode,
          red:    d.red_led,
          yellow: d.yellow_led,
          green:  d.green_led,
          buzzer: d.buzzer
        },
        network: {
          rssi:  d.wifi_rssi,
          heap:  d.free_heap
        },
        timestamp: now
      },
      { upsert: true }
    );

    await new SensorHistory({
      batteryId,
      voltage:     d.voltage,
      current:     d.current != null ? d.current / 1000 : null,
      power:       d.power   != null ? d.power   / 1000 : null,
      soc:         d.soc,
      soh:         d.soh
    }).save();

    res.json({ success: true, ts: now.getTime() });
  } catch (err) {
    console.error('[ESP32 /api/data] error:', err.message);
    res.status(500).json({ error: 'Data ingestion failed', detail: err.message });
  }
});

// ===== ESP32: GET /api/control =====
app.get('/api/control', async (req, res) => {
  try {
    await ensureDB();
    if (!Command) throw new Error('Command model not loaded');

    let cmd = await Command.findOne({ key: 'default' }).lean();
    if (!cmd) {
      cmd = await Command.create({ key: 'default' });
      cmd = cmd.toObject();
    }
    res.json({
      auto_mode:   cmd.auto_mode,
      red_led:     cmd.red_led,
      yellow_led:  cmd.yellow_led,
      green_led:   cmd.green_led,
      buzzer:      cmd.buzzer
    });
  } catch (err) {
    res.json({ auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false });
  }
});

// ===== Dashboard: POST /api/control =====
app.post('/api/control', async (req, res) => {
  try {
    await ensureDB();
    if (!Command) throw new Error('Command model not loaded');

    const allowed = ['auto_mode', 'red_led', 'yellow_led', 'green_led', 'buzzer'];
    const update = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = !!req.body[key];
    }
    const cmd = await Command.findOneAndUpdate(
      { key: 'default' },
      { $set: update },
      { upsert: true, new: true }
    ).lean();
    res.json({ success: true, commands: cmd });
  } catch (err) {
    res.status(500).json({ error: 'Command update failed' });
  }
});

// ===== ESP32: POST /api/alerts/esp32 =====
app.post('/api/alerts/esp32', async (req, res) => {
  try {
    await ensureDB();
    if (!Alert) throw new Error('Alert model not loaded');

    const alert = new Alert({
      batteryId:  req.body.batteryId  || 'BAT001',
      severity:   (req.body.severity  || 'INFO').toUpperCase(),
      type:       req.body.message    || 'ESP32_ALERT',
      message:    req.body.message    || 'Alert from device',
      bhi:        req.body.bhi,
      sensorData: { voltage: req.body.voltage, temperature: req.body.temperature }
    });
    await alert.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Alert save failed' });
  }
});

// ===== GET /api/telemetry =====
app.get('/api/telemetry', async (req, res) => {
  try {
    await ensureDB();
    if (!LiveData) throw new Error('LiveData model not loaded');

    const data = await LiveData.findOne({ batteryId: 'BAT001' }).sort({ timestamp: -1 }).lean();
    if (!data) return res.json({ message: 'No data yet' });
    res.json({
      gas: { index_mq2: data.gasIndex?.mq2, status_mq2: '--', index_mq135: data.gasIndex?.mq135, warm: true },
      environment: { temperature: data.temperature, humidity: data.humidity },
      battery: { voltage: data.voltage, current: data.current, power: data.power, soc: data.soc, safety: data.safety, op: data.opDirection, resistance: data.resistance },
      risk: { bhi: data.bhi },
      network: data.network,
      outputs: data.outputs,
      firmware: '--',
      uptime: '--',
      errors: 0
    });
  } catch (err) {
    if (logSecurity) logSecurity('LEGACY_ENDPOINT_ERROR', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== POST /api/telemetry =====
app.post('/api/telemetry', async (req, res) => {
  try {
    await ensureDB();
    if (!LiveData || !SensorHistory) throw new Error('Models not loaded');

    const batteryId = req.body.batteryId || 'BAT001';
    const now = new Date();

    await LiveData.findOneAndUpdate(
      { batteryId },
      {
        batteryId,
        voltage: req.body.voltage,
        current: req.body.current,
        power: req.body.power,
        soc: req.body.soc,
        soh: req.body.soh,
        temperature: req.body.temperature,
        humidity: req.body.humidity,
        gasIndex: req.body.gasIndex || { mq2: req.body.gas?.index_mq2, mq135: req.body.gas?.index_mq135 },
        safety: req.body.safety,
        bhi: req.body.risk?.bhi,
        opDirection: req.body.op,
        resistance: req.body.resistance,
        outputs: req.body.outputs,
        network: req.body.network,
        timestamp: now
      },
      { upsert: true }
    );

    await new SensorHistory({
      batteryId,
      voltage: req.body.voltage,
      current: req.body.current,
      power: req.body.power,
      soc: req.body.soc,
      soh: req.body.soh,
      resistance: req.body.resistance,
      opDirection: req.body.op
    }).save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Data ingestion failed' });
  }
});

// ===== POST /api/commands =====
app.post('/api/commands', async (req, res) => {
  try {
    await ensureDB();
    if (!SystemEvent) throw new Error('SystemEvent model not loaded');

    const event = new SystemEvent({
      type: 'USER_ACTION',
      severity: 'INFO',
      message: `Command: ${req.body.command} ${req.body.value || ''}`,
      details: { command: req.body.command, value: req.body.value }
    });
    await event.save();
    res.json({ success: true, message: 'Command logged' });
  } catch (err) {
    res.status(500).json({ error: 'Command failed' });
  }
});

// ===== GET /api/stats =====
app.get('/api/stats', async (req, res) => {
  try {
    await ensureDB();
    if (!SensorHistory || !Alert || !LiveData || !Device) throw new Error('Models not loaded');

    const [totalReadings, totalAlerts, liveData, deviceCount] = await Promise.all([
      SensorHistory.countDocuments(),
      Alert.countDocuments(),
      LiveData.findOne({ batteryId: 'BAT001' }).lean(),
      Device.countDocuments()
    ]);
    res.json({
      totalReadings,
      totalAlerts,
      deviceCount,
      lastReading: liveData?.timestamp,
      currentSoc: liveData?.soc,
      currentSafety: liveData?.safety,
      currentBhi: liveData?.bhi
    });
  } catch (err) {
    res.status(500).json({ error: 'Stats unavailable' });
  }
});

// ===== ML Training Data =====
app.get('/api/ml-training-data', async (req, res) => {
  try {
    await ensureDB();
    if (!MLTrainingDataset) throw new Error('MLTrainingDataset model not loaded');

    const { limit = 1000, label } = req.query;
    const query = {};
    if (label && typeof label === 'string') query.label = label;
    const data = await MLTrainingDataset.find(query).limit(Math.min(parseInt(limit) || 1000, 5000)).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

app.post('/api/ml-training-data', async (req, res) => {
  try {
    await ensureDB();
    if (!MLTrainingDataset) throw new Error('MLTrainingDataset model not loaded');

    const data = new MLTrainingDataset(req.body);
    await data.save();
    res.json({ success: true, id: data._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ===== GEMINI AI ANALYSIS =====
app.post('/api/analyze', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(503).json({ success: false, error: 'AI service not configured' });
  }

  const safe = {};
  const allowedFields = ['voltage', 'current', 'temperature', 'humidity', 'gasMq2', 'gasMq135', 'soc', 'safety', 'resistance', 'bhi', 'power', 'opDirection', 'batteryId'];
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      safe[key] = typeof req.body[key] === 'number'
        ? Math.max(-99999, Math.min(99999, req.body[key]))
        : String(req.body[key]).substring(0, 100);
    }
  }

  try {
    const prompt = `You are a battery safety expert AI. Analyze this battery data and respond in JSON only.

Battery Data:
- Voltage: ${safe.voltage}V
- Current: ${safe.current}A
- Temperature: ${safe.temperature}\u00B0C
- Humidity: ${safe.humidity}%
- Gas MQ2 Index: ${safe.gasMq2}
- Gas MQ135 VOC Index: ${safe.gasMq135}
- SOC: ${safe.soc}%
- Safety Status: ${safe.safety}
- Internal Resistance: ${safe.resistance} mOhm
- BHI Score: ${safe.bhi}
- Power: ${safe.power}W
- Direction: ${safe.opDirection}

Respond with EXACTLY this JSON format, nothing else:
{
  "health": "excellent or good or warning or critical or failure",
  "bhi": 0 to 100 number,
  "thermal_runaway_risk": true or false,
  "anomaly_detected": true or false,
  "remaining_cycles": number,
  "remaining_months": number,
  "danger_level": "safe or warning or danger",
  "explanation": "one sentence explaining the battery condition",
  "action": "recommended action to take"
}

Rules:
- temp > 55 = critical thermal risk
- voltage < 12 = critical
- Gas MQ2 > 2000 = thermal runaway true
- SOC < 20 and current > 3 = warning
- BHI > 75 = critical danger
- Be conservative, safety first
- JSON only, no other text`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
        })
      }
    );

    if (!response.ok) throw new Error('AI service temporarily unavailable');

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty AI response');

    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const prediction = JSON.parse(cleanText);

    try {
      await ensureDB();
      if (Prediction) {
        await Prediction.create({
          batteryId: safe.batteryId || 'BAT001',
          riskLevel: prediction.danger_level === 'danger' ? 'CRITICAL' : prediction.danger_level === 'warning' ? 'HIGH' : 'LOW',
          riskScore: prediction.bhi,
          analysis: prediction.explanation,
          recommendations: prediction.action ? [prediction.action] : [],
          modelVersion: 'gemini-2.0-flash'
        });
      }
    } catch (e) { /* non-critical */ }

    res.json({ success: true, prediction });
  } catch (error) {
    if (logSecurity) logSecurity('AI_ANALYSIS_ERROR', { error: error.message });
    res.status(500).json({ success: false, error: 'AI analysis failed' });
  }
});

// ===== ALERTS ROUTES (via router module) =====
try {
  const alertRoutes = require('../routes/alerts');
  app.use('/api', alertRoutes);
} catch (e) { console.error('[ROUTES] alerts import error:', e.message); }

try {
  const telemetryRoutes = require('../routes/telemetry');
  app.use('/api', telemetryRoutes);
} catch (e) { console.error('[ROUTES] telemetry import error:', e.message); }

try {
  const deviceRoutes = require('../routes/devices');
  app.use('/api/devices', deviceRoutes);
} catch (e) { console.error('[ROUTES] devices import error:', e.message); }

// ===== ERROR HANDLING =====
try {
  const { errorHandler, notFound } = require('../middleware/errorHandler');
  app.use(notFound);
  app.use(errorHandler);
} catch (e) {
  app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });
}

// ===== EXPORT FOR VERCEL =====
module.exports = app;
