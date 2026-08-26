const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not set in .env file');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ===== SCHEMAS =====

// Telemetry Schema - stores every reading from ESP32
const telemetrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  
  // Gas sensors
  gas: {
    mq2_index: Number,
    mq2_status: String,
    mq135_index: Number,
    warm: Boolean
  },
  
  // Environment
  environment: {
    temperature: Number,
    humidity: Number
  },
  
  // Battery
  battery: {
    voltage: Number,
    current: Number,
    power: Number,
    soc: Number,
    safety: String,
    op: String,
    resistance: Number
  },
  
  // Risk
  risk: {
    bhi: Number
  },
  
  // Network
  network: {
    rssi: Number,
    ip: String,
    heap: Number,
    mac: String
  },
  
  // Outputs state
  outputs: {
    green: Boolean,
    yellow: Boolean,
    red: Boolean,
    buzzer: Boolean,
    auto: Boolean
  },
  
  // Device info
  firmware: String,
  uptime: String,
  errors: Number,
  
  // Raw data for debugging
  raw: mongoose.Schema.Types.Mixed
});

const Telemetry = mongoose.model('Telemetry', telemetrySchema);

// Alert Schema - stores safety events
const alertSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now, index: true },
  severity: { type: String, enum: ['SAFE', 'CAUTION', 'WARNING', 'CRITICAL', 'EMERGENCY'], index: true },
  bhi: Number,
  message: String,
  gas: Number,
  temp: Number,
  volt: Number,
  auto: Boolean
});

const Alert = mongoose.model('Alert', alertSchema);

// ===== API ROUTES =====

// POST /api/telemetry - ESP32 sends data here
app.post('/api/telemetry', async (req, res) => {
  try {
    const data = req.body;
    
    // Process and store telemetry
    const telemetry = new Telemetry({
      gas: {
        mq2_index: data.gas?.index_mq2,
        mq2_status: data.gas?.status_mq2,
        mq135_index: data.gas?.index_mq135,
        warm: data.gas?.warm
      },
      environment: {
        temperature: data.environment?.temperature,
        humidity: data.environment?.humidity
      },
      battery: {
        voltage: data.battery?.voltage,
        current: data.battery?.current,
        power: data.battery?.power,
        soc: data.battery?.soc,
        safety: data.battery?.safety,
        op: data.battery?.op,
        resistance: data.battery?.resistance
      },
      risk: {
        bhi: data.risk?.bhi
      },
      network: {
        rssi: data.network?.rssi,
        ip: data.network?.ip,
        heap: data.network?.heap,
        mac: data.mac
      },
      outputs: data.outputs,
      firmware: data.firmware,
      uptime: data.uptime,
      errors: data.errors,
      raw: data
    });
    
    await telemetry.save();
    
    // Check for safety changes and create alerts
    const lastTelemetry = await Telemetry.findOne({ _id: { $ne: telemetry._id } })
      .sort({ timestamp: -1 })
      .lean();
    
    if (lastTelemetry && lastTelemetry.battery?.safety !== data.battery?.safety) {
      const alert = new Alert({
        severity: data.battery?.safety || 'SAFE',
        bhi: data.risk?.bhi,
        message: `Safety changed: ${lastTelemetry.battery?.safety} -> ${data.battery?.safety}`,
        gas: data.gas?.index_mq2,
        temp: data.environment?.temperature,
        volt: data.battery?.voltage,
        auto: data.outputs?.auto
      });
      await alert.save();
    }
    
    res.json({ success: true, id: telemetry._id });
  } catch (err) {
    console.error('Error saving telemetry:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/telemetry - Get latest telemetry for dashboard
app.get('/api/telemetry', async (req, res) => {
  try {
    const latest = await Telemetry.findOne().sort({ timestamp: -1 }).lean();
    if (!latest) {
      return res.json({ message: 'No data yet' });
    }
    
    // Convert back to ESP32 format
    res.json({
      gas: {
        index_mq2: latest.gas?.mq2_index,
        status_mq2: latest.gas?.mq2_status,
        index_mq135: latest.gas?.mq135_index,
        warm: latest.gas?.warm
      },
      environment: latest.environment,
      battery: latest.battery,
      risk: latest.risk,
      network: latest.network,
      outputs: latest.outputs,
      firmware: latest.firmware,
      uptime: latest.uptime,
      errors: latest.errors
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/history - Get historical data for charts
app.get('/api/history', async (req, res) => {
  try {
    const { minutes = 60, limit = 500 } = req.query;
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    const data = await Telemetry.find({ timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json(data.map(d => ({
      time: d.timestamp,
      bhi: d.risk?.bhi ?? 0,
      gas: d.gas?.mq2_index ?? 0,
      voc: d.gas?.mq135_index ?? 0,
      temp: d.environment?.temperature ?? 0,
      humid: d.environment?.humidity ?? 0,
      volt: d.battery?.voltage ?? 0,
      curr: d.battery?.current ?? 0,
      power: d.battery?.power ?? 0,
      soc: d.battery?.soc ?? 0,
      safety: d.battery?.safety
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts - Get alert log
app.get('/api/alerts', async (req, res) => {
  try {
    const { severity, limit = 100 } = req.query;
    const query = severity && severity !== 'all' ? { severity: severity.toUpperCase() } : {};
    
    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json(alerts.map(a => ({
      id: a._id,
      time: a.timestamp.toLocaleTimeString(),
      severity: a.severity,
      bhi: a.bhi,
      message: a.message,
      gas: a.gas,
      temp: a.temp,
      volt: a.volt
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts - Store alert from frontend
app.post('/api/alerts', async (req, res) => {
  try {
    const alert = new Alert(req.body);
    await alert.save();
    res.json({ success: true, id: alert._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/commands - Forward commands to ESP32 (store in DB)
app.post('/api/commands', async (req, res) => {
  try {
    // Store command in a separate collection for history
    const commandSchema = new mongoose.Schema({
      timestamp: { type: Date, default: Date.now },
      command: String,
      value: String,
      requestId: String,
      status: { type: String, default: 'pending' }
    });
    
    const Command = mongoose.model('Command', commandSchema);
    const cmd = new Command(req.body);
    await cmd.save();
    
    res.json({ success: true, id: cmd._id, message: 'Command stored' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats - Dashboard statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalReadings = await Telemetry.countDocuments();
    const totalAlerts = await Alert.countDocuments();
    const latest = await Telemetry.findOne().sort({ timestamp: -1 }).lean();
    const firstReading = await Telemetry.findOne().sort({ timestamp: 1 }).lean();
    
    res.json({
      totalReadings,
      totalAlerts,
      firstReading: firstReading?.timestamp,
      lastReading: latest?.timestamp,
      uptime: latest?.uptime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Battery Vital server running on http://localhost:${PORT}`);
  console.log(`MongoDB URI: ${MONGODB_URI.substring(0, 30)}...`);
});
