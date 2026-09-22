import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString, sanitizeNumber } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'
import { ValidationError } from '../../../../lib/errors'
import { dispatchAlert } from '../../../../lib/dispatch'

export const dynamic = 'force-dynamic'

// Device ingestion endpoint: unauthenticated by design (ESP32 has no signing
// ability), so validate/clamp every field and rate-limit per IP.
const SEVERITIES = new Set(['INFO', 'CAUTION', 'WARNING', 'CRITICAL', 'EMERGENCY'])

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_esp32_post_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 })
    }

    const db = await getDB()
    const body = await request.json().catch(() => ({}))

    const severity = sanitizeString(String(body.severity || 'INFO').toUpperCase(), 20)
    if (!SEVERITIES.has(severity)) {
      throw new ValidationError(`Invalid severity: ${severity}`, 'severity')
    }

    const now = Date.now()
    const alertData = {
      batteryId: sanitizeString(body.batteryId || 'BAT001', 30),
      severity,
      type: sanitizeString(body.type || body.message || 'ESP32_ALERT', 40),
      message: sanitizeString(body.message || 'Alert from device', 500),
      bhi: sanitizeNumber(body.bhi, 0, 100),
      sensorData: {
        voltage: sanitizeNumber(body.voltage, 0, 100),
        temperature: sanitizeNumber(body.temperature, -40, 150),
      },
      acknowledged: false,
      timestamp: now,
      receivedAt: new Date(now).toISOString(),
    }
    await db.collection('alerts').insertOne(alertData)
    dispatchAlert(alertData).catch(() => {})
    return NextResponse.json({ success: true, ts: now })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_esp32_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 })
    }

    const db = await getDB()
    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || '', 30)
    const severity = sanitizeString(searchParams.get('severity') || '', 20)
    const rawLimit = Number.parseInt(searchParams.get('limit') || '100', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 200) : 100
    const query = {}
    if (batteryId) query.batteryId = batteryId
    if (severity && severity !== 'all') query.severity = severity.toUpperCase()
    const alerts = await db
      .collection('alerts')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()
    return NextResponse.json(alerts.map((a) => ({
      id: String(a._id),
      time: a.timestamp,
      severity: a.severity,
      type: a.type,
      bhi: a.bhi,
      message: a.message,
      acknowledged: Boolean(a.acknowledged),
    })))
  } catch (error) {
    return handleError(error, request)
  }
}