const connectDB = require('./db');
const LiveData = require('../models/LiveData');
const SensorHistory = require('../models/SensorHistory');

// GET /api/telemetry -> latest live reading for the dashboard
// POST /api/telemetry -> save a reading (used by dashboard saveToMongoDB)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST: save telemetry (accepts either the ESP32 shape or nested dashboard shape)
  if (req.method === 'POST') {
    try {
      try { await connectDB(); } catch (dbErr) {
        return res.status(200).json({ success: true, db: 'offline' });
      }

      const body = req.body || {};
      // Flatten nested shape used by the browser saveToMongoDB
      const b = body.battery || body;
      const g = body.gas || {};
      const e = body.environment || {};
      const n = body.network || {};

      const batteryId = body.batteryId || 'BAT001';
      const now = new Date();
      const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' };
      const safety = safetyMap[b.safety ? (b.safety + '').toUpperCase() : (body.state || 'SAFE')] || 'SAFE';

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
        opDirection: b.op,
        resistance: b.resistance,
        outputs: body.outputs || { auto: body.auto_mode, red: body.red_led, yellow: body.yellow_led, green: body.green_led, buzzer: body.buzzer },
        network: n.rssi != null ? n : { rssi: body.wifi_rssi, heap: body.free_heap, ip: n.ip },
        timestamp: now
      }, { upsert: true, new: true });

      await new SensorHistory({
        batteryId, voltage: b.voltage,
        current: b.current != null ? b.current / 1000 : null,
        power: b.power != null ? b.power / 1000 : b.power,
        soc: b.soc, soh: b.soh
      }).save();

      return res.status(200).json({ success: true, ts: now.getTime() });
    } catch (err) {
      console.error('[telemetry POST]', err.message);
      return res.status(200).json({ success: true, ts: Date.now(), error: err.message });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET: return latest reading in the shape the dashboard expects
  try {
    try {
      await connectDB();
    } catch (dbErr) {
      console.error('[telemetry] DB connect failed:', dbErr.message);
      return res.status(200).json({ message: 'Database offline', db: 'disconnected' });
    }

    const batteryId = req.query.batteryId || 'BAT001';
    const data = await LiveData.findOne({ batteryId }).sort({ timestamp: -1 }).lean();
    if (!data) return res.status(200).json({ message: 'No data yet' });

    const op = (data.opDirection || 'IDLE').toLowerCase();
    res.status(200).json({
      gas: {
        index_mq2: data.gasIndex?.mq2,
        status_mq2: data.safety === 'SAFE' ? 'Normal' : 'Elevated',
        index_mq135: data.gasIndex?.mq135,
        warm: true
      },
      environment: { temperature: data.temperature, humidity: data.humidity },
      battery: {
        voltage: data.voltage,
        current: data.current,
        power: data.power,
        soc: data.soc,
        soh: data.soh,
        safety: data.safety,
        op,
        resistance: data.resistance
      },
      risk: { bhi: data.bhi },
      network: { rssi: data.network?.rssi, ip: data.network?.ip, heap: data.network?.heap },
      outputs: data.outputs || {},
      firmware: data.firmware || '--',
      uptime: data.uptime || '--',
      errors: 0,
      mac: data.mac || '--',
      ts: data.timestamp ? data.timestamp.getTime() : Date.now()
    });
  } catch (err) {
    console.error('[telemetry GET]', err.message);
    res.status(500).json({ error: err.message });
  }
};
