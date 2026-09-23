import 'server-only'
import { getDB } from './mongodb'
import { GUEST_USER_ID, DEMO_BATTERY_ID } from './batteryRegistry'

/**
 * Log an AI request invocation to MongoDB `aiAuditLogs` collection.
 */
export async function logAIAuditRecord(record) {
  const auditEntry = {
    userId: record.userId || GUEST_USER_ID,
    batteryId: record.batteryId || DEMO_BATTERY_ID,
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
    console.warn('[aiAudit] Failed to record AI audit log:', error.message)
    return auditEntry
  }
}

/**
 * Fetch AI audit logs filtered by userId and optional batteryId.
 */
export async function getAIAuditLogs(userId, batteryId = null, limit = 50) {
  const effectiveUser = userId || GUEST_USER_ID

  try {
    const db = await getDB()
    const query = { userId: effectiveUser }
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
    console.warn('[aiAudit] Failed to fetch AI audit logs:', error.message)
    return []
  }
}
