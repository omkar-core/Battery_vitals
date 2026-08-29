import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`stats_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const firebaseLatest = await getLatestTelemetry('BAT001')
    let r = 0, a = 0, d = 1
    let l = firebaseLatest

    try {
      const db = await getDB()
      const [readingsCount, alertsCount, devicesCount] = await Promise.all([
        db.collection('readings').countDocuments().catch(() => 0),
        db.collection('alerts').countDocuments().catch(() => 0),
        db.collection('devices').countDocuments().catch(() => 1),
      ])
      r = readingsCount
      a = alertsCount
      d = devicesCount
      if (!l) {
        l = await db.collection('live_data').findOne({ batteryId: 'BAT001' }).catch(() => null)
      }
    } catch (dbErr) {
      console.warn('MongoDB stats lookup fallback:', dbErr.message)
    }

    return NextResponse.json({
      totalReadings: r,
      totalAlerts: a,
      deviceCount: d,
      lastReading: l?.timestamp || Date.now(),
      currentSoc: l?.soc ?? 100,
      currentSafety: l?.safety || 'SAFE',
      currentBhi: l?.bhi ?? 0,
    })
  } catch (error) {
    console.error('stats error:', error)
    return NextResponse.json({
      totalReadings: 0,
      totalAlerts: 0,
      deviceCount: 1,
      lastReading: Date.now(),
      currentSoc: 100,
      currentSafety: 'SAFE',
      currentBhi: 0,
    })
  }
}
