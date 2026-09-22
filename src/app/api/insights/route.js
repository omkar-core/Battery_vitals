import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { getDB } from '../../../lib/mongodb'
import { runBatteryDiagnostic } from '../../../lib/gemini'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { requirePermission } from '../../../lib/auth'
import { PERMISSIONS } from '../../../lib/permissions'
import { handleError } from '../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`insights_get_${ip}`, 20, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // AI insights are gated behind the AI access permission.
    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    let latest = await getLatestTelemetry(batteryId)
    if (!latest) {
      try {
        const db = await getDB()
        latest = await db.collection('live_data').findOne({ batteryId })
      } catch (e) {
        console.warn('MongoDB insights fallback failed:', e.message)
      }
    }

    if (!latest) {
      throw new TelemetryNotFoundError(batteryId, 'latest')
    }

    // Structured diagnostic: `result` carries overall_status/risk_score/etc.
    const diag = await runBatteryDiagnostic({ latest })

    return NextResponse.json({
      batteryId,
      timestamp: Date.now(),
      status: diag.result.overall_status,
      risk_score: diag.result.risk_score,
      summary: diag.result.battery_health_summary,
      key_findings: diag.result.key_findings || [],
      anomalies: diag.result.anomalies || [],
      recommendations: diag.result.recommendations || [],
      predictions: diag.result.predictions || {},
      urgent_actions: (diag.result.recommendations || [])
        .filter((r) => r.priority === 'high' || r.priority === 'critical')
        .map((r) => ({ action: r.action, reason: r.reason, priority: r.priority })),
      source: diag.source || 'deterministic-fallback',
      model: diag.model || null,
      cached: Boolean(diag.cached),
    })
  } catch (error) {
    return handleError(error, request)
  }
}