import 'server-only'
import { getDb } from './mongodb'

// Layer 3: Connection State Machine & Session Tracking
// Generates persistent session IDs when battery voltage crosses from ~0V to detectable level.
// Logs connection/disconnection/removal events into `connection_events` collection.

const inMemorySessions = new Map()

export function generateSessionId(batteryId = 'BAT001') {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 7)
  return `sess_${batteryId}_${ts}_${rand}`
}

export async function logConnectionEvent(batteryId, eventType, voltage = 0) {
  try {
    let currentSession = inMemorySessions.get(batteryId)
    if (!currentSession || eventType === 'CONNECTED') {
      currentSession = generateSessionId(batteryId)
      inMemorySessions.set(batteryId, currentSession)
    }

    const event = {
      batteryId,
      sessionId: currentSession,
      eventType,
      voltage,
      timestamp: new Date().toISOString(),
    }

    const db = await getDb()
    if (db) {
      const col = db.collection('connection_events')
      await col.insertOne(event)
    }
    return event
  } catch (err) {
    console.warn('Failed to log connection event:', err.message)
    return null
  }
}

export function getCurrentSessionId(batteryId = 'BAT001') {
  let sess = inMemorySessions.get(batteryId)
  if (!sess) {
    sess = generateSessionId(batteryId)
    inMemorySessions.set(batteryId, sess)
  }
  return sess
}
