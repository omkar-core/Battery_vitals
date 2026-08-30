import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { runBatteryDiagnostic } from '../../../../lib/gemini'
import { loadAiContext, ensureAiIndexes, DIAGNOSTICS_COLLECTION } from '../../../../lib/aiDb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString, secureErrorResponse } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

// Run a full diagnostic: validation -> deterministic safety -> Gemini ->
// structured validation -> persistence. Cached by telemetry fingerprint.
export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_diagnostic_post_${ip}`, 6, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'AI diagnostic rate limit exceeded. Please wait a minute.' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const forced = body.forced === true

    const { latest, history, alerts } = await loadAiContext(batteryId)

    if (!latest) {
      return NextResponse.json(
        {
          success: false,
          error: 'No telemetry received from ESP32 hardware yet. Waiting for the initial sensor packet before an AI safety diagnostic can run.',
        },
        { status: 404 }
      )
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
    return secureErrorResponse(error.message)
  }
}