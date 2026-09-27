import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { runBatteryDiagnostic } from '../../../../lib/gemini'
import { loadAiContext, ensureAiIndexes, DIAGNOSTICS_COLLECTION } from '../../../../lib/aiDb'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

// Run a full diagnostic: validation -> deterministic safety -> Gemini ->
// structured validation -> persistence. Cached by telemetry fingerprint.
export async function POST(request) {
  try {
    const guard = await guardAIRequest(request, null, 'diagnostic')
    if (!guard.authorized) {
      const headers = guard.retryAfter ? { 'Retry-After': String(guard.retryAfter) } : {}
      return NextResponse.json({ error: guard.error }, { status: guard.status, headers })
    }

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const forced = body.forced === true

    let { latest, history, alerts } = await loadAiContext(batteryId)

    if (!latest && body.telemetry) {
      latest = body.telemetry
    }
    if (!latest && body.voltage !== undefined) {
      latest = body
    }
    if (!latest) {
      return NextResponse.json({
        error: `No live sensor telemetry received from ESP32 for battery ${batteryId}`,
        insufficient_data: true,
      }, { status: 404 })
    }

    const outcome = await runBatteryDiagnostic({ latest, history, alerts, forced })

    await ensureAiIndexes()
    let id = null
    try {
      const db = await getDB()
      const doc = {
        batteryId,
        safety: outcome.safety,
        result: outcome.result,
        source: outcome.source,
        cached: outcome.cached === true,
        model: outcome.model || null,
        snapshot: outcome.snapshot,
        historySummary: outcome.historySummary,
        createdAt: new Date(),
      }
      const ins = await db.collection(DIAGNOSTICS_COLLECTION).insertOne(doc)
      id = String(ins.insertedId)
    } catch (dbErr) {
      console.warn('[BatteryAI] diagnostic persistence failed:', dbErr.message)
    }

    return NextResponse.json({
      success: true,
      id,
      source: outcome.source,
      cached: outcome.cached === true,
      model: outcome.model,
      safety: outcome.safety,
      result: outcome.result,
      generatedAt: outcome.result.generated_at || new Date().toISOString(),
    })
  } catch (error) {
    console.error('[BatteryAI] diagnostic route error:', error)
    return handleError(error, request)
  }
}