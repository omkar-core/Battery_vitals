import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { buildAIContext, formatAIContextPrompt } from '../../../../lib/aiContext'
import { callAIProvider } from '../../../../lib/aiProvider'
import { logAIAuditRecord } from '../../../../lib/aiAudit'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const startTime = Date.now()
  try {
    const body = await request.json()
    const batteryId = body.batteryId || 'BAT001'
    const question = body.question || 'Why is my battery health decreasing?'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const aiContext = await buildAIContext({ userId: guard.user.id, batteryId: guard.batteryId })
    const contextPrompt = formatAIContextPrompt(aiContext)

    const prompt = `${contextPrompt}

USER QUESTION ABOUT BATTERY HISTORY:
"${question}"

Instruction: Explain the change or historical pattern using only verified indicators above. If available data does not support a specific root cause, state that explicitly. Do not claim a cause unsupported by sensor readings.`

    const answer = await callAIProvider({
      taskType: 'chat',
      prompt,
    })

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/ask-history',
      responseTimeMs: Date.now() - startTime,
      deterministicSafetyState: aiContext.deterministicSafetyState.statusLabel,
    })

    return NextResponse.json({
      success: true,
      batteryId: guard.batteryId,
      question,
      answer,
      aiContext: {
        currentSOH: aiContext.currentTelemetry.soh,
        previousSOH: aiContext.historicalTrends.previous30DaysAgo.soh,
        currentCycles: aiContext.currentTelemetry.cycles,
        previousCycles: aiContext.historicalTrends.previous30DaysAgo.cycles,
      },
    })
  } catch (error) {
    console.error('Error in POST /api/ai/ask-history:', error)
    return NextResponse.json({ error: 'Failed to process history question', details: error.message }, { status: 500 })
  }
}
