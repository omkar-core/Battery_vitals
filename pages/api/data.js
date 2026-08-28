import { getDB } from '../../src/lib/mongodb'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'POST') {
    return handleSensorData(req, res)
  }

  if (req.method === 'GET') {
    return handleGet(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleSensorData(req, res) {
  try {
    const d = req.body || {}
    const batteryId = d.batteryId || 'BAT001'
    const now = new Date()

    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }
    const safety = safetyMap[d.state] || 'SAFE'

    const document = {
      batteryId,
      voltage: d.voltage,
      current: d.current != null ? d.current / 1000 : null,
      power: d.power != null ? d.power / 1000 : null,
      soc: d.soc,
      soh: d.soh,
      temperature: d.temperature,
      humidity: d.humidity,
      gasIndex: { mq2: d.mq2, mq135: d.mq135 },
      safety,
      bhi: d.bhi,
      outputs: { auto: d.auto_mode, red: d.red_led, yellow: d.yellow_led, green: d.green_led, buzzer: d.buzzer },
      network: { rssi: d.wifi_rssi, heap: d.free_heap },
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
    console.error('data save error:', error)
    return res.status(200).json({ success: true, ts: Date.now(), error: error.message })
  }
}

async function handleGet(req, res) {
  try {
    const batteryId = req.query.batteryId || 'BAT001'
    const db = await getDB()
    const data = await db.collection('live_data').findOne({ batteryId })
    if (!data) return res.status(404).json({ error: 'No data yet' })
    return res.status(200).json({ success: true, data: telemetryShape(data) })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export function telemetryShape(d) {
  const op = (d.opDirection || 'IDLE').toLowerCase()
  return {
    gas: { index_mq2: d.gasIndex?.mq2, status_mq2: d.safety === 'SAFE' ? 'Normal' : 'Elevated', index_mq135: d.gasIndex?.mq135, warm: d.gasIndex?.warm ?? true },
    environment: { temperature: d.temperature, humidity: d.humidity },
    battery: {
      voltage: d.voltage, current: d.current, power: d.power,
      soc: d.soc, soh: d.soh, safety: d.safety, op,
      resistance: d.resistance, profile: d.profile, phase: d.phase,
      cycles: d.cycles, chemistry: d.chemistry, energyWh: d.energyWh,
    },
    risk: { bhi: d.bhi },
    network: d.network || {},
    outputs: d.outputs || {},
    firmware: d.firmware || d.mac || '--',
    uptime: d.uptime || '--',
    errors: d.errors || 0,
    mac: d.mac || '--',
    dataLoss: d.network?.packetLoss ?? d.dataLoss ?? 0,
    cpu: d.cpu,
    temp: d.temp,
    ts: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
  }
}
