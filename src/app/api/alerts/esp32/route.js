import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  try {
    const db = await getDB()
    const body = await request.json().catch(() => ({}))
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
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('alerts/esp32 error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const db = await getDB()
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId')
    const severity = searchParams.get('severity')
    const limit = searchParams.get('limit') || '100'
    const query = {}
    if (batteryId) query.batteryId = batteryId
    if (severity && severity !== 'all') query.severity = severity.toUpperCase()
    const alerts = await db
      .collection('alerts')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .toArray()
    return NextResponse.json(alerts.map((a) => ({
      id: String(a._id),
      time: a.timestamp,
      severity: a.severity,
      type: a.type,
      bhi: a.bhi,
      message: a.message,
      acknowledged: a.acknowledged,
    })))
  } catch (err) {
    console.error('alerts/esp32 error:', err.message)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
