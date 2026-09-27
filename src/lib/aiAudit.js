import 'server-only'
import { getDB } from './mongodb'

/**
 * Log an AI request invocation to MongoDB `aiAuditLogs` collection.
 * Requires userId and batteryId - no guest/demo fallback.
 */
export async function logAIAuditRecord(record) {
  if (!record.userId) {
    throw new Error('userId is required for AI audit log')
  }
  if (!record.batteryId) {
    throw new Error('batteryId is required for AI audit log')
  }

  const auditEntry = {
    userId: record.userId,
    batteryId: record.batteryId,
    endpoint: record.endpoint || '/api/ai/generic',
    conversationId: record.conversationId || null,
    model: record.model || 'gemini-1.5-flash',
    provider: record.provider || 'Gemini',
    fallbackUsed: Boolean(record.fallbackUsed),
    responseTimeMs: record.responseTimeMs || 0,
    tokenUsage: record.tokenUsage || { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
    deterministicSafetyState: record.deterministicSafetyState || 'SAFE',
    aiSeverity: record.aiSeverity || 'NONE',
    finalSeverity: record.finalSeverity || 'SAFE',
    cacheHit: Boolean(record.cacheHit),
    errorStatus: record.errorStatus || null,
    timestamp: new Date().toISOString(),
  }

  try {
    const db = await getDB()
    await db.collection('aiAuditLogs').insertOne(auditEntry)
    return auditEntry
  } catch (error) {
    console.error('[aiAudit] Failed to record AI audit log:', error.message)
    return auditEntry
  }
}

/**
 * Fetch AI audit logs filtered by userId and optional batteryId.
 * Requires explicit userId - no guest fallback.
 */
export async function getAIAuditLogs(userId, batteryId = null, limit = 50) {
  if (!userId) return []

  try {
    const db = await getDB()
    const query = { userId }
    if (batteryId) query.batteryId = batteryId

    const logs = await db
      .collection('aiAuditLogs')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    return logs.map((l) => {
      const { _id, ...rest } = l
      return rest
    })
  } catch (error) {
    console.error('[aiAudit] Failed to fetch AI audit logs:', error.message)
    return []
  }
}