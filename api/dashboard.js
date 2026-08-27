const connectDB = require('./db');
const LiveData = require('../models/LiveData');
const SensorHistory = require('../models/SensorHistory');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const Prediction = require('../models/Prediction');
const Command = require('../models/Command');
const MLTrainingDataset = require('../models/MLTrainingDataset');
const SystemEvent = require('../models/SystemEvent');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, 'https://x');
  const path = url.pathname;

  try {
    await connectDB();

    // GET /api/telemetry
    if (path === '/api/telemetry' && req.method === 'GET') {
      const data = await LiveData.findOne({ batteryId: 'BAT001' }).sort({ timestamp: -1 }).lean();
      if (!data) return res.status(200).json({ message: 'No data yet' });
      return res.status(200).json({
        gas: { index_mq2: data.gasIndex?.mq2, status_mq2: '--', index_mq135: data.gasIndex?.mq135, warm: true },
        environment: { temperature: data.temperature, humidity: data.humidity },
        battery: { voltage: data.voltage, current: data.current, power: data.power, soc: data.soc, safety: data.safety, op: data.opDirection, resistance: data.resistance },
        risk: { bhi: data.bhi },
        network: data.network, outputs: data.outputs,
        firmware: '--', uptime: '--', errors: 0
      });
    }

    // GET /api/sensor-history
    if (path === '/api/sensor-history' && req.method === 'GET') {
      const { batteryId = 'BAT001', minutes = 60, limit = 500 } = url.searchParams;
      const since = new Date(Date.now() - parseInt(minutes) * 60 * 1000);
      const data = await SensorHistory.find({ batteryId, timestamp: { $gte: since } }).sort({ timestamp: 1 }).limit(parseInt(limit)).lean();
      return res.status(200).json(data.map(d => ({ time: d.timestamp, voltage: d.voltage, current: d.current, power: d.power, soc: d.soc, soh: d.soh })));
    }

    // GET /api/stats
    if (path === '/api/stats' && req.method === 'GET') {
      const [totalReadings, totalAlerts, liveData, deviceCount] = await Promise.all([
        SensorHistory.countDocuments(), Alert.countDocuments(),
        LiveData.findOne({ batteryId: 'BAT001' }).lean(), Device.countDocuments()
      ]);
      return res.status(200).json({ totalReadings, totalAlerts, deviceCount, lastReading: liveData?.timestamp, currentSoc: liveData?.soc, currentSafety: liveData?.safety, currentBhi: liveData?.bhi });
    }

    // GET /api/alerts
    if (path === '/api/alerts' && req.method === 'GET') {
      const { batteryId, severity, limit = 100 } = url.searchParams;
      const query = {};
      if (batteryId) query.batteryId = batteryId;
      if (severity && severity !== 'all') query.severity = severity.toUpperCase();
      const alerts = await Alert.find(query).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
      return res.status(200).json(alerts.map(a => ({
        id: a._id, time: a.timestamp, severity: a.severity, type: a.type,
        bhi: a.bhi, message: a.message, acknowledged: a.acknowledged
      })));
    }

    // POST /api/alerts
    if (path === '/api/alerts' && req.method === 'POST') {
      const alert = new Alert({
        batteryId: req.body.batteryId || 'BAT001', severity: req.body.severity,
        type: req.body.type, message: req.body.message, bhi: req.body.bhi, sensorData: req.body.sensorData
      });
      await alert.save();
      return res.status(200).json({ success: true, id: alert._id });
    }

    // PUT /api/alerts/:id/acknowledge
    if (path.match(/^\/api\/alerts\/[^/]+\/acknowledge$/) && req.method === 'PUT') {
      const id = path.split('/')[3];
      await Alert.findByIdAndUpdate(id, { acknowledged: true, acknowledgedAt: new Date() });
      return res.status(200).json({ success: true });
    }

    // GET /api/predictions
    if (path === '/api/predictions' && req.method === 'GET') {
      const { batteryId, limit = 10 } = url.searchParams;
      const query = {};
      if (batteryId) query.batteryId = batteryId;
      const preds = await Prediction.find(query).sort({ timestamp: -1 }).limit(parseInt(limit)).lean();
      return res.status(200).json(preds);
    }

    // GET /api/ml-training-data
    if (path === '/api/ml-training-data' && req.method === 'GET') {
      const { limit = 1000, label } = url.searchParams;
      const query = {};
      if (label && typeof label === 'string') query.label = label;
      const data = await MLTrainingDataset.find(query).limit(Math.min(parseInt(limit) || 1000, 5000)).lean();
      return res.status(200).json(data);
    }

    // POST /api/ml-training-data
    if (path === '/api/ml-training-data' && req.method === 'POST') {
      const data = new MLTrainingDataset(req.body);
      await data.save();
      return res.status(200).json({ success: true, id: data._id });
    }

    // POST /api/commands
    if (path === '/api/commands' && req.method === 'POST') {
      await new SystemEvent({
        type: 'USER_ACTION', severity: 'INFO',
        message: `Command: ${req.body.command} ${req.body.value || ''}`,
        details: { command: req.body.command, value: req.body.value }
      }).save();
      return res.status(200).json({ success: true });
    }

    // GET /api/devices
    if (path === '/api/devices' && req.method === 'GET') {
      const devices = await Device.find().sort({ lastSeen: -1 }).lean();
      return res.status(200).json(devices);
    }

    // GET /api/health
    if (path === '/api/health') {
      return res.status(200).json({ status: 'ok', uptime: process.uptime(), ts: Date.now() });
    }

    res.status(404).json({ error: 'Not found', path });
  } catch (err) {
    console.error('[dashboard]', err.message);
    res.status(500).json({ error: err.message });
  }
};
