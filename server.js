const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ===== MONGODB ATLAS CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not set in .env file');
  console.error('Copy .env.example to .env and add your MongoDB Atlas connection string');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas - BatteryVitals database');
    console.log('Database:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// ===== IMPORT ROUTES =====
const telemetryRoutes = require('./routes/telemetry');
const alertRoutes = require('./routes/alerts');
const deviceRoutes = require('./routes/devices');

// ===== API ROUTES =====
app.use('/api', telemetryRoutes);
app.use('/api', alertRoutes);
app.use('/api', deviceRoutes);

// Legacy endpoints - redirect to new structure
app.get('/api/telemetry', (req, res) => {
  // Keep old endpoint working for backward compatibility
  const LiveData = require('./models/LiveData');
  LiveData.findOne({ batteryId: 'BAT001' }).sort({ timestamp: -1 }).lean()
    .then(data => {
      if (!data) return res.json({ message: 'No data yet' });
      res.json({
        gas: { index_mq2: data.gasIndex?.mq2, status_mq2: '--', index_mq135: data.gasIndex?.mq135, warm: true },
        environment: { temperature: data.temperature, humidity: data.humidity },
        battery: { voltage: data.voltage, current: data.current, power: data.power, soc: data.soc, safety: data.safety, op: data.opDirection, resistance: data.resistance },
        risk: { bhi: data.bhi },
        network: data.network,
        outputs: data.outputs,
        firmware: '--',
        uptime: '--',
        errors: 0
      });
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

app.post('/api/telemetry', (req, res) => {
  // Redirect to live-data endpoint
  req.url = '/live-data';
  app.handle(req, res);
});

app.post('/api/commands', async (req, res) => {
  const SystemEvent = require('./models/SystemEvent');
  try {
    const event = new SystemEvent({
      type: 'USER_ACTION',
      severity: 'INFO',
      message: `Command: ${req.body.command} ${req.body.value || ''}`,
      details: req.body
    });
    await event.save();
    res.json({ success: true, message: 'Command logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const SensorHistory = require('./models/SensorHistory');
    const Alert = require('./models/Alert');
    const LiveData = require('./models/LiveData');
    const Device = require('./models/Device');

    const [totalReadings, totalAlerts, liveData, deviceCount] = await Promise.all([
      SensorHistory.countDocuments(),
      Alert.countDocuments(),
      LiveData.findOne({ batteryId: 'BAT001' }).lean(),
      Device.countDocuments()
    ]);

    res.json({
      totalReadings,
      totalAlerts,
      deviceCount,
      lastReading: liveData?.timestamp,
      currentSoc: liveData?.soc,
      currentSafety: liveData?.safety,
      currentBhi: liveData?.bhi
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ML Training Data endpoint
app.get('/api/ml-training-data', async (req, res) => {
  try {
    const MLTrainingDataset = require('./models/MLTrainingDataset');
    const { limit = 1000, label } = req.query;
    const query = {};
    if (label) query.label = label;
    const data = await MLTrainingDataset.find(query).limit(parseInt(limit)).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ml-training-data', async (req, res) => {
  try {
    const MLTrainingDataset = require('./models/MLTrainingDataset');
    const data = new MLTrainingDataset(req.body);
    await data.save();
    res.json({ success: true, id: data._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  Battery Vital Server v1.1');
  console.log('========================================');
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log(`  DB:   BatteryVitals (MongoDB Atlas)`);
  console.log('========================================');
  console.log('');
});
