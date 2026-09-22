import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { handleError } from '../../../lib/errorHandler'
import { predictFromHistory } from '../../../lib/batteryAnalytics'
import { loadEngineConfigForDevice } from '../../../lib/safetyConfig'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`predictions_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const db = await getDB()
    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || '', 30)
    const rawLimit = Number.parseInt(searchParams.get('limit') || '10', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 100) : 10
    const q = {}
    if (batteryId) q.batteryId = batteryId

    const preds = await db
      .collection('predictions')
      .find(q)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    if (preds.length > 0) {
      return NextResponse.json(preds.map((p) => ({
        ...p,
        _id: String(p._id),
        timestamp: p.timestamp ? p.timestamp : null,
      })))
    }

    // Deterministic fallback: compute rate-of-change trends from recent
    // readings with the SAME sensors (no AI, no failure dates). Honest when
    // history is thin — returns [] with insufficient_data instead of guessing.
    const q2 = { ...(batteryId ? { batteryId } : {}) }
    const rows = await db.collection('readings').find(q2).sort({ timestamp: -1 }).limit(20).toArray()
    const ordered = rows.reverse()
    const engine = await loadEngineConfigForDevice(batteryId || 'BAT001').catch(() => null)
    const computed = predictFromHistory(ordered, engine?.rates || {})
    if (computed.status === 'insufficient_data') return NextResponse.json([])
    const now = Date.now()
    return NextResponse.json(computed.trends.map((t, idx) => ({
      _id: `trend_${t.code}_${now}_${idx}`,
      batteryId: batteryId || 'BAT001',
      timestamp: new Date(now).toISOString(),
      type: t.code.toUpperCase(),
      code: t.code,
      severity: t.severity,
      slope: t.slope,
      description: t.message,
      source: 'deterministic-trend',
    })))
  } catch (error) {
    return handleError(error, request)
  }
}