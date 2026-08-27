const connectDB = require('./db');
const Prediction = require('../../models/Prediction');

// GET /api/alerts/predictions - AI prediction history for the dashboard
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    try {
      await connectDB();
    } catch (dbErr) {
      console.error('[alerts/predictions] DB connect failed:', dbErr.message);
      return res.status(200).json([]);
    }

    const { batteryId, limit = 10 } = req.query;
    const query = {};
    if (batteryId) query.batteryId = batteryId;

    const preds = await Prediction
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) || 10)
      .lean();

    res.status(200).json(preds);
  } catch (err) {
    console.error('[alerts/predictions]', err.message);
    res.status(200).json([]);
  }
};
