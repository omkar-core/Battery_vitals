import { getDB } from '../../../src/lib/mongodb'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const db = await getDB()

    if (req.method === 'POST') {
      const body = req.body || {}
      await db.collection('alerts').insertOne({
        batteryId: body.batteryId || 'BAT001',
        severity: (body.severity || 'INFO').toUpperCase(),
        type: body.type || body.message || 'ESP32_ALERT',
        message: body.message || 'Alert from device',
        bhi: body.bhi,
        sensorData: { voltage: body.voltage, temperature: body.temperature },
        acknowledged: false,
        timestamp: new Date(),
      })
      return res.status(200).json({ success: true })
    }

    if (req.method === 'GET') {
      const { batteryId, severity, limit = 100 } = req.query
      const query = {}
      if (batteryId) query.batteryId = batteryId
      if (severity && severity !== 'all') query.severity = severity.toUpperCase()
      const alerts = await db
        .collection('alerts')
        .find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .toArray()
      return res.status(200).json(alerts.map((a) => ({
        id: String(a._id),
        time: a.timestamp,
        severity: a.severity,
        type: a.type,
        bhi: a.bhi,
        message: a.message,
        acknowledged: a.acknowledged,
      })))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('alerts/esp32 error:', err.message)
    return res.status(200).json({ success: true, error: err.message })
  }
}
