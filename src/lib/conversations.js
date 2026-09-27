import 'server-only'
import { getDB } from './mongodb'

/**
 * List all conversations for a specific user and battery.
 * Requires explicit userId and batteryId - no demo/guest fallback.
 */
export async function getConversations(userId, batteryId) {
  if (!userId || !batteryId) {
    return []
  }

  try {
    const db = await getDB()
    const query = { userId }
    if (batteryId) {
      query.batteryId = batteryId
    }

    const conversations = await db
      .collection('conversations')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray()

    return conversations.map((c) => {
      const { _id, ...rest } = c
      return rest
    })
  } catch (error) {
    console.warn('[conversations] Error loading conversations:', error.message)
    return []
  }
}

/**
 * Create a new conversation session.
 * Requires explicit userId and batteryId - no demo/guest fallback.
 */
export async function createConversation(userId, batteryId, title = 'New Discussion') {
  if (!userId || !batteryId) {
    throw new Error('userId and batteryId are required to create conversation')
  }
  const conversationId = `conv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
  const now = new Date().toISOString()

  const conversation = {
    conversationId,
    userId,
    batteryId,
    title: title.trim().substring(0, 100) || 'Battery Discussion',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  }

  try {
    const db = await getDB()
    await db.collection('conversations').insertOne(conversation)
    return conversation
  } catch (error) {
    console.error('[conversations] Failed to create conversation:', error.message)
    throw error
  }
}

/**
 * Get a specific conversation and its messages.
 * Requires explicit userId - no guest fallback.
 */
export async function getConversation(conversationId, userId) {
  if (!userId) return null

  try {
    const db = await getDB()
    const conv = await db.collection('conversations').findOne({ conversationId })
    if (!conv) return null

    if (conv.userId !== userId) {
      // Ownership check mismatch
      return null
    }

    const messages = await db
      .collection('chat_messages')
      .find({ conversationId })
      .sort({ timestamp: 1 })
      .toArray()

    const { _id, ...convRest } = conv
    return {
      ...convRest,
      messages: messages.map((m) => ({
        messageId: m.messageId,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    }
  } catch (error) {
    console.warn('[conversations] Error getting conversation:', error.message)
    return null
  }
}

/**
 * Append a message to a conversation.
 * Requires explicit userId - no guest fallback.
 */
export async function appendMessage(conversationId, userId, role, content) {
  if (!userId) {
    throw new Error('userId is required to append message')
  }
  const now = new Date().toISOString()
  const messageId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`

  const messageDoc = {
    messageId,
    conversationId,
    userId,
    role: role === 'assistant' ? 'assistant' : role === 'system' ? 'system' : 'user',
    content: String(content || '').substring(0, 4000),
    timestamp: now,
  }

  try {
    const db = await getDB()
    await db.collection('chat_messages').insertOne(messageDoc)

    // Update parent conversation
    const updates = { updatedAt: now }
    if (role === 'user') {
      // Auto-title conversation on first user message if default
      const conv = await db.collection('conversations').findOne({ conversationId })
      if (conv && (conv.title === 'New Discussion' || conv.title === 'Battery Discussion')) {
        updates.title = content.substring(0, 45) + (content.length > 45 ? '...' : '')
      }
    }

    await db.collection('conversations').updateOne(
      { conversationId },
      {
        $set: updates,
        $inc: { messageCount: 1 },
      }
    )

    return messageDoc
  } catch (error) {
    console.error('[conversations] Failed to append message:', error.message)
    throw error
  }
}

/**
 * Delete a conversation and all its messages.
 * Requires explicit userId - no guest fallback.
 */
export async function deleteConversation(conversationId, userId) {
  if (!userId) return false

  try {
    const db = await getDB()
    const conv = await db.collection('conversations').findOne({ conversationId })
    if (!conv) return false

    if (conv.userId !== userId) {
      return false
    }

    await db.collection('conversations').deleteOne({ conversationId })
    await db.collection('chat_messages').deleteMany({ conversationId })
    return true
  } catch (error) {
    console.error('[conversations] Failed to delete conversation:', error.message)
    return false
  }
}