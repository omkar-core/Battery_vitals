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

// ===== GEMINI AI ANALYSIS =====
app.post('/api/analyze', async (req, res) => {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not set in .env' });
  }

  try {
    const data = req.body;

    const prompt = `You are a battery safety expert AI. Analyze this battery data and respond in JSON only.

Battery Data:
- Voltage: ${data.voltage}V
- Current: ${data.current}A
- Temperature: ${data.temperature}\u00B0C
- Humidity: ${data.humidity}%
- Gas MQ2 Index: ${data.gasMq2}
- Gas MQ135 VOC Index: ${data.gasMq135}
- SOC: ${data.soc}%
- Safety Status: ${data.safety}
- Internal Resistance: ${data.resistance} mOhm
- BHI Score: ${data.bhi}
- Power: ${data.power}W
- Direction: ${data.opDirection}

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
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'Gemini API error');
    }

    const result = await response.json();
    const text = result.candidates[0].content.parts[0].text;
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const prediction = JSON.parse(cleanText);

    // Save prediction to MongoDB
    try {
      const Prediction = require('./models/Prediction');
      await Prediction.create({
        batteryId: data.batteryId || 'BAT001',
        riskLevel: prediction.danger_level === 'danger' ? 'CRITICAL' : prediction.danger_level === 'warning' ? 'HIGH' : 'LOW',
        riskScore: prediction.bhi,
        analysis: prediction.explanation,
        recommendations: prediction.action ? [prediction.action] : [],
        modelVersion: 'gemini-2.0-flash'
      });
    } catch (e) { /* non-critical */ }

    res.json({ success: true, prediction });

  } catch (error) {
    console.error('Gemini AI error:', error.message);
    res.status(500).json({ success: false, error: error.message });
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
