const connectDB = require('./db');
const Prediction = require('../models/Prediction');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(503).json({ success: false, error: 'AI not configured' });

  const safe = {};
  const fields = ['voltage', 'current', 'temperature', 'humidity', 'gasMq2', 'gasMq135', 'soc', 'safety', 'resistance', 'bhi', 'power', 'opDirection', 'batteryId'];
  for (const k of fields) {
    if (req.body[k] !== undefined) {
      safe[k] = typeof req.body[k] === 'number' ? Math.max(-99999, Math.min(99999, req.body[k])) : String(req.body[k]).substring(0, 100);
    }
  }

  try {
    const prompt = `Battery safety expert. Analyze and respond JSON only:\nV:${safe.voltage}V I:${safe.current}A T:${safe.temperature}C H:${safe.humidity}% MQ2:${safe.gasMq2} MQ135:${safe.gasMq135} SOC:${safe.soc}% Safety:${safe.safety} R:${safe.resistance}mOhm BHI:${safe.bhi} P:${safe.power}W\n{"health":"excellent|good|warning|critical|failure","bhi":0-100,"thermal_runaway_risk":bool,"anomaly_detected":bool,"remaining_cycles":num,"remaining_months":num,"danger_level":"safe|warning|danger","explanation":"one sentence","action":"recommendation"}`;
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } })
    });
    if (!resp.ok) throw new Error('AI unavailable');
    const result = await resp.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty AI response');
    // Robustly extract the JSON object (resilient to code fences / surrounding text)
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in AI response');
    const prediction = JSON.parse(m[0]);
    try {
      await connectDB();
      await Prediction.create({
        batteryId: safe.batteryId || 'BAT001',
        riskLevel: prediction.danger_level === 'danger' ? 'CRITICAL' : prediction.danger_level === 'warning' ? 'HIGH' : 'LOW',
        riskScore: prediction.bhi, analysis: prediction.explanation,
        recommendations: prediction.action ? [prediction.action] : [], modelVersion: 'gemini-3.6-flash'
      });
    } catch (e) { /* non-critical */ }
    res.status(200).json({ success: true, prediction });
  } catch (error) {
    console.error('[analyze]', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
