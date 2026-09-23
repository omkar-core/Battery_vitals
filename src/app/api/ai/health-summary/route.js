import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { buildAIContext, formatAIContextPrompt } from '../../../../lib/aiContext'
import { callAIProvider } from '../../../../lib/aiProvider'
import { logAIAuditRecord } from '../../../../lib/aiAudit'
import { getDB } from '../../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const startTime = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const period = searchParams.get('period') || '30d'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const aiContext = await buildAIContext({ userId: guard.user.id, batteryId: guard.batteryId })

    // Compute telemetry fingerprint
    const fingerprint = `fp_${guard.batteryId}_${aiContext.currentTelemetry.soh}_${aiContext.currentTelemetry.cycles}_${aiContext.currentTelemetry.temperature}_${aiContext.deterministicSafetyState.statusLabel}`

    // Check DB for cached result matching fingerprint
    try {
      const db = await getDB()
      const cached = await db.collection('ai_cached_summaries').findOne({
        userId: guard.user.id,
        batteryId: guard.batteryId,
        telemetryFingerprint: fingerprint,
      })

      if (cached) {
        await logAIAuditRecord({
          userId: guard.user.id,
          batteryId: guard.batteryId,
          endpoint: '/api/ai/health-summary',
          responseTimeMs: Date.now() - startTime,
          cacheHit: true,
          deterministicSafetyState: aiContext.deterministicSafetyState.statusLabel,
        })

        const { _id, ...cachedRest } = cached
        return NextResponse.json({
          success: true,
          cached: true,
          summary: cachedRest,
        })
      }
    } catch (e) {
      console.warn('[health-summary] Cache lookup failed, regenerating:', e.message)
    }

    // Generate fresh summary using AI
    const contextPrompt = formatAIContextPrompt(aiContext)
    const prompt = `${contextPrompt}

Generate a concise Battery Health Summary. Return JSON matching:
{
  "soh": "${aiContext.currentTelemetry.soh}%",
  "trend": "${aiContext.historicalTrends.current.soh < aiContext.historicalTrends.previous30DaysAgo.soh ? 'Declining' : 'Stable'}",
  "cycles": ${aiContext.currentTelemetry.cycles},
  "thermalEvents": ${aiContext.recentAlerts.filter((a) => a.field === 'temperature').length || 1},
  "protectionEvents": ${aiContext.deterministicSafetyState.activeTrips.length || 0},
  "aiInterpretation": "Clear diagnostic interpretation of health trajectory and operational status."
}`

    const aiResponseText = await callAIProvider({
      taskType: 'report',
      prompt,
      systemInstruction: 'Output valid JSON matching requested fields strictly.',
    })

    let summaryObj = null
    try {
      summaryObj = JSON.parse(aiResponseText.replace(/```json|```/g, '').trim())
    } catch (e) {
      summaryObj = {
        soh: `${aiContext.currentTelemetry.soh}%`,
        trend: 'Stable',
        cycles: aiContext.currentTelemetry.cycles,
        thermalEvents: 1,
        protectionEvents: 0,
        aiInterpretation: aiResponseText,
      }
    }

    const resultRecord = {
      userId: guard.user.id,
      batteryId: guard.batteryId,
      period,
      telemetryFingerprint: fingerprint,
      model: 'gemini-1.5-flash',
      safetyState: aiContext.deterministicSafetyState.statusLabel,
      summary: summaryObj,
      generatedAt: new Date().toISOString(),
    }

    // Store in DB cache
    try {
      const db = await getDB()
      await db.collection('ai_cached_summaries').updateOne(
        { userId: guard.user.id, batteryId: guard.batteryId, telemetryFingerprint: fingerprint },
        { $set: resultRecord },
        { upsert: true }
      )
    } catch (err) {
      console.warn('[health-summary] Failed to store cache:', err.message)
    }

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/health-summary',
      responseTimeMs: Date.now() - startTime,
      cacheHit: false,
      deterministicSafetyState: aiContext.deterministicSafetyState.statusLabel,
    })

    return NextResponse.json({
      success: true,
      cached: false,
      summary: resultRecord,
    })
  } catch (error) {
    console.error('Error in GET /api/ai/health-summary:', error)
    return NextResponse.json({ error: 'Failed to generate health summary', details: error.message }, { status: 500 })
  }
}
