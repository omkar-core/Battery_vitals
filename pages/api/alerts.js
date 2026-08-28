import { getDB } from '../../src/lib/mongodb'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    return handleGet(req, res)
  }

  if (req.method === 'POST') {
    return handlePost(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req, res) {
  try {
    const db = await getDB()
    const { batteryId, severity, limit = 100 } = req.query
    const q = {}
    if (batteryId) q.batteryId = batteryId
    if (severity && severity !== 'all') q.severity = severity.toUpperCase()

    const alerts = await db
      .collection('alerts')
      .find(q)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray()

    res.json(alerts.map((a) => ({
      id: String(a._id),
      time: a.timestamp,
      severity: a.severity,
      type: a.type,
      bhi: a.bhi,
      message: a.message,
      acknowledged: a.acknowledged,
    })))
  } catch (error) {
    console.error('alerts get error:', error)
    res.status(500).json({ error: error.message })
  }
}

async function handlePost(req, res) {
  try {
    const db = await getDB()
    const body = req.body || {}
    const now = new Date()
    const result = await db.collection('alerts').insertOne({
      batteryId: body.batteryId || 'BAT001',
      severity: body.severity,
      type: body.type,
      message: body.message,
      bhi: body.bhi,
      sensorData: body.sensorData,
      acknowledged: false,
      timestamp: now,
    })
    res.json({ success: true, id: String(result.insertedId) })
  } catch (error) {
    console.error('alerts post error:', error)
    res.status(500).json({ error: error.message })
  }
}
