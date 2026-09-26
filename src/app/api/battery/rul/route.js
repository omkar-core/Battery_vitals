import { NextResponse } from 'next/server'
import { predictRulWithUncertainty } from '../../../../lib/rulModel'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { handleError } from '../../../../lib/errorHandler'
import { sanitizeString } from '../../../../lib/security'
import { getDB } from '../../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`rul_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    let history = []

    try {
      const db = await getDB()
      if (db) {
        history = await db
          .collection('readings')
          .find({ batteryId })
          .sort({ timestamp: -1 })
          .limit(100)
          .toArray()
        history.reverse()
      }
    } catch (e) {
      console.warn('[RUL API] MongoDB history fetch failed:', e.message)
    }


    const prediction = predictRulWithUncertainty(history, {
      threshold: 80.0,
      bootstrapN: 150,
      cyclesPerDay: 1.0,
    })

    return NextResponse.json({
      success: true,
      batteryId,
      prediction,
    })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`rul_post_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const history = Array.isArray(body.history) ? body.history : []
    const threshold = Number(body.threshold) || 80.0
    const bootstrapN = Number(body.bootstrapN) || 150
    const cyclesPerDay = Number(body.cyclesPerDay) || 1.0

    const prediction = predictRulWithUncertainty(history, {
      threshold,
      bootstrapN,
      cyclesPerDay,
    })

    return NextResponse.json({
      success: true,
      prediction,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
