// ===================================================================
// Battery Vitals Server v2.0 - Production Security
// ===================================================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== SECURITY MIDDLEWARE =====
const { setupSecurity } = require('./middleware/security');
const { apiLimiter, deviceLimiter, aiLimiter, writeLimiter } = require('./middleware/rateLimit');
const { authenticate, optionalAuth } = require('./middleware/auth');
const { validateTelemetry, validateCommand, validateBatteryQuery } = require('./middleware/validation');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { logSecurity } = require('./middleware/logger');

// Apply global security stack
setupSecurity(app);

// ===== MONGODB ATLAS CONNECTION =====
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not set in .env file');
  console.error('Copy .env.example to .env and add your MongoDB Atlas connection string');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 15000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10
})
  .then(() => {
    console.log('Connected to MongoDB Atlas - BatteryVitals database');
    console.log('Database:', mongoose.connection.db.databaseName);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// ===== IMPORT MODELS =====
const LiveData = require('./models/LiveData');
const SensorHistory = require('./models/SensorHistory');
const Alert = require('./models/Alert');
const Device = require('./models/Device');
const Prediction = require('./models/Prediction');
const SystemEvent = require('./models/SystemEvent');
const MLTrainingDataset = require('./models/MLTrainingDataset');

// ===== IMPORT ROUTES =====
const telemetryRoutes = require('./routes/telemetry');
const alertRoutes = require('./routes/alerts');
const deviceRoutes = require('./routes/devices');
const authRoutes = require('./routes/auth');

// ===== API ROUTES WITH SECURITY LAYERS =====
app.use('/api', apiLimiter);           // Global API rate limit

// Auth routes (strictest rate limit)
app.use('/api/auth', authRoutes);

// Telemetry routes (device ingestion has separate limiter)
app.use('/api', telemetryRoutes);

// Alert routes
app.use('/api', alertRoutes);

// Device routes (protected - requires auth)
app.use('/api/devices', authenticate, deviceRoutes);

// ===== LEGACY ENDPOINTS (backward compat with ESP32) =====
app.get('/api/telemetry', async (req, res) => {
  try {
    const data = await LiveData.findOne({ batteryId: 'BAT001' }).sort({ timestamp: -1 }).lean();
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
  } catch (err) {
    logSecurity('LEGACY_ENDPOINT_ERROR', { error: err.message });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/telemetry', deviceLimiter, validateTelemetry, async (req, res) => {
  try {
    const batteryId = req.body.batteryId || 'BAT001';
    const now = new Date();

    // Upsert live data (one document per battery)
    await LiveData.findOneAndUpdate(
      { batteryId },
      {
        batteryId,
        voltage: req.body.voltage,
        current: req.body.current,
        power: req.body.power,
        soc: req.body.soc,
        soh: req.body.soh,
        temperature: req.body.temperature,
        humidity: req.body.humidity,
        gasIndex: req.body.gasIndex || { mq2: req.body.gas?.index_mq2, mq135: req.body.gas?.index_mq135 },
        safety: req.body.safety,
        bhi: req.body.risk?.bhi,
        opDirection: req.body.op,
        resistance: req.body.resistance,
        outputs: req.body.outputs,
        network: req.body.network,
        timestamp: now
      },
      { upsert: true }
    );

    // Append to sensor_history for chart data
    const history = new SensorHistory({
      batteryId,
      voltage: req.body.voltage,
      current: req.body.current,
      power: req.body.power,
      soc: req.body.soc,
      soh: req.body.soh,
      resistance: req.body.resistance,
      opDirection: req.body.op
    });
    await history.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Data ingestion failed' });
  }
});

// Commands endpoint (write-limited)
app.post('/api/commands', writeLimiter, validateCommand, async (req, res) => {
  try {
    const event = new SystemEvent({
      type: 'USER_ACTION',
      severity: 'INFO',
      message: `Command: ${req.body.command} ${req.body.value || ''}`,
      details: { command: req.body.command, value: req.body.value }
    });
    await event.save();
    res.json({ success: true, message: 'Command logged' });
  } catch (err) {
    res.status(500).json({ error: 'Command failed' });
  }
});

// Dashboard stats (public read)
app.get('/api/stats', async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Stats unavailable' });
  }
});

// ML Training Data (write-protected)
app.get('/api/ml-training-data', async (req, res) => {
  try {
    const { limit = 1000, label } = req.query;
    const query = {};
    if (label && typeof label === 'string') query.label = label;
    const data = await MLTrainingDataset.find(query).limit(Math.min(parseInt(limit) || 1000, 5000)).lean();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Data unavailable' });
  }
});

app.post('/api/ml-training-data', writeLimiter, async (req, res) => {
  try {
    const data = new MLTrainingDataset(req.body);
    await data.save();
    res.json({ success: true, id: data._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save' });
  }
});

// ===== GEMINI AI ANALYSIS (rate-limited + validated) =====
app.post('/api/analyze', aiLimiter, async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(503).json({ success: false, error: 'AI service not configured' });
  }

  // Sanitize input - only allow known numeric/string fields
  const safe = {};
  const allowedFields = ['voltage', 'current', 'temperature', 'humidity', 'gasMq2', 'gasMq135', 'soc', 'safety', 'resistance', 'bhi', 'power', 'opDirection', 'batteryId'];
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      safe[key] = typeof req.body[key] === 'number'
        ? Math.max(-99999, Math.min(99999, req.body[key]))
        : String(req.body[key]).substring(0, 100);
    }
  }

  try {
    const prompt = `You are a battery safety expert AI. Analyze this battery data and respond in JSON only.

Battery Data:
- Voltage: ${safe.voltage}V
- Current: ${safe.current}A
- Temperature: ${safe.temperature}°C
- Humidity: ${safe.humidity}%
- Gas MQ2 Index: ${safe.gasMq2}
- Gas MQ135 VOC Index: ${safe.gasMq135}
- SOC: ${safe.soc}%
- Safety Status: ${safe.safety}
- Internal Resistance: ${safe.resistance} mOhm
- BHI Score: ${safe.bhi}
- Power: ${safe.power}W
- Direction: ${safe.opDirection}

Respond with EXACTLY this JSON format, nothing else:
{
  "health": "excellent or good or warning or critical or failure",
  "bhi": 0 to 100 number,
  "thermal_runaway_risk": true or false,
  "anomaly_detected": true or false,
  "remaining_cycles": number,
  "remaining_months": number,
  "danger_level": "safe or warning or danger",
  "explanation": "one sentence explaining the battery condition",
  "action": "recommended action to take"
}

Rules:
- temp > 55 = critical thermal risk
- voltage < 12 = critical
- Gas MQ2 > 2000 = thermal runaway true
- SOC < 20 and current > 3 = warning
- BHI > 75 = critical danger
- Be conservative, safety first
- JSON only, no other text`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
        })
      }
    );

    if (!response.ok) {
      throw new Error('AI service temporarily unavailable');
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty AI response');

    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const prediction = JSON.parse(cleanText);

    // Save prediction
    try {
      await Prediction.create({
        batteryId: safe.batteryId || 'BAT001',
        riskLevel: prediction.danger_level === 'danger' ? 'CRITICAL' : prediction.danger_level === 'warning' ? 'HIGH' : 'LOW',
        riskScore: prediction.bhi,
        analysis: prediction.explanation,
        recommendations: prediction.action ? [prediction.action] : [],
        modelVersion: 'gemini-2.0-flash'
      });
    } catch (e) { /* non-critical */ }

    res.json({ success: true, prediction });
  } catch (error) {
    logSecurity('AI_ANALYSIS_ERROR', { error: error.message });
    res.status(500).json({ success: false, error: 'AI analysis failed' });
  }
});

// ===== SERVE FRONTEND =====
app.use(express.static(path.join(__dirname), {
  setHeaders: (res, filePath) => {
    // No caching for HTML
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== ERROR HANDLING =====
app.use(notFound);
app.use(errorHandler);

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  Battery Vital Server v2.0 (Secure)');
  console.log('========================================');
  console.log(`  URL:     http://localhost:${PORT}`);
  console.log(`  DB:      BatteryVitals (MongoDB Atlas)`);
  console.log(`  Security: Helmet, Rate-Limit, Auth`);
  console.log('========================================');
  console.log('');
});
