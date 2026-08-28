import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await getDB()
    const [r, a, l, d] = await Promise.all([
      db.collection('readings').countDocuments(),
      db.collection('alerts').countDocuments(),
      db.collection('live_data').findOne({ batteryId: 'BAT001' }),
      db.collection('devices').countDocuments(),
    ])

    return NextResponse.json({
      totalReadings: r,
      totalAlerts: a,
      deviceCount: d,
      lastReading: l?.timestamp,
      currentSoc: l?.soc,
      currentSafety: l?.safety,
      currentBhi: l?.bhi,
    })
  } catch (error) {
    console.error('stats error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
