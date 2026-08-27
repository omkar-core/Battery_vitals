const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '1mb' }));

// Load all models
const LiveData = require('./models/LiveData');
const SensorHistory = require('./models/SensorHistory');
const Alert = require('./models/Alert');
const Device = require('./models/Device');
const Prediction = require('./models/Prediction');
const SystemEvent = require('./models/SystemEvent');
const MLTrainingDataset = require('./models/MLTrainingDataset');
const Command = require('./models/Command');

let dbConnected = false;
async function ensureDB() {
  if (dbConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 });
  dbConnected = true;
}

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', db: dbConnected, uptime: process.uptime(), ts: Date.now() }));

// ESP32 data (all aliases)
async function handleSensorData(req, res) {
  try {
    await ensureDB();
    const d = req.body;
    const batteryId = d.batteryId || 'BAT001';
    const now = new Date();
    const safety = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }[d.state] || 'SAFE';
    await LiveData.findOneAndUpdate({ batteryId }, {
      batteryId, voltage: d.voltage,
      current: d.current != null ? d.current / 1000 : null,
      power: d.power != null ? d.power / 1000 : null,
      soc: d.soc, soh: d.soh, temperature: d.temperature, humidity: d.humidity,
      gasIndex: { mq2: d.mq2, mq135: d.mq135 }, safety, bhi: d.bhi,
      outputs: { auto: d.auto_mode, red: d.red_led, yellow: d.yellow_led, green: d.green_led, buzzer: d.buzzer },
      network: { rssi: d.wifi_rssi, heap: d.free_heap }, timestamp: now
    }, { upsert: true });
    await new SensorHistory({ batteryId, voltage: d.voltage, current: d.current != null ? d.current / 1000 : null, power: d.power != null ? d.power / 1000 : null, soc: d.soc, soh: d.soh }).save();
    res.json({ success: true, ts: now.getTime() });
  } catch (err) { console.error('[data]', err.message); res.status(500).json({ error: err.message }); }
}
app.post('/api/data', handleSensorData);
app.post('/api/battery-data', handleSensorData);

// Control
app.get('/api/control', async (req, res) => {
  try {
    await ensureDB();
    let cmd = await Command.findOne({ key: 'default' }).lean();
    if (!cmd) { cmd = await Command.create({ key: 'default' }); cmd = cmd.toObject(); }
    res.json({ auto_mode: cmd.auto_mode, red_led: cmd.red_led, yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer });
  } catch (err) { res.json({ auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false }); }
});
app.post('/api/control', async (req, res) => {
  try {
    await ensureDB();
    const allowed = ['auto_mode', 'red_led', 'yellow_led', 'green_led', 'buzzer'];
    const update = { updatedAt: new Date() };
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = !!req.body[k];
    const cmd = await Command.findOneAndUpdate({ key: 'default' }, { $set: update }, { upsert: true, new: true }).lean();
    res.json({ success: true, commands: cmd });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Alerts
app.get('/api/alerts', async (req, res) => {
  try {
    await ensureDB();
    const { batteryId, severity, limit = 100 } = req.query;
    const q = {}; if (batteryId) q.batteryId = batteryId; if (severity && severity !== 'all') q.severity = severity.toUpperCase();
    const alerts = await Alert.find(q).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
    res.json(alerts.map(a => ({ id: a._id, time: a.timestamp, severity: a.severity, type: a.type, bhi: a.bhi, message: a.message, acknowledged: a.acknowledged })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/alerts', async (req, res) => {
  try {
    await ensureDB();
    const alert = new Alert({ batteryId: req.body.batteryId || 'BAT001', severity: req.body.severity, type: req.body.type, message: req.body.message, bhi: req.body.bhi, sensorData: req.body.sensorData });
    await alert.save(); res.json({ success: true, id: alert._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Telemetry
app.get('/api/telemetry', async (req, res) => {
  try {
    await ensureDB();
    const data = await LiveData.findOne({ batteryId: 'BAT001' }).sort({ timestamp: -1 }).lean();
    if (!data) return res.json({ message: 'No data yet' });
    res.json({ gas: { index_mq2: data.gasIndex?.mq2, status_mq2: '--', index_mq135: data.gasIndex?.mq135, warm: true }, environment: { temperature: data.temperature, humidity: data.humidity }, battery: { voltage: data.voltage, current: data.current, power: data.power, soc: data.soc, safety: data.safety }, risk: { bhi: data.bhi }, network: data.network, outputs: data.outputs, firmware: '--', uptime: '--', errors: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats
app.get('/api/stats', async (req, res) => {
  try {
    await ensureDB();
    const [r, a, l, d] = await Promise.all([SensorHistory.countDocuments(), Alert.countDocuments(), LiveData.findOne({ batteryId: 'BAT001' }).lean(), Device.countDocuments()]);
    res.json({ totalReadings: r, totalAlerts: a, deviceCount: d, lastReading: l?.timestamp, currentSoc: l?.soc, currentSafety: l?.safety, currentBhi: l?.bhi });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sensor history
app.get('/api/sensor-history', async (req, res) => {
  try {
    await ensureDB();
    const { batteryId = 'BAT001', minutes = 60, limit = 500 } = req.query;
    const data = await SensorHistory.find({ batteryId, timestamp: { $gte: new Date(Date.now() - parseInt(minutes) * 60 * 1000) } }).sort({ timestamp: 1 }).limit(parseInt(limit)).lean();
    res.json(data.map(d => ({ time: d.timestamp, voltage: d.voltage, current: d.current, power: d.power, soc: d.soc, soh: d.soh })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Predictions
app.get('/api/predictions', async (req, res) => {
  try {
    await ensureDB();
    const { batteryId, limit = 10 } = req.query;
    const q = {}; if (batteryId) q.batteryId = batteryId;
    res.json(await Prediction.find(q).sort({ timestamp: -1 }).limit(parseInt(limit)).lean());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI
app.post('/api/analyze', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(503).json({ success: false, error: 'AI not configured' });
  const safe = {};
  for (const k of ['voltage', 'current', 'temperature', 'humidity', 'gasMq2', 'gasMq135', 'soc', 'safety', 'resistance', 'bhi', 'power', 'opDirection', 'batteryId']) {
    if (req.body[k] !== undefined) safe[k] = typeof req.body[k] === 'number' ? Math.max(-99999, Math.min(99999, req.body[k])) : String(req.body[k]).substring(0, 100);
  }
  try {
    const prompt = `Battery safety expert. JSON only:\nV:${safe.voltage} I:${safe.current} T:${safe.temperature} H:${safe.humidity} MQ2:${safe.gasMq2} MQ135:${safe.gasMq135} SOC:${safe.soc} Safety:${safe.safety} R:${safe.resistance} BHI:${safe.bhi} P:${safe.power}\n{"health":"excellent|good|warning|critical","bhi":0-100,"thermal_runaway_risk":bool,"danger_level":"safe|warning|danger","explanation":"one sentence","action":"recommendation"}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 500 } }) });
    if (!r.ok) throw new Error('AI unavailable');
    const result = await r.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty AI response');
    res.json({ success: true, prediction: JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim()) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Static files (local dev only)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Battery Vital Server v2.1 (Dev Mode)`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  DB:  MongoDB Atlas\n`);
});
