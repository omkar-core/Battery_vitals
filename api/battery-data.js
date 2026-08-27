const connectDB = require('./db');
const LiveData = require('../models/LiveData');
const SensorHistory = require('../models/SensorHistory');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    await connectDB();
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

    res.status(200).json({ success: true, ts: now.getTime() });
  } catch (err) {
    console.error('[battery-data]', err.message);
    res.status(500).json({ error: err.message });
  }
};
