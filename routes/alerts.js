const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const Prediction = require('../models/Prediction');

// GET /api/alerts - Get alerts
router.get('/', async (req, res) => {
  try {
    const { batteryId, severity, limit = 100 } = req.query;
    const query = {};
    if (batteryId) query.batteryId = batteryId;
    if (severity && severity !== 'all') query.severity = severity.toUpperCase();

    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(alerts.map(a => ({
      id: a._id,
      time: a.timestamp,
      severity: a.severity,
      type: a.type,
      bhi: a.bhi,
      message: a.message,
      gas: a.sensorData?.gasIndex,
      temp: a.sensorData?.temperature,
      volt: a.sensorData?.voltage,
      soc: a.sensorData?.soc,
      acknowledged: a.acknowledged
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts - Create alert
router.post('/', async (req, res) => {
  try {
    const alert = new Alert({
      batteryId: req.body.batteryId || 'BAT001',
      severity: req.body.severity,
      type: req.body.type,
      message: req.body.message,
      bhi: req.body.bhi,
      sensorData: req.body.sensorData
    });
    await alert.save();
    res.json({ success: true, id: alert._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/acknowledge
router.put('/:id/acknowledge', async (req, res) => {
  try {
    await Alert.findByIdAndUpdate(req.params.id, {
      acknowledged: true,
      acknowledgedBy: req.body.userId,
      acknowledgedAt: new Date()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/predictions - Get ML predictions
router.get('/predictions', async (req, res) => {
  try {
    const { batteryId, limit = 10 } = req.query;
    const query = {};
    if (batteryId) query.batteryId = batteryId;

    const preds = await Prediction.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(preds.map(p => ({
      timestamp: p.timestamp,
      riskLevel: p.riskLevel,
      riskScore: p.riskScore,
      predictedSoh: p.predictedSoh,
      analysis: p.analysis,
      recommendations: p.recommendations,
      modelVersion: p.modelVersion
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
