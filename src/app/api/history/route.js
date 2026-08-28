import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const limit = searchParams.get('limit') || '500'
    const minutes = searchParams.get('minutes') || '60'

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 500, 1), 5000)
    const parsedMinutes = Math.min(Math.max(parseInt(minutes) || 60, 1), 1440)

    const db = await getDB()
    const since = new Date(Date.now() - parsedMinutes * 60 * 1000)

    const data = await db
      .collection('readings')
      .find({ batteryId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .limit(parsedLimit)
      .toArray()

    return NextResponse.json({
      success: true,
      count: data.length,
      data: data.map((d) => ({
        id: String(d._id),
        time: d.timestamp ? new Date(d.timestamp) : null,
        voltage: d.voltage,
        current: d.current,
        power: d.power,
        soc: d.soc,
        soh: d.soh,
        temperature: d.temperature,
        humidity: d.humidity,
        bhi: d.bhi,
        safety: d.safety,
      })),
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (error) {
    console.error('history error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
