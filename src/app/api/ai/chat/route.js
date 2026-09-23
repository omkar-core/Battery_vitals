import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { buildAIContext, formatAIContextPrompt } from '../../../../lib/aiContext'
import { callAIProvider } from '../../../../lib/aiProvider'
import { logAIAuditRecord } from '../../../../lib/aiAudit'
import { appendMessage } from '../../../../lib/conversations'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const aiContext = await buildAIContext({ userId: guard.user.id, batteryId: guard.batteryId })
    return NextResponse.json({
      success: true,
      batteryId: guard.batteryId,
      aiContext,
    })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  const startTime = Date.now()
  try {
    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const question = sanitizeString(body.question || body.message || '', 2000)
    const conversationId = body.conversationId || null

    if (!question) {
      return NextResponse.json({ error: 'Missing question or message' }, { status: 400 })
    }

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const aiContext = await buildAIContext({ userId: guard.user.id, batteryId: guard.batteryId })
    const contextPrompt = formatAIContextPrompt(aiContext)

    const prompt = `${contextPrompt}

USER QUERY:
"${question}"`

    // Call AI provider with prompt injection defense & safety engine grounding
    const answer = await callAIProvider({
      taskType: 'chat',
      prompt,
    })

    // Store in multi-session conversation if conversationId is provided
    if (conversationId) {
      await appendMessage(conversationId, guard.user.id, 'user', question).catch(() => {})
      await appendMessage(conversationId, guard.user.id, 'assistant', answer).catch(() => {})
    }

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/chat',
      conversationId,
      responseTimeMs: Date.now() - startTime,
      deterministicSafetyState: aiContext.deterministicSafetyState.statusLabel,
    })

    return NextResponse.json({
      success: true,
      answer,
      response: answer,
      batteryId: guard.batteryId,
      aiContext: {
        safetyState: aiContext.deterministicSafetyState.statusLabel,
        sensorConfidence: aiContext.sensorConfidence.overallConfidence,
        currentSOH: aiContext.currentTelemetry.soh,
      },
    })
  } catch (error) {
    return handleError(error, request)
  }
}