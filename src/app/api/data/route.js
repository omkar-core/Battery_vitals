import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  const res = NextResponse.next()
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Cache-Control', 'no-store, max-age=0')
  try {
    const d = await request.json().catch(() => ({}))
    const batteryId = d.batteryId || 'BAT001'
    const now = new Date()

    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }
    const safety = safetyMap[d.state] || 'SAFE'

    const document = {
      batteryId,
      deviceId: d.deviceId || null,
      voltage: d.voltage,
      current: d.current != null ? d.current / 1000 : null,
      power: d.power != null ? d.power / 1000 : null,
      soc: d.soc,
      soh: d.soh,
      temperature: d.temperature,
      humidity: d.humidity,
      gasIndex: { mq2: d.mq2, mq135: d.mq135, warm: d.warm ?? true },
      safety,
      bhi: d.bhi,
      opDirection: (d.op || d.opDirection || 'IDLE').toUpperCase(),
      resistance: d.resistance,
      profile: d.profile,
      outputs: { auto: d.auto_mode, red: d.red_led, yellow: d.yellow_led, green: d.green_led, buzzer: d.buzzer },
      network: { rssi: d.wifi_rssi, heap: d.free_heap },
      firmware: d.firmware,
      uptime: d.uptime,
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

    return NextResponse.json({ success: true, ts: now.getTime() }, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('data save error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const db = await getDB()
    const data = await db.collection('live_data').findOne({ batteryId })
    if (!data) return NextResponse.json({ error: 'No data yet' }, { status: 404 })
    return NextResponse.json({ success: true, data: telemetryShape(data) })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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
