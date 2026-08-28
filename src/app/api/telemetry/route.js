import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { telemetryShape } from '../data/route'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const db = await getDB()
    const data = await db.collection('live_data').findOne({ batteryId })
    if (!data) return NextResponse.json({ message: 'No data yet' })

    const latestReading = await db.collection('readings').findOne(
      { batteryId },
      { sort: { timestamp: -1 } }
    )
    const source = latestReading || data

    return NextResponse.json(telemetryShape(source), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('telemetry error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
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
      deviceId: body.deviceId || null,
      voltage: b.voltage,
      current: b.current != null ? b.current / 1000 : null,
      power: b.power != null ? b.power / 1000 : b.power,
      soc: b.soc,
      soh: b.soh,
      temperature: e.temperature != null ? e.temperature : body.temperature,
      humidity: e.humidity != null ? e.humidity : body.humidity,
      gasIndex: { mq2: g.index_mq2 != null ? g.index_mq2 : body.mq2, mq135: g.index_mq135 != null ? g.index_mq135 : body.mq135, warm: g.warm ?? body.warm ?? true },
      safety,
      bhi: body.risk?.bhi != null ? body.risk.bhi : body.bhi,
      opDirection: (b.op || body.opDirection || 'IDLE').toUpperCase(),
      resistance: b.resistance,
      profile: b.profile,
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

    return NextResponse.json({ success: true, ts: now.getTime() })
  } catch (error) {
    console.error('telemetry post error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
