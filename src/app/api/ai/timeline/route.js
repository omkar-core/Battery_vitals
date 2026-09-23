import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { getBatteryTimeline } from '../../../../lib/batteryTimeline'
import { callAIProvider } from '../../../../lib/aiProvider'
import { logAIAuditRecord } from '../../../../lib/aiAudit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const startTime = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const events = await getBatteryTimeline(guard.user.id, guard.batteryId)

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/timeline',
      responseTimeMs: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      batteryId: guard.batteryId,
      eventsCount: events.length,
      events,
    })
  } catch (error) {
    console.error('Error in GET /api/ai/timeline:', error)
    return NextResponse.json({ error: 'Failed to retrieve timeline', details: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  const startTime = Date.now()
  try {
    const body = await request.json()
    const batteryId = body.batteryId || 'BAT001'
    const eventId = body.eventId

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const events = await getBatteryTimeline(guard.user.id, guard.batteryId)
    const targetEvent = events.find((e) => e.id === eventId) || events[0]

    const prompt = `Analyze this specific battery event on timeline:
Event Title: ${targetEvent.title}
Event Type: ${targetEvent.type}
Severity: ${targetEvent.severity}
Description: ${targetEvent.description}
Timestamp: ${targetEvent.timestamp}

Provide a concise 2-3 sentence AI explanation of why this event occurred and recommended follow-up maintenance actions.`

    const aiExplanation = await callAIProvider({
      taskType: 'chat',
      prompt,
    })

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/timeline/explain',
      responseTimeMs: Date.now() - startTime,
    })

    return NextResponse.json({
      success: true,
      event: targetEvent,
      aiExplanation,
    })
  } catch (error) {
    console.error('Error in POST /api/ai/timeline:', error)
    return NextResponse.json({ error: 'Failed to explain timeline event', details: error.message }, { status: 500 })
  }
}
