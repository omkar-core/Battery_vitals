import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { ensureAiIndexes, DIAGNOSTICS_COLLECTION } from '../../../../lib/aiDb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

// Latest structured diagnostic (database proof of the last AI analysis).
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_latest_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    const db = await getDB()
    await ensureAiIndexes()
    const doc = await db
      .collection(DIAGNOSTICS_COLLECTION)
      .findOne({ batteryId }, { sort: { createdAt: -1 } })

    if (!doc) {
      return NextResponse.json({ success: false, error: 'No AI diagnostic saved yet' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      diagnostic: {
        id: String(doc._id),
        safety: doc.safety,
        result: doc.result,
        source: doc.source,
        cached: doc.cached,
        model: doc.model,
        createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : null,
      },
    })
  } catch (error) {
    console.error('[BatteryAI] latest diagnostic error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load latest diagnostic' }, { status: 500 })
  }
}