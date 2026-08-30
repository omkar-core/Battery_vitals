import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry, updateLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, sanitizeNumber, secureErrorResponse } from '../../../lib/security'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`data_post_${ip}`, 120, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const d = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(d.batteryId || 'BAT001', 30)
    const now = new Date()

    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }
    const safety = d.state ? safetyMap[String(d.state).toUpperCase()] || 'SAFE' : null

    const document = {
      batteryId,
      deviceId: sanitizeString(d.deviceId || 'BV001', 30),
      voltage: sanitizeNumber(d.voltage, 0, 100),
      current: sanitizeNumber(d.current != null ? (Math.abs(d.current) > 30 ? d.current / 1000 : d.current) : null, -500, 500),
      power: sanitizeNumber(d.power != null ? (Math.abs(d.power) > 200 ? d.power / 1000 : d.power) : null, -5000, 5000),
      soc: sanitizeNumber(d.soc, 0, 100),
      soh: (d.soh_valid === true || (d.soh_valid !== false && sanitizeNumber(d.resistance, 0, 1000) > 0)) ? sanitizeNumber(d.soh, 0, 100) : null,
      temperature: sanitizeNumber(d.temperature, -40, 150),
      humidity: sanitizeNumber(d.humidity, 0, 100),
      gasIndex: {
        mq2: sanitizeNumber(d.mq2, 0, 10000),
        mq135: sanitizeNumber(d.mq135, 0, 10000),
        warm: d.warm != null ? Boolean(d.warm) : null,
      },
      safety,
      bhi: sanitizeNumber(d.bhi, 0, 100),
      opDirection: sanitizeString((d.op || d.opDirection || '').toUpperCase(), 20),
      resistance: sanitizeNumber(d.resistance, 0, 1000),
      profile: sanitizeString(d.profile, 20),
      outputs: {
        auto: d.auto_mode != null ? Boolean(d.auto_mode) : null,
        red: d.red_led != null ? Boolean(d.red_led) : null,
        yellow: d.yellow_led != null ? Boolean(d.yellow_led) : null,
        green: d.green_led != null ? Boolean(d.green_led) : null,
        buzzer: d.buzzer != null ? Boolean(d.buzzer) : null,
      },
      network: {
        rssi: sanitizeNumber(d.wifi_rssi, -150, 0),
        heap: sanitizeNumber(d.free_heap, 0, 10000000),
      },
      firmware: sanitizeString(d.firmware, 20),
      uptime: sanitizeNumber(d.uptime, 0, 100000000),
      timestamp: now.getTime(),
      receivedAt: now.toISOString(),
    }

    // 1. Write to Firebase Realtime Database
    await updateLatestTelemetry(batteryId, document)

    // 2. Write to MongoDB
    try {
      const db = await getDB()
      await db.collection('live_data').updateOne(
        { batteryId },
        { $set: document },
        { upsert: true }
      )
      await db.collection('readings').insertOne(document)
    } catch (dbErr) {
      console.warn('MongoDB save in data POST failed:', dbErr.message)
    }

    return NextResponse.json(
      { success: true, ts: now.getTime() },
      { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    console.error('data save error:', error)
    return secureErrorResponse(error.message)
  }
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`data_get_${ip}`, 120, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    let data = await getLatestTelemetry(batteryId)
    if (!data) {
      const db = await getDB()
      data = await db.collection('live_data').findOne({ batteryId })
    }

    if (!data) return NextResponse.json({ error: 'No data yet' }, { status: 404 })
    return NextResponse.json({ success: true, data: telemetryShape(data) })
  } catch (error) {
    return secureErrorResponse(error.message)
  }
}

export function telemetryShape(d) {
  const op = (d.opDirection || '').toLowerCase()
  return {
    gas: { index_mq2: d.gasIndex?.mq2 ?? d.mq2, status_mq2: d.safety === 'SAFE' ? 'Normal' : 'Elevated', index_mq135: d.gasIndex?.mq135 ?? d.mq135, warm: d.gasIndex?.warm ?? false },
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
    errors: d.errors ?? '--',
    mac: d.mac || '--',
    dataLoss: d.network?.packetLoss ?? d.dataLoss ?? '--',
    cpu: d.cpu,
    temp: d.temp,
    ts: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
  }
}
