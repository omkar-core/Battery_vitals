import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { buildAIContext } from '../../../../lib/aiContext'
import { callAIProvider } from '../../../../lib/aiProvider'
import { saveReport, getUserReports } from '../../../../lib/reports'
import { logAIAuditRecord } from '../../../../lib/aiAudit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId')

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const reports = await getUserReports(guard.user.id, batteryId)
    return NextResponse.json({ success: true, reports })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  const startTime = Date.now()
  try {
    const rawBody = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(rawBody.batteryId || 'BAT001', 30)
    const period = rawBody.period || 'weekly'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const aiContext = await buildAIContext({ userId: guard.user.id, batteryId: guard.batteryId })

    const prompt = `Generate a ${period.toUpperCase()} Health & Safety Report for Battery ${guard.batteryId} (${aiContext.batteryName}).
Metrics:
- SOH: ${aiContext.currentTelemetry.soh}%
- SOC: ${aiContext.currentTelemetry.soc}%
- Cycles: ${aiContext.currentTelemetry.cycles}
- Temp: ${aiContext.currentTelemetry.temperature}°C
- Safety Rank: ${aiContext.deterministicSafetyState.statusLabel}

Respond with JSON strictly matching:
{
  "title": "${period.charAt(0).toUpperCase() + period.slice(1)} Health Report — ${guard.batteryId}",
  "executiveSummary": "1-2 sentence executive overview.",
  "healthAssessment": "Detailed paragraph assessing capacity retention and degradation rate.",
  "thermalAnalysis": "Thermal operating evaluation.",
  "actionableRecommendations": ["Recommendation 1", "Recommendation 2"]
}`

    const aiResText = await callAIProvider({
      taskType: 'report',
      prompt,
      systemInstruction: 'Output valid JSON strictly matching requested format.',
    })

    let reportContent = null
    try {
      reportContent = JSON.parse(aiResText.replace(/```json|```/g, '').trim())
    } catch (e) {
      reportContent = {
        title: `${period} Battery Report — ${guard.batteryId}`,
        executiveSummary: `Battery ${guard.batteryId} is currently operating in ${aiContext.deterministicSafetyState.statusLabel} state with ${aiContext.currentTelemetry.soh}% SOH.`,
        healthAssessment: `Cell capacity is currently at ${aiContext.currentTelemetry.soh}% with ${aiContext.currentTelemetry.cycles} total discharge cycles completed.`,
        thermalAnalysis: `Operating temperature is nominal at ${aiContext.currentTelemetry.temperature}°C.`,
        actionableRecommendations: ['Maintain cell balance', 'Perform quarterly calibration'],
      }
    }

    const savedReport = await saveReport({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      title: reportContent.title,
      period,
      summary: reportContent.executiveSummary,
      content: reportContent,
      generatedAt: new Date().toISOString(),
    })

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/report',
      responseTimeMs: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      report: savedReport,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
