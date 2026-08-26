const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Battery = require('../models/Battery');
const ChargingSession = require('../models/ChargingSession');
const Diagnostic = require('../models/Diagnostic');
const FirmwareLog = require('../models/FirmwareLog');

// GET /api/devices - List all devices
router.get('/devices', async (req, res) => {
  try {
    const devices = await Device.find().sort({ lastSeen: -1 }).lean();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/devices - Register new device
router.post('/devices', async (req, res) => {
  try {
    const device = new Device(req.body);
    await device.save();
    res.json({ success: true, id: device._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/devices/:id - Update device
router.put('/devices/:id', async (req, res) => {
  try {
    await Device.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/batteries - List all batteries
router.get('/batteries', async (req, res) => {
  try {
    const batteries = await Battery.find().sort({ installDate: -1 }).lean();
    res.json(batteries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/batteries - Register battery
router.post('/batteries', async (req, res) => {
  try {
    const battery = new Battery(req.body);
    await battery.save();
    res.json({ success: true, id: battery._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/charging-sessions
router.get('/charging-sessions', async (req, res) => {
  try {
    const { batteryId, limit = 20 } = req.query;
    const query = {};
    if (batteryId) query.batteryId = batteryId;
    const sessions = await ChargingSession.find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/charging-sessions
router.post('/charging-sessions', async (req, res) => {
  try {
    const session = new ChargingSession(req.body);
    await session.save();
    res.json({ success: true, id: session._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/charging-sessions/:id
router.put('/charging-sessions/:id', async (req, res) => {
  try {
    await ChargingSession.findByIdAndUpdate(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/diagnostics
router.get('/diagnostics', async (req, res) => {
  try {
    const { batteryId, limit = 20 } = req.query;
    const query = {};
    if (batteryId) query.batteryId = batteryId;
    const diagnostics = await Diagnostic.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();
    res.json(diagnostics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/diagnostics
router.post('/diagnostics', async (req, res) => {
  try {
    const diag = new Diagnostic(req.body);
    await diag.save();
    res.json({ success: true, id: diag._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/firmware-logs
router.get('/firmware-logs', async (req, res) => {
  try {
    const { deviceId, limit = 50 } = req.query;
    const query = {};
    if (deviceId) query.deviceId = deviceId;
    const logs = await FirmwareLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/firmware-logs
router.post('/firmware-logs', async (req, res) => {
  try {
    const log = new FirmwareLog(req.body);
    await log.save();
    res.json({ success: true, id: log._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
