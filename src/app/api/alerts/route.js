import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const db = await getDB()
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId')
    const severity = searchParams.get('severity')
    const limit = searchParams.get('limit') || '100'
    const q = {}
    if (batteryId) q.batteryId = batteryId
    if (severity && severity !== 'all') q.severity = severity.toUpperCase()

    const alerts = await db
      .collection('alerts')
      .find(q)
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
  } catch (error) {
    console.error('alerts get error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const db = await getDB()
    const body = await request.json().catch(() => ({}))
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
    return NextResponse.json({ success: true, id: String(result.insertedId) })
  } catch (error) {
    console.error('alerts post error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
