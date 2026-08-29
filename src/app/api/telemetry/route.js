import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry, updateLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, sanitizeNumber, secureErrorResponse } from '../../../lib/security'
import { telemetryShape } from '../data/route'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`telemetry_get_${ip}`, 120, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    // Try reading from Firebase Realtime Database
    let data = await getLatestTelemetry(batteryId)

    if (!data) {
      const db = await getDB()
      data = await db.collection('live_data').findOne({ batteryId })
      if (!data) return NextResponse.json({ message: 'No data yet' })
    }

    return NextResponse.json(telemetryShape(data), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('telemetry get error:', error)
    return secureErrorResponse(error.message)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`telemetry_post_${ip}`, 180, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const b = body.battery || body
    const g = body.gas || {}
    const e = body.environment || {}
    const n = body.network || {}
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const now = new Date()

    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }
    const rawSafety = b.safety ? String(b.safety).toUpperCase() : (body.state || 'SAFE')
    const safety = safetyMap[rawSafety] || 'SAFE'

    // Validate numeric bounds
    const voltage = sanitizeNumber(b.voltage, 0, 100)
    const current = sanitizeNumber(b.current != null ? b.current / 1000 : null, -500, 500)
    const power = sanitizeNumber(b.power != null ? b.power / 1000 : b.power, -5000, 5000)
    const soc = sanitizeNumber(b.soc, 0, 100)
    const soh = sanitizeNumber(b.soh, 0, 100)
    const temperature = sanitizeNumber(e.temperature != null ? e.temperature : body.temperature, -40, 150)
    const humidity = sanitizeNumber(e.humidity != null ? e.humidity : body.humidity, 0, 100)
    const mq2 = sanitizeNumber(g.index_mq2 != null ? g.index_mq2 : body.mq2, 0, 10000)
    const mq135 = sanitizeNumber(g.index_mq135 != null ? g.index_mq135 : body.mq135, 0, 10000)
    const bhi = sanitizeNumber(body.risk?.bhi != null ? body.risk.bhi : body.bhi, 0, 100)

    const document = {
      batteryId,
      deviceId: sanitizeString(body.deviceId || 'BV001', 30),
      voltage,
      current,
      power,
      soc,
      soh,
      temperature,
      humidity,
      gasIndex: { mq2, mq135, warm: Boolean(g.warm ?? body.warm ?? true) },
      safety,
      bhi,
      opDirection: sanitizeString((b.op || body.opDirection || 'IDLE').toUpperCase(), 20),
      resistance: sanitizeNumber(b.resistance, 0, 1000),
      profile: sanitizeString(b.profile || 'LI_ION', 20),
      outputs: {
        auto: Boolean(body.outputs?.auto ?? body.auto_mode ?? true),
        red: Boolean(body.outputs?.red ?? body.red_led),
        yellow: Boolean(body.outputs?.yellow ?? body.yellow_led),
        green: Boolean(body.outputs?.green ?? body.green_led ?? true),
        buzzer: Boolean(body.outputs?.buzzer ?? body.buzzer),
      },
      network: {
        rssi: sanitizeNumber(n.rssi ?? body.wifi_rssi, -150, 0),
        heap: sanitizeNumber(n.heap ?? body.free_heap, 0, 10000000),
        ip: sanitizeString(n.ip || body.ip || '', 40),
      },
      timestamp: now.getTime(),
      receivedAt: now.toISOString(),
    }

    // 1. Update Real-Time Layer (Firebase Realtime Database)
    await updateLatestTelemetry(batteryId, document)

    // 2. Persist in MongoDB
    try {
      const db = await getDB()
      await db.collection('live_data').updateOne(
        { batteryId },
        { $set: document },
        { upsert: true }
      )
      await db.collection('readings').insertOne(document)
    } catch (dbErr) {
      console.warn('MongoDB persist in telemetry POST failed:', dbErr.message)
    }

    return NextResponse.json({ success: true, ts: now.getTime() })
  } catch (error) {
    console.error('telemetry post error:', error)
    return secureErrorResponse(error.message)
  }
}
