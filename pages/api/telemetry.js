import { getDB } from '../../src/lib/mongodb'
import { telemetryShape } from './data'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store, max-age=0')

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
    const batteryId = req.query.batteryId || 'BAT001'
    const db = await getDB()
    const data = await db.collection('live_data').findOne({ batteryId })
    if (!data) return res.json({ message: 'No data yet' })

    const latestReading = await db.collection('readings').findOne(
      { batteryId },
      { sort: { timestamp: -1 } }
    )
    const source = latestReading || data

    return res.status(200).json(telemetryShape(source))
  } catch (error) {
    console.error('telemetry error:', error)
    return res.status(500).json({ error: error.message })
  }
}

async function handlePost(req, res) {
  try {
    const body = req.body || {}
    const b = body.battery || body
    const g = body.gas || {}
    const e = body.environment || {}
    const n = body.network || {}
    const batteryId = body.batteryId || 'BAT001'
    const now = new Date()

    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }
    const safety = safetyMap[b.safety ? String(b.safety).toUpperCase() : (body.state || 'SAFE')] || 'SAFE'

    const document = {
      batteryId,
      voltage: b.voltage,
      current: b.current != null ? b.current / 1000 : null,
      power: b.power != null ? b.power / 1000 : b.power,
      soc: b.soc,
      soh: b.soh,
      temperature: e.temperature != null ? e.temperature : body.temperature,
      humidity: e.humidity != null ? e.humidity : body.humidity,
      gasIndex: { mq2: g.index_mq2 != null ? g.index_mq2 : body.mq2, mq135: g.index_mq135 != null ? g.index_mq135 : body.mq135 },
      safety,
      bhi: body.risk?.bhi != null ? body.risk.bhi : body.bhi,
      opDirection: b.op || 'IDLE',
      resistance: b.resistance,
      outputs: body.outputs || { auto: body.auto_mode, red: body.red_led, yellow: body.yellow_led, green: body.green_led, buzzer: body.buzzer },
      network: n.rssi != null ? n : { rssi: body.wifi_rssi, heap: body.free_heap, ip: n.ip },
      timestamp: now,
      receivedAt: now,
    }

    const db = await getDB()
    await db.collection('live_data').updateOne(
      { batteryId },
      { $set: document },
      { upsert: true }
    )
    await db.collection('readings').insertOne(document)

    return res.status(200).json({ success: true, ts: now.getTime() })
  } catch (error) {
    console.error('telemetry post error:', error)
    return res.status(200).json({ success: true, ts: Date.now(), error: error.message })
  }
}
