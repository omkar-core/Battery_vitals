import { NextResponse } from 'next/server'
import { executeBenchmarkValidation } from '../../../lib/validation/runValidation'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { handleError } from '../../../lib/errorHandler'
import { getDB } from '../../../lib/mongodb'
import { DEMO_BATTERY_ID } from '../../../lib/batteryRegistry'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`validation_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    let liveTelemetry = []
    try {
      const db = await getDB()
      if (db) {
        liveTelemetry = await db
          .collection('readings')
          .find({ $or: [{ batteryId: DEMO_BATTERY_ID }, { deviceId: DEMO_BATTERY_ID }] })
          .sort({ timestamp: -1 })
          .limit(20)
          .toArray()
      }
    } catch (e) {
      // Continue without live telemetry
    }

    const results = executeBenchmarkValidation({ liveTelemetry })
    return NextResponse.json({
      success: true,
      data: results,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
