import { NextResponse } from 'next/server'
import { getSessionUser } from '../../../../../lib/auth'
import { getConversation, appendMessage, deleteConversation } from '../../../../../lib/conversations'

export async function GET(request, { params }) {
  try {
    const user = await getSessionUser(request)
    const conversationId = params.id

    const conversation = await getConversation(conversationId, user.id)
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, conversation })
  } catch (error) {
    console.error('Error in GET /api/ai/conversations/[id]:', error)
    return NextResponse.json({ error: 'Failed to retrieve conversation', details: error.message }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const user = await getSessionUser(request)
    const conversationId = params.id
    const body = await request.json()

    if (!body.role || !body.content) {
      return NextResponse.json({ error: 'Missing role or content' }, { status: 400 })
    }

    const message = await appendMessage(conversationId, user.id, body.role, body.content)
    return NextResponse.json({ success: true, message })
  } catch (error) {
    console.error('Error in POST /api/ai/conversations/[id]:', error)
    return NextResponse.json({ error: 'Failed to append message', details: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getSessionUser(request)
    const conversationId = params.id

    const deleted = await deleteConversation(conversationId, user.id)
    if (!deleted) {
      return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Conversation deleted' })
  } catch (error) {
    console.error('Error in DELETE /api/ai/conversations/[id]:', error)
    return NextResponse.json({ error: 'Failed to delete conversation', details: error.message }, { status: 500 })
  }
}
