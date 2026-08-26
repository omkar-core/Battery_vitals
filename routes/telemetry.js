const express = require('express');
const router = express.Router();
const LiveData = require('../models/LiveData');
const SensorHistory = require('../models/SensorHistory');
const ThermalHistory = require('../models/ThermalHistory');
const GasHistory = require('../models/GasHistory');
const BatteryHealth = require('../models/BatteryHealth');

// POST /api/live-data - ESP32 sends real-time data
router.post('/live-data', async (req, res) => {
  try {
    const d = req.body;
    const batteryId = d.batteryId || 'BAT001';

    // Save to live_data (upsert - one doc per battery)
    await LiveData.findOneAndUpdate(
      { batteryId },
      {
        batteryId,
        deviceId: d.deviceId,
        voltage: d.battery?.voltage,
        current: d.battery?.current,
        power: d.battery?.power,
        soc: d.battery?.soc,
        soh: d.battery?.soh,
        temperature: d.environment?.temperature,
        humidity: d.environment?.humidity,
        gasIndex: { mq2: d.gas?.index_mq2, mq135: d.gas?.index_mq135 },
        safety: d.battery?.safety,
        bhi: d.risk?.bhi,
        opDirection: d.battery?.op,
        resistance: d.battery?.resistance,
        outputs: d.outputs,
        network: d.network,
        timestamp: new Date()
      },
      { upsert: true }
    );

    // Save to sensor_history
    const history = new SensorHistory({
      batteryId,
      voltage: d.battery?.voltage,
      current: d.battery?.current,
      power: d.battery?.power,
      soc: d.battery?.soc,
      soh: d.battery?.soh,
      resistance: d.battery?.resistance,
      opDirection: d.battery?.op
    });
    await history.save();

    // Save to thermal_history
    if (d.environment?.temperature != null) {
      const thermal = new ThermalHistory({
        batteryId,
        temperature: d.environment.temperature,
        humidity: d.environment.humidity,
        thermalRunawayRisk: d.environment.temperature > 50 ? 'HIGH' : d.environment.temperature > 40 ? 'MEDIUM' : 'LOW'
      });
      await thermal.save();
    }

    // Save to gas_history
    if (d.gas?.index_mq2 != null) {
      const gas = new GasHistory({
        batteryId,
        mq2Index: d.gas.index_mq2,
        mq2Status: d.gas.status_mq2,
        mq135Index: d.gas.index_mq135,
        warm: d.gas.warm,
        gasDetected: d.gas.index_mq2 > 1000,
        riskLevel: d.gas.index_mq2 > 2000 ? 'HIGH' : d.gas.index_mq2 > 1000 ? 'MEDIUM' : 'LOW'
      });
      await gas.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving live data:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/live-data - Get latest data for dashboard
router.get('/live-data', async (req, res) => {
  try {
    const { batteryId = 'BAT001' } = req.query;
    const data = await LiveData.findOne({ batteryId }).sort({ timestamp: -1 }).lean();
    if (!data) return res.json({ message: 'No data yet' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sensor-history - Get historical data for charts
router.get('/sensor-history', async (req, res) => {
  try {
    const { batteryId = 'BAT001', minutes = 60, limit = 500 } = req.query;
    const since = new Date(Date.now() - parseInt(minutes) * 60 * 1000);

    const data = await SensorHistory.find({ batteryId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .lean();

    res.json(data.map(d => ({
      time: d.timestamp,
      voltage: d.voltage,
      current: d.current,
      power: d.power,
      soc: d.soc,
      soh: d.soh,
      resistance: d.resistance,
      op: d.opDirection
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/thermal-history
router.get('/thermal-history', async (req, res) => {
  try {
    const { batteryId = 'BAT001', minutes = 60 } = req.query;
    const since = new Date(Date.now() - parseInt(minutes) * 60 * 1000);
    const data = await ThermalHistory.find({ batteryId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 }).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gas-history
router.get('/gas-history', async (req, res) => {
  try {
    const { batteryId = 'BAT001', minutes = 60 } = req.query;
    const since = new Date(Date.now() - parseInt(minutes) * 60 * 1000);
    const data = await GasHistory.find({ batteryId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 }).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/battery-health
router.get('/battery-health', async (req, res) => {
  try {
    const { batteryId = 'BAT001', period = 'hourly', limit = 24 } = req.query;
    const data = await BatteryHealth.find({ batteryId, period })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
