const connectDB = require('./db');
const LiveData = require('../models/LiveData');

// GET /api/status - connection status for MongoDB, Gemini API, and ESP32 device
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const batteryId = req.query.batteryId || 'BAT001';

  const result = {
    ts: Date.now(),
    mongodb: { configured: !!process.env.MONGODB_URI, connected: false, error: null },
    gemini: { configured: !!process.env.GEMINI_API_KEY, active: !!process.env.GEMINI_API_KEY },
    esp32: { connected: false, lastSeen: null, ageSeconds: null, hasData: false }
  };

  // MongoDB connection + ESP32 last-seen
  try {
    await connectDB();
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

  res.status(200).json(result);
};
