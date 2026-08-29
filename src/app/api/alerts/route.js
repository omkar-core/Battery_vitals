import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { pushAdminAlert } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, sanitizeNumber } from '../../../lib/security'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || '', 30)
    const severity = sanitizeString(searchParams.get('severity') || '', 20)
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')))
    const q = {}
    if (batteryId) q.batteryId = batteryId
    if (severity && severity !== 'all') q.severity = severity.toUpperCase()

    let alerts = []
    try {
      const db = await getDB()
      alerts = await db
        .collection('alerts')
        .find(q)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
    } catch (dbErr) {
      console.warn('MongoDB alert query failed:', dbErr.message)
    }

    return NextResponse.json(alerts.map((a) => ({
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
    return NextResponse.json([])
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_post_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))

    // acknowledge / toggle ack for an existing alert
    if (body.id && body.acknowledged !== undefined) {
      try {
        const db = await getDB()
        const { ObjectId } = await import('mongodb')
        const result = await db.collection('alerts').updateOne(
          { _id: new ObjectId(String(body.id)) },
          { $set: { acknowledged: Boolean(body.acknowledged) } }
        )
        return NextResponse.json({ success: true, modified: result.modifiedCount })
      } catch (e) {
        return NextResponse.json({ success: true, modified: 0 })
      }
    }

    const now = new Date()
    const alertData = {
      batteryId: sanitizeString(body.batteryId || 'BAT001', 30),
      severity: sanitizeString(body.severity || 'INFO', 20).toUpperCase(),
      type: sanitizeString(body.type || 'SYSTEM_ALERT', 40),
      message: sanitizeString(body.message || 'Alert triggered', 500),
      bhi: sanitizeNumber(body.bhi, 0, 100),
      sensorData: body.sensorData || null,
      acknowledged: false,
      timestamp: now.getTime(),
    }

    // 1. Push to Firebase Realtime Database
    const fbKey = await pushAdminAlert(alertData)

    // 2. Persist in MongoDB in background try/catch
    let insertedId = fbKey || 'fb_alert'
    try {
      const db = await getDB()
      const result = await db.collection('alerts').insertOne({
        ...alertData,
        timestamp: now,
      })
      insertedId = String(result.insertedId)
    } catch (dbErr) {
      console.warn('MongoDB insert for alert failed:', dbErr.message)
    }

    return NextResponse.json({ success: true, id: insertedId })
  } catch (error) {
    console.error('alerts post error:', error)
    return NextResponse.json({ success: true, id: 'fb_alert' })
  }
}
