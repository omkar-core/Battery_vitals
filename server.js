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

// Commands — dashboard sendCommand contract {command, value, requestId}
app.get('/api/commands', async (req, res) => {
  try {
    await ensureDB();
    let cmd = await Command.findOne({ key: 'default' }).lean();
    if (!cmd) { cmd = await Command.create({ key: 'default' }); cmd = cmd.toObject(); }
    res.json({ auto_mode: cmd.auto_mode, red_led: cmd.red_led, yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer });
  } catch (err) { res.json({ auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false }); }
});
app.post('/api/commands', async (req, res) => {
  try {
    await ensureDB();
    const { command, value, requestId } = req.body || {};
    const now = new Date();
    const update = { updatedAt: now };
    const cmdName = String(command || '').toUpperCase();
    if (cmdName === 'LED_MODE') {
      if (String(value || '').toUpperCase() === 'AUTO') update.auto_mode = true;
      else if (String(value || '').toUpperCase() === 'MANUAL') update.auto_mode = false;
      else if (value === true || value === false) update.auto_mode = !!value;
    } else if (cmdName === 'ALL_OFF' || cmdName === 'SILENCE_ALL') {
      update.red_led = false; update.yellow_led = false; update.green_led = false; update.buzzer = false;
    } else if (cmdName === 'BUZZER_ON') {
      update.buzzer = true;
    } else if (cmdName === 'BUZZER_OFF') {
      update.buzzer = false;
    } else if (cmdName === 'RESET_ALARM') {
      update.red_led = false; update.buzzer = false;
    } else if (/^RED.*(ON|OFF)$/.test(cmdName)) {
      update.red_led = cmdName.endsWith('ON');
    } else if (/^YELLOW.*(ON|OFF)$/.test(cmdName)) {
      update.yellow_led = cmdName.endsWith('ON');
    } else if (/^GREEN.*(ON|OFF)$/.test(cmdName)) {
      update.green_led = cmdName.endsWith('ON');
    } else if (cmdName === 'TEST_BUZZER') {
      update.buzzer = true;
    }
    await Command.findOneAndUpdate({ key: 'default' }, { $set: update }, { upsert: true, new: true }).lean();
    try {
      await new SystemEvent({ type: 'USER_ACTION', severity: 'INFO', message: `Command: ${command} ${value || ''}`, details: { command, value, requestId } }).save();
    } catch (e) { /* non-critical */ }
    res.json({ success: true, command, value, ts: now.getTime() });
  } catch (err) { res.status(200).json({ success: true, error: err.message }); }
});

// Status — connection status for MongoDB, Gemini, ESP32 (dashboard status panel)
app.get('/api/status', async (req, res) => {
  const batteryId = req.query.batteryId || 'BAT001';
  const result = { ts: Date.now(), mongodb: { configured: !!process.env.MONGODB_URI, connected: false, error: null }, gemini: { configured: !!process.env.GEMINI_API_KEY, active: !!process.env.GEMINI_API_KEY }, esp32: { connected: false, lastSeen: null, ageSeconds: null, hasData: false } };
  try {
    await ensureDB();
    result.mongodb.connected = true;
    const latest = await LiveData.findOne({ batteryId }).sort({ timestamp: -1 }).lean();
    if (latest && latest.timestamp) {
      result.esp32.hasData = true;
      result.esp32.lastSeen = latest.timestamp;
      result.esp32.ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / 1000));
      result.esp32.connected = result.esp32.ageSeconds < 30;
    }
  } catch (err) {
    result.mongodb.connected = false;
    result.mongodb.error = err.message;
  }
  res.json(result);
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
    const batteryId = req.query.batteryId || 'BAT001';
    const data = await LiveData.findOne({ batteryId }).sort({ timestamp: -1 }).lean();
    if (!data) return res.json({ message: 'No data yet' });
    const op = (data.opDirection || 'IDLE').toLowerCase();
    res.json({ gas: { index_mq2: data.gasIndex?.mq2, status_mq2: data.safety === 'SAFE' ? 'Normal' : 'Elevated', index_mq135: data.gasIndex?.mq135, warm: true }, environment: { temperature: data.temperature, humidity: data.humidity }, battery: { voltage: data.voltage, current: data.current, power: data.power, soc: data.soc, soh: data.soh, safety: data.safety, op, resistance: data.resistance, profile: data.profile, phase: data.phase, cycles: data.cycles, chemistry: data.chemistry, energyWh: data.energyWh }, risk: { bhi: data.bhi }, network: { rssi: data.network?.rssi, ip: data.network?.ip, heap: data.network?.heap, packetLoss: data.network?.packetLoss }, outputs: data.outputs || {}, firmware: data.firmware || data.mac || '--', uptime: data.uptime || '--', errors: 0, mac: data.mac || '--', dataLoss: data.network?.packetLoss ?? data.dataLoss ?? 0, cpu: data.cpu, temp: data.temp, ts: data.timestamp ? data.timestamp.getTime() : Date.now() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Telemetry POST — save a reading (dashboard saveToMongoDB)
app.post('/api/telemetry', async (req, res) => {
  try {
    await ensureDB();
    const body = req.body || {};
    const b = body.battery || body;
    const g = body.gas || {};
    const e = body.environment || {};
    const n = body.network || {};
    const batteryId = body.batteryId || 'BAT001';
    const now = new Date();
    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' };
    const safety = safetyMap[b.safety ? String(b.safety).toUpperCase() : (body.state || 'SAFE')] || 'SAFE';
    await LiveData.findOneAndUpdate({ batteryId }, {
      batteryId,
      voltage: b.voltage,
      current: b.current != null ? b.current / 1000 : null,
      power: b.power != null ? b.power / 1000 : b.power,
      soc: b.soc, soh: b.soh,
      temperature: e.temperature != null ? e.temperature : body.temperature,
      humidity: e.humidity != null ? e.humidity : body.humidity,
      gasIndex: { mq2: g.index_mq2 != null ? g.index_mq2 : body.mq2, mq135: g.index_mq135 != null ? g.index_mq135 : body.mq135 },
      safety,
      bhi: body.risk?.bhi != null ? body.risk.bhi : body.bhi,
      opDirection: b.op, resistance: b.resistance,
      outputs: body.outputs || { auto: body.auto_mode, red: body.red_led, yellow: body.yellow_led, green: body.green_led, buzzer: body.buzzer },
      network: n.rssi != null ? n : { rssi: body.wifi_rssi, heap: body.free_heap, ip: n.ip },
      timestamp: now
    }, { upsert: true, new: true });
    await new SensorHistory({ batteryId, voltage: b.voltage, current: b.current != null ? b.current / 1000 : null, power: b.power != null ? b.power / 1000 : b.power, soc: b.soc, soh: b.soh }).save();
    res.json({ success: true, ts: now.getTime() });
  } catch (err) { res.status(200).json({ success: true, ts: Date.now(), error: err.message }); }
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
  const fields = ['voltage', 'current', 'temperature', 'humidity', 'gasMq2', 'gasMq135', 'soc', 'safety', 'resistance', 'bhi', 'power', 'opDirection', 'batteryId'];
  for (const k of fields) {
    if (req.body[k] !== undefined) safe[k] = typeof req.body[k] === 'number' ? Math.max(-99999, Math.min(99999, req.body[k])) : String(req.body[k]).substring(0, 100);
  }
  try {
    const prompt = `Battery safety expert. Analyze and respond JSON only:\nV:${safe.voltage}V I:${safe.current}A T:${safe.temperature}C H:${safe.humidity}% MQ2:${safe.gasMq2} MQ135:${safe.gasMq135} SOC:${safe.soc}% Safety:${safe.safety} R:${safe.resistance}mOhm BHI:${safe.bhi} P:${safe.power}W\n{"health":"excellent|good|warning|critical|failure","bhi":0-100,"thermal_runaway_risk":bool,"anomaly_detected":bool,"remaining_cycles":num,"remaining_months":num,"danger_level":"safe|warning|danger","explanation":"one sentence","action":"recommendation"}`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } }) });
    if (!r.ok) throw new Error('AI unavailable');
    const result = await r.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty AI response');
    // Robustly extract the JSON object (resilient to code fences / surrounding text)
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in AI response');
    const prediction = JSON.parse(m[0]);

    // Persist prediction history (best-effort, non-fatal)
    try {
      await ensureDB();
      await Prediction.create({
        batteryId: safe.batteryId || 'BAT001',
        riskLevel: prediction.danger_level === 'danger' ? 'CRITICAL' : prediction.danger_level === 'warning' ? 'HIGH' : 'LOW',
        riskScore: prediction.bhi,
        analysis: prediction.explanation,
        recommendations: prediction.action ? [prediction.action] : [],
        modelVersion: 'gemini-3.6-flash'
      });
    } catch (e) { /* non-critical */ }

    res.json({ success: true, prediction });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// AI prediction history
app.get('/api/alerts/predictions', async (req, res) => {
  try {
    await ensureDB();
    const { batteryId, limit = 10 } = req.query;
    const q = {};
    if (batteryId) q.batteryId = batteryId;
    const preds = await Prediction.find(q).sort({ timestamp: -1 }).limit(parseInt(limit) || 10).lean();
    res.json(preds);
  } catch (err) { res.json([]); }
});

// Static files (local dev only)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Battery Vital Server v2.1 (Dev Mode)`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  DB:  MongoDB Atlas\n`);
});
