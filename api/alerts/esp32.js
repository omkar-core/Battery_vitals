const connectDB = require('../db');
const Alert = require('../../models/Alert');

// POST/GET /api/alerts/esp32 - ESP32 alerts endpoint
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    try {
      await connectDB();
    } catch (dbErr) {
      console.error('[alerts/esp32] DB connect failed:', dbErr.message);
      return res.status(200).json({ success: true, db: 'offline' });
    }

    if (req.method === 'POST') {
      await new Alert({
        batteryId: req.body.batteryId || 'BAT001',
        severity: (req.body.severity || 'INFO').toUpperCase(),
        type: req.body.type || req.body.message || 'ESP32_ALERT',
        message: req.body.message || 'Alert from device',
        bhi: req.body.bhi,
        sensorData: { voltage: req.body.voltage, temperature: req.body.temperature }
      }).save();
      return res.status(200).json({ success: true });
    }

    if (req.method === 'GET') {
      const { batteryId, severity, limit = 100 } = req.query;
      const query = {};
      if (batteryId) query.batteryId = batteryId;
      if (severity && severity !== 'all') query.severity = severity.toUpperCase();
      const alerts = await Alert.find(query).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
      return res.status(200).json(alerts.map(a => ({
        id: a._id, time: a.timestamp, severity: a.severity, type: a.type,
        bhi: a.bhi, message: a.message, acknowledged: a.acknowledged
      })));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[alerts/esp32] error:', err.message);
    res.status(200).json({ success: true, error: err.message });
  }
};
