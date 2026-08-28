import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const db = await getDB()
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId')
    const limit = searchParams.get('limit') || '10'
    const q = {}
    if (batteryId) q.batteryId = batteryId

    const preds = await db
      .collection('predictions')
      .find(q)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) || 10)
      .toArray()

    return NextResponse.json(preds.map((p) => ({
      ...p,
      _id: String(p._id),
      timestamp: p.timestamp ? p.timestamp : null,
    })))
  } catch (error) {
    console.error('predictions error:', error)
    return NextResponse.json([])
  }
}
