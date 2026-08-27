const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const LiveData = require('../models/LiveData');
const SensorHistory = require('../models/SensorHistory');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const Prediction = require('../models/Prediction');
const SystemEvent = require('../models/SystemEvent');
const MLTrainingDataset = require('../models/MLTrainingDataset');
const Command = require('../models/Command');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let dbConnected = false;
let dbConnecting = false;
let dbPromise = null;

async function ensureDB() {
  if (dbConnected) return;
  if (dbConnecting && dbPromise) { await dbPromise; return; }
  const URI = process.env.MONGODB_URI;
  if (!URI) throw new Error('MONGODB_URI not set');
  dbConnecting = true;
  dbPromise = mongoose.connect(URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 5
  }).then(() => { dbConnected = true; dbConnecting = false; })
    .catch(e => { dbConnecting = false; throw e; });
  await dbPromise;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbConnected, uptime: process.uptime(), ts: Date.now() });
});

app.post('/api/data', async (req, res) => {
  try {
    await ensureDB();
    const d = req.body;
    const batteryId = d.batteryId || 'BAT001';
    const now = new Date();
    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' };
    const safety = safetyMap[d.state] || 'SAFE';

    await LiveData.findOneAndUpdate({ batteryId }, {
      batteryId, voltage: d.voltage,
      current: d.current != null ? d.current / 1000 : null,
      power: d.power != null ? d.power / 1000 : null,
      soc: d.soc, soh: d.soh,
      temperature: d.temperature, humidity: d.humidity,
      gasIndex: { mq2: d.mq2, mq135: d.mq135 },
      safety, bhi: d.bhi,
      outputs: { auto: d.auto_mode, red: d.red_led, yellow: d.yellow_led, green: d.green_led, buzzer: d.buzzer },
      network: { rssi: d.wifi_rssi, heap: d.free_heap },
      timestamp: now
    }, { upsert: true });

    await new SensorHistory({
      batteryId, voltage: d.voltage,
      current: d.current != null ? d.current / 1000 : null,
      power: d.power != null ? d.power / 1000 : null,
      soc: d.soc, soh: d.soh
    }).save();

    res.json({ success: true, ts: now.getTime() });
  } catch (err) {
    console.error('[/api/data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/control', async (req, res) => {
  try {
    await ensureDB();
    let cmd = await Command.findOne({ key: 'default' }).lean();
    if (!cmd) {
      cmd = await Command.create({ key: 'default' });
      cmd = cmd.toObject();
    }
    res.json({ auto_mode: cmd.auto_mode, red_led: cmd.red_led, yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer });
  } catch (err) {
    console.error('[/api/control GET]', err.message);
    res.json({ auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false });
  }
});

app.post('/api/control', async (req, res) => {
  try {
    await ensureDB();
    const allowed = ['auto_mode', 'red_led', 'yellow_led', 'green_led', 'buzzer'];
    const update = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = !!req.body[key];
    }
    const cmd = await Command.findOneAndUpdate({ key: 'default' }, { $set: update }, { upsert: true, new: true }).lean();
    res.json({ success: true, commands: cmd });
  } catch (err) {
    console.error('[/api/control POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/esp32', async (req, res) => {
  try {
    await ensureDB();
    await new Alert({
      batteryId: req.body.batteryId || 'BAT001',
      severity: (req.body.severity || 'INFO').toUpperCase(),
      type: req.body.message || 'ESP32_ALERT',
      message: req.body.message || 'Alert from device',
      bhi: req.body.bhi,
      sensorData: { voltage: req.body.voltage, temperature: req.body.temperature }
    }).save();
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/alerts/esp32]', err.message);
    res.status(500).json({ error: err.message });
  }
});

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
      network: data.network, outputs: data.outputs,
      firmware: '--', uptime: '--', errors: 0
    });
  } catch (err) {
    console.error('[/api/telemetry GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/telemetry', async (req, res) => {
  try {
    await ensureDB();
    const batteryId = req.body.batteryId || 'BAT001';
    const now = new Date();
    await LiveData.findOneAndUpdate({ batteryId }, {
      batteryId, voltage: req.body.voltage, current: req.body.current, power: req.body.power,
      soc: req.body.soc, soh: req.body.soh,
      temperature: req.body.temperature, humidity: req.body.humidity,
      gasIndex: req.body.gasIndex || { mq2: req.body.gas?.index_mq2, mq135: req.body.gas?.index_mq135 },
      safety: req.body.safety, bhi: req.body.risk?.bhi,
      opDirection: req.body.op, resistance: req.body.resistance,
      outputs: req.body.outputs, network: req.body.network, timestamp: now
    }, { upsert: true });
    await new SensorHistory({
      batteryId, voltage: req.body.voltage, current: req.body.current, power: req.body.power,
      soc: req.body.soc, soh: req.body.soh, resistance: req.body.resistance, opDirection: req.body.op
    }).save();
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/telemetry POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sensor-history', async (req, res) => {
  try {
    await ensureDB();
    const { batteryId = 'BAT001', minutes = 60, limit = 500 } = req.query;
    const since = new Date(Date.now() - parseInt(minutes) * 60 * 1000);
    const data = await SensorHistory.find({ batteryId, timestamp: { $gte: since } }).sort({ timestamp: 1 }).limit(parseInt(limit)).lean();
    res.json(data.map(d => ({ time: d.timestamp, voltage: d.voltage, current: d.current, power: d.power, soc: d.soc, soh: d.soh })));
  } catch (err) {
    console.error('[/api/sensor-history]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    await ensureDB();
    const [totalReadings, totalAlerts, liveData, deviceCount] = await Promise.all([
      SensorHistory.countDocuments(), Alert.countDocuments(),
      LiveData.findOne({ batteryId: 'BAT001' }).lean(), Device.countDocuments()
    ]);
    res.json({ totalReadings, totalAlerts, deviceCount, lastReading: liveData?.timestamp, currentSoc: liveData?.soc, currentSafety: liveData?.safety, currentBhi: liveData?.bhi });
  } catch (err) {
    console.error('[/api/stats]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    await ensureDB();
    const { batteryId, severity, limit = 100 } = req.query;
    const query = {};
    if (batteryId) query.batteryId = batteryId;
    if (severity && severity !== 'all') query.severity = severity.toUpperCase();
    const alerts = await Alert.find(query).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
    res.json(alerts.map(a => ({
      id: a._id, time: a.timestamp, severity: a.severity, type: a.type,
      bhi: a.bhi, message: a.message, acknowledged: a.acknowledged
    })));
  } catch (err) {
    console.error('[/api/alerts GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts', async (req, res) => {
  try {
    await ensureDB();
    const alert = new Alert({
      batteryId: req.body.batteryId || 'BAT001', severity: req.body.severity,
      type: req.body.type, message: req.body.message, bhi: req.body.bhi, sensorData: req.body.sensorData
    });
    await alert.save();
    res.json({ success: true, id: alert._id });
  } catch (err) {
    console.error('[/api/alerts POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/alerts/:id/acknowledge', async (req, res) => {
  try {
    await ensureDB();
    await Alert.findByIdAndUpdate(req.params.id, { acknowledged: true, acknowledgedAt: new Date() });
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/alerts/ack]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/predictions', async (req, res) => {
  try {
    await ensureDB();
    const { batteryId, limit = 10 } = req.query;
    const query = {};
    if (batteryId) query.batteryId = batteryId;
    const preds = await Prediction.find(query).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
    res.json(preds);
  } catch (err) {
    console.error('[/api/predictions]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ml-training-data', async (req, res) => {
  try {
    await ensureDB();
    const { limit = 1000, label } = req.query;
    const query = {};
    if (label && typeof label === 'string') query.label = label;
    const data = await MLTrainingDataset.find(query).limit(Math.min(parseInt(limit) || 1000, 5000)).lean();
    res.json(data);
  } catch (err) {
    console.error('[/api/ml-training-data GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ml-training-data', async (req, res) => {
  try {
    await ensureDB();
    const data = new MLTrainingDataset(req.body);
    await data.save();
    res.json({ success: true, id: data._id });
  } catch (err) {
    console.error('[/api/ml-training-data POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/commands', async (req, res) => {
  try {
    await ensureDB();
    await new SystemEvent({
      type: 'USER_ACTION', severity: 'INFO',
      message: `Command: ${req.body.command} ${req.body.value || ''}`,
      details: { command: req.body.command, value: req.body.value }
    }).save();
    res.json({ success: true });
  } catch (err) {
    console.error('[/api/commands]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/devices', async (req, res) => {
  try {
    await ensureDB();
    const devices = await Device.find().sort({ lastSeen: -1 }).lean();
    res.json(devices);
  } catch (err) {
    console.error('[/api/devices]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(503).json({ success: false, error: 'AI not configured' });
  const safe = {};
  const fields = ['voltage', 'current', 'temperature', 'humidity', 'gasMq2', 'gasMq135', 'soc', 'safety', 'resistance', 'bhi', 'power', 'opDirection', 'batteryId'];
  for (const k of fields) {
    if (req.body[k] !== undefined) {
      safe[k] = typeof req.body[k] === 'number' ? Math.max(-99999, Math.min(99999, req.body[k])) : String(req.body[k]).substring(0, 100);
    }
  }
  try {
    const prompt = `Battery safety expert. Analyze and respond JSON only:\nV:${safe.voltage}V I:${safe.current}A T:${safe.temperature}C H:${safe.humidity}% MQ2:${safe.gasMq2} MQ135:${safe.gasMq135} SOC:${safe.soc}% Safety:${safe.safety} R:${safe.resistance}mOhm BHI:${safe.bhi} P:${safe.power}W\n{"health":"excellent|good|warning|critical|failure","bhi":0-100,"thermal_runaway_risk":bool,"anomaly_detected":bool,"remaining_cycles":num,"remaining_months":num,"danger_level":"safe|warning|danger","explanation":"one sentence","action":"recommendation"}`;
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 500 } })
    });
    if (!resp.ok) throw new Error('AI unavailable');
    const result = await resp.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty AI response');
    const prediction = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    try {
      await Prediction.create({
        batteryId: safe.batteryId || 'BAT001',
        riskLevel: prediction.danger_level === 'danger' ? 'CRITICAL' : prediction.danger_level === 'warning' ? 'HIGH' : 'LOW',
        riskScore: prediction.bhi, analysis: prediction.explanation,
        recommendations: prediction.action ? [prediction.action] : [], modelVersion: 'gemini-2.0-flash'
      });
    } catch (e) { /* non-critical */ }
    res.json({ success: true, prediction });
  } catch (error) {
    console.error('[/api/analyze]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use((req, res) => { res.status(404).json({ error: 'Not found', path: req.originalUrl }); });
app.use((err, req, res, next) => { console.error('[UNHANDLED]', err.message); res.status(500).json({ error: 'Internal server error' }); });

module.exports = app;
