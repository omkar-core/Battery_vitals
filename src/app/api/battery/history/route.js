import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_hist_${ip}`, 60, 60000)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

    let records = []
    try {
      const db = await getDB()
      records = await db
        .collection('readings')
        .find({ $or: [{ batteryId }, { deviceId: batteryId }] })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
    } catch (e) {}

    // Transform records
    const formatted = records.reverse().map((r, i) => {
      const b = r.battery || r
      return {
        timestamp: r.timestamp || r.createdAt || Date.now(),
        voltage: b.voltage != null ? Number(b.voltage) : 12.6,
        current: b.current != null ? Number(b.current) : 0,
        power: b.power != null ? Number(b.power) : 0,
        soc: b.soc != null ? Number(b.soc) : 85,
        soh: b.soh != null ? Number(b.soh) : 98,
      }
    })

    return NextResponse.json({
      batteryId,
      count: formatted.length,
      readings: formatted,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch battery history', details: error.message }, { status: 500 })
  }
}
