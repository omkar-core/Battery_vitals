import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const db = await getDB()
    const data = await db.collection('live_data').findOne({ batteryId })

    if (!data) {
      return NextResponse.json({
        error: 'No data available',
        message: 'ESP32 has not sent data yet',
      }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } })
    }

    return NextResponse.json({
      success: true,
      data: serialize(data),
    }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('latest error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function serialize(d) {
  return {
    ...d,
    _id: String(d._id),
    timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
    receivedAt: d.receivedAt ? new Date(d.receivedAt).getTime() : null,
  }
}
