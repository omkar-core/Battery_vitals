import 'server-only'
import { getDb } from './mongodb'

// Layer 21: Security Audit Log
// Immutable audit record for profile and threshold alterations: who changed what, when, old->new.

export async function recordAuditLog({ entityType, entityId, action, actor = 'system', changes = {} }) {
  try {
    const entry = {
      entityType, // 'PROFILE', 'THRESHOLD', 'COMMAND', 'ALERT'
      entityId: String(entityId),
      action: String(action),
      actor: String(actor),
      changes,
      timestamp: new Date().toISOString(),
    }

    const db = await getDb()
    if (db) {
      const col = db.collection('audit_log')
      await col.insertOne(entry)
    }
    return entry
  } catch (err) {
    console.warn('[AuditLog] Failed to persist audit entry:', err.message)
    return null
  }
}
