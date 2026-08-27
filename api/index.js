const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

// ===== SECURITY MIDDLEWARE =====
const { setupSecurity } = require('../middleware/security');
const { apiLimiter, deviceLimiter, aiLimiter, writeLimiter } = require('../middleware/rateLimit');
const { validateTelemetry, validateCommand } = require('../middleware/validation');
const { errorHandler, notFound } = require('../middleware/errorHandler');
const { logSecurity } = require('../middleware/logger');

setupSecurity(app);

// ===== MONGODB ATLAS CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI;

let dbConnected = false;

async function ensureDB() {
  if (dbConnected) return;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    maxPoolSize: 5
  });
  dbConnected = true;
}

// ===== IMPORT MODELS =====
const LiveData = require('../models/LiveData');
const SensorHistory = require('../models/SensorHistory');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const Prediction = require('../models/Prediction');
const SystemEvent = require('../models/SystemEvent');
const MLTrainingDataset = require('../models/MLTrainingDataset');
const Command = require('../models/Command');

// ===== IMPORT ROUTES =====
const telemetryRoutes = require('../routes/telemetry');
const alertRoutes = require('../routes/alerts');
const deviceRoutes = require('../routes/devices');

// ===== API ROUTES =====
app.use('/api', apiLimiter);
app.use('/api', telemetryRoutes);
app.use('/api', alertRoutes);
app.use('/api/devices', deviceRoutes);

// ===== ESP32: POST /api/data — Send sensor payload =====
app.post('/api/data', deviceLimiter, async (req, res) => {
  try {
    await ensureDB();
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

// ===== ESP32: GET /api/control — Poll for LED/buzzer commands =====
app.get('/api/control', async (req, res) => {
  try {
    await ensureDB();
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

// ===== Dashboard: POST /api/control — Send commands to ESP32 =====
app.post('/api/control', writeLimiter, async (req, res) => {
  try {
    await ensureDB();
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

// ===== ESP32: POST /api/alerts/esp32 — Send critical alerts =====
app.post('/api/alerts/esp32', deviceLimiter, async (req, res) => {
  try {
    await ensureDB();
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

// ===== GET /api/telemetry — Frontend reads latest data =====
app.get('/api/telemetry', async (req, res) => {
  try {
    await ensureDB();
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
    logSecurity('LEGACY_ENDPOINT_ERROR', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== POST /api/telemetry — Legacy telemetry ingestion =====
app.post('/api/telemetry', deviceLimiter, validateTelemetry, async (req, res) => {
  try {
    await ensureDB();
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

// ===== POST /api/commands — Log user commands =====
app.post('/api/commands', writeLimiter, validateCommand, async (req, res) => {
  try {
    await ensureDB();
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

// ===== GET /api/stats — Dashboard statistics =====
app.get('/api/stats', async (req, res) => {
  try {
    await ensureDB();
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
    const { limit = 1000, label } = req.query;
    const query = {};
    if (label && typeof label === 'string') query.label = label;
    const data = await MLTrainingDataset.find(query).limit(Math.min(parseInt(limit) || 1000, 5000)).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

app.post('/api/ml-training-data', writeLimiter, async (req, res) => {
  try {
    await ensureDB();
    const data = new MLTrainingDataset(req.body);
    await data.save();
    res.json({ success: true, id: data._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ===== GEMINI AI ANALYSIS =====
app.post('/api/analyze', aiLimiter, async (req, res) => {
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
      await Prediction.create({
        batteryId: safe.batteryId || 'BAT001',
        riskLevel: prediction.danger_level === 'danger' ? 'CRITICAL' : prediction.danger_level === 'warning' ? 'HIGH' : 'LOW',
        riskScore: prediction.bhi,
        analysis: prediction.explanation,
        recommendations: prediction.action ? [prediction.action] : [],
        modelVersion: 'gemini-2.0-flash'
      });
    } catch (e) { /* non-critical */ }

    res.json({ success: true, prediction });
  } catch (error) {
    logSecurity('AI_ANALYSIS_ERROR', { error: error.message });
    res.status(500).json({ success: false, error: 'AI analysis failed' });
  }
});

// ===== SERVE FRONTEND (local dev only) =====
app.use(express.static(path.join(__dirname, '..'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ===== ERROR HANDLING =====
app.use(notFound);
app.use(errorHandler);

// ===== EXPORT FOR VERCEL =====
module.exports = app;
