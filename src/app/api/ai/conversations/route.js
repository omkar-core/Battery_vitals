import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { getConversations, createConversation } from '../../../../lib/conversations'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const conversations = await getConversations(guard.user.id, guard.batteryId)
    return NextResponse.json({
      success: true,
      conversations,
      count: conversations.length,
    })
  } catch (error) {
    console.error('Error in GET /api/ai/conversations:', error)
    return NextResponse.json({ error: 'Failed to retrieve conversations', details: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const batteryId = body.batteryId || 'BAT001'

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const conversation = await createConversation(guard.user.id, guard.batteryId, body.title)
    return NextResponse.json({ success: true, conversation })
  } catch (error) {
    console.error('Error in POST /api/ai/conversations:', error)
    return NextResponse.json({ error: 'Failed to create conversation', details: error.message }, { status: 500 })
  }
}
