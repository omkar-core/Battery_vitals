import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { secureErrorResponse } from '../../../lib/security'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`stats_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const db = await getDB()
    const [r, a, firebaseLatest, d] = await Promise.all([
      db.collection('readings').countDocuments(),
      db.collection('alerts').countDocuments(),
      getLatestTelemetry('BAT001'),
      db.collection('devices').countDocuments(),
    ])

    let l = firebaseLatest
    if (!l) {
      l = await db.collection('live_data').findOne({ batteryId: 'BAT001' })
    }

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
    return secureErrorResponse(error.message)
  }
}
