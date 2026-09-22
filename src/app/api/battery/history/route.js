import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_hist_${ip}`, 60, 60000)
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
      console.warn('MongoDB battery/history query failed:', e.message)
    }

    // Map honestly: a missing reading is null, never an invented default.
    const formatted = records.reverse().map((r, i) => {
      const b = r.battery || r
      const voltage = b.voltage != null ? Number(b.voltage) : null
      const current = b.current != null ? Number(b.current) : null
      return {
        timestamp: r.timestamp || r.createdAt || Date.now(),
        voltage,
        current,
        power: b.power != null ? Number(b.power) : null,
        soc: b.soc != null ? Number(b.soc) : null,
        soh: b.soh != null ? Number(b.soh) : null,
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