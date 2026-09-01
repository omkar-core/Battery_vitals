import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`env_hist_${ip}`, 60, 60000)
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

    const formatted = records.reverse().map((r) => {
      const e = r.environmental || r
      return {
        timestamp: r.timestamp || r.createdAt || Date.now(),
        temperature: e.temperature != null ? Number(e.temperature) : 25.0,
        humidity: e.humidity != null ? Number(e.humidity) : 55.0,
        mq2: e.mq2 != null ? Number(e.mq2) : (e.gasIndex?.mq2 != null ? Number(e.gasIndex.mq2) : 320),
        mq135: e.mq135 != null ? Number(e.mq135) : (e.gasIndex?.mq135 != null ? Number(e.gasIndex.mq135) : 110),
      }
    })

    return NextResponse.json({
      batteryId,
      count: formatted.length,
      readings: formatted,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch environmental history', details: error.message }, { status: 500 })
  }
}
