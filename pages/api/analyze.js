import { getDB } from '../../src/lib/mongodb'
import { analyzeBatteryData, predictFailure } from '../../src/lib/gemini'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { batteryId = 'BAT001', analysisType = 'current' } = req.body || {}
    const hasRawFields = ['voltage', 'current', 'temperature'].some((k) => req.body && req.body[k] !== undefined)

    const db = await getDB()
    let latest

    if (hasRawFields) {
      // Client submitted raw sensor fields directly
      const b = req.body
      latest = {
        batteryId: b.batteryId || batteryId,
        voltage: b.voltage,
        current: b.current,
        temperature: b.temperature,
        humidity: b.humidity,
        gasIndex: { mq2: b.gasMq2 ?? b.mq2, mq135: b.gasMq135 ?? b.mq135 },
        soc: b.soc,
        soh: b.soh,
        bhi: b.bhi,
        safety: b.safety || b.state || 'SAFE',
        resistance: b.resistance,
        power: b.power,
        opDirection: b.opDirection || b.direction || 'IDLE',
      }
    } else {
      latest = await db.collection('live_data').findOne({ batteryId })
    }

    if (!latest) {
      return res.status(404).json({ error: 'No data found' })
    }

    let analysis

    if (analysisType === 'predict') {
      const history = await db
        .collection('readings')
        .find({ batteryId })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray()
      analysis = await predictFailure(history)
    } else {
      analysis = await analyzeBatteryData(latest)
    }

    // Persist a lightweight prediction record for the history view (best-effort)
    try {
      await db.collection('predictions').insertOne({
        batteryId: latest.batteryId || batteryId,
        riskLevel: 'INFO',
        riskScore: latest.bhi ?? null,
        analysis: analysis.substring(0, 500),
        recommendations: [],
        modelVersion: 'gemini',
        timestamp: new Date(),
      })
    } catch (e) { /* non-critical */ }

    return res.status(200).json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
    })
  }
}
