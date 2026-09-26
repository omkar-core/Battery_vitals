import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { buildAIContext } from '../../../../lib/aiContext'
import { callAIProvider } from '../../../../lib/aiProvider'
import { logAIAuditRecord } from '../../../../lib/aiAudit'

export async function POST(request) {
  const startTime = Date.now()
  try {
    const body = await request.json().catch(() => ({}))
    const batteryId = body.batteryId || 'BAT001'
    const period = body.period || 'week' // 'day' | 'week' | 'month'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const aiContext = await buildAIContext({ userId: guard.user.id, batteryId: guard.batteryId })

    if (aiContext.no_data || !aiContext.historicalTrends?.previous30DaysAgo) {
      return NextResponse.json({
        error: `Insufficient historical cycle data for battery ${aiContext.batteryId} to perform comparative period analysis.`,
        insufficient_data: true,
      }, { status: 400 })
    }

    const prompt = `Perform a side-by-side historical comparison analysis for Battery ${aiContext.batteryId}.
Period requested: ${period.toUpperCase()} comparison.

CURRENT METRICS:
- Cell Temp: ${aiContext.historicalTrends.current.temperature}°C
- SOH: ${aiContext.historicalTrends.current.soh}%
- Cycles: ${aiContext.historicalTrends.current.cycles}
- Internal Resistance: ${aiContext.historicalTrends.current.internalResistance} Ω

PREVIOUS (${period.toUpperCase()} AGO):
- Cell Temp: ${aiContext.historicalTrends.previous30DaysAgo.temperature}°C
- SOH: ${aiContext.historicalTrends.previous30DaysAgo.soh}%
- Cycles: ${aiContext.historicalTrends.previous30DaysAgo.cycles}
- Internal Resistance: ${aiContext.historicalTrends.previous30DaysAgo.internalResistance} Ω

Provide a structured JSON response with exact keys:
{
  "summary": "Brief 2-sentence comparative summary",
  "temperatureChange": "+2.9°C (Slight elevation under high load)",
  "sohChange": "-2% (Normal degradation curve)",
  "cycleIncrease": "+22 cycles",
  "aiInterpretation": "Detailed explanation of key factors driving metrics change. Do not claim causes not supported by data."
}`

    const responseText = await callAIProvider({
      taskType: 'diagnostic',
      prompt,
      systemInstruction: 'Output valid JSON strictly adhering to requested schema.',
    })

    let analysis = null
    try {
      analysis = JSON.parse(responseText.replace(/```json|```/g, '').trim())
    } catch (e) {
      analysis = {
        summary: `Comparing current vs historical metrics for ${aiContext.batteryId}.`,
        temperatureChange: `${aiContext.historicalTrends.current.temperature}°C vs ${aiContext.historicalTrends.previous30DaysAgo.temperature}°C`,
        sohChange: `${aiContext.historicalTrends.current.soh}% vs ${aiContext.historicalTrends.previous30DaysAgo.soh}%`,
        cycleIncrease: `${aiContext.historicalTrends.current.cycles - aiContext.historicalTrends.previous30DaysAgo.cycles} cycles`,
        aiInterpretation: responseText,
      }
    }

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/compare',
      responseTimeMs: Date.now() - startTime,
      deterministicSafetyState: aiContext.deterministicSafetyState.statusLabel,
    })

    return NextResponse.json({
      success: true,
      batteryId: guard.batteryId,
      period,
      metricsComparison: {
        today: {
          temp: `${aiContext.historicalTrends.current.temperature}°C`,
          soh: `${aiContext.historicalTrends.current.soh}%`,
          cycles: `${aiContext.historicalTrends.current.cycles} cycles`,
          internalResistance: `${aiContext.historicalTrends.current.internalResistance} Ω`,
        },
        previous: {
          temp: `${aiContext.historicalTrends.previous30DaysAgo.temperature}°C`,
          soh: `${aiContext.historicalTrends.previous30DaysAgo.soh}%`,
          cycles: `${aiContext.historicalTrends.previous30DaysAgo.cycles} cycles`,
          internalResistance: `${aiContext.historicalTrends.previous30DaysAgo.internalResistance} Ω`,
        },
      },
      analysis,
    })
  } catch (error) {
    console.error('Error in POST /api/ai/compare:', error)
    return NextResponse.json({ error: 'Failed to generate comparison', details: error.message }, { status: 500 })
  }
}
