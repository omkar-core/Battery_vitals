import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`env_hist_${ip}`, 60, 60000)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const rawLimit = Number.parseInt(searchParams.get('limit') || '100', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 500) : 100

    let records = []
    try {
      const db = await getDB()
      records = await db
        .collection('readings')
        .find({ $or: [{ batteryId }, { deviceId: batteryId }] })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
    } catch (e) {
      console.warn('MongoDB environmental/history query failed:', e.message)
    }

    const formatted = records.reverse().map((r) => {
      const e = r.environment || r.environmental || r
      const gasIndex = r.gasIndex || {}
      return {
        timestamp: r.timestamp || r.createdAt || Date.now(),
        temperature: e.temperature != null ? Number(e.temperature) : null,
        humidity: e.humidity != null ? Number(e.humidity) : null,
        mq2: e.mq2 != null ? Number(e.mq2) : gasIndex.mq2 != null ? Number(gasIndex.mq2) : r.mq2 != null ? Number(r.mq2) : null,
        mq135: e.mq135 != null ? Number(e.mq135) : gasIndex.mq135 != null ? Number(gasIndex.mq135) : r.mq135 != null ? Number(r.mq135) : null,
      }
    })

    return NextResponse.json({
      batteryId,
      count: formatted.length,
      readings: formatted,
    })
  } catch (error) {
    return handleError(error, request)
  }
}