// Server-only helpers for the Battery Intelligence Engine: MongoDB index
// management and assembling the context window (latest telemetry, history
// window, recent alerts) fed to Gemini.

import { getDB } from './mongodb'
import { getLatestTelemetry } from './firebaseAdmin'

let indexesEnsured = false

export const DIAGNOSTICS_COLLECTION = 'ai_diagnostics'
export const CHAT_COLLECTION = 'ai_chat'

export async function ensureAiIndexes() {
  if (indexesEnsured) return
  try {
    const db = await getDB()
    await db.collection(DIAGNOSTICS_COLLECTION).createIndex({ batteryId: 1, createdAt: -1 })
    await db.collection(CHAT_COLLECTION).createIndex({ batteryId: 1, createdAt: 1 })
    indexesEnsured = true
  } catch (e) {
    console.warn('[BatteryAI] index ensure failed:', e.message)
  }
}

// Load the real, validated context for a battery: latest telemetry (Firebase
// first, MongoDB fallback), a capped recent history window, and recent alerts.
export async function loadAiContext(batteryId, { historyLimit = 60, historyMinutes = 1440, alertsLimit = 10 } = {}) {
  let latest = null
  try {
    latest = await getLatestTelemetry(batteryId)
  } catch (e) {
    console.warn('[BatteryAI] Firebase telemetry read failed:', e.message)
  }

  let history = []
  let alerts = []
  let db = null

  if (!latest) {
    try {
      db = db || (await getDB())
      latest = await db.collection('live_data').findOne({ batteryId })
    } catch (e) {
      console.warn('[BatteryAI] MongoDB live_data fallback failed:', e.message)
    }
  }

  try {
    db = db || (await getDB())
    const since = new Date(Date.now() - historyMinutes * 60 * 1000)
    history = await db
      .collection('readings')
      .find({ batteryId, timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .limit(historyLimit)
      .toArray()
    alerts = await db
      .collection('alerts')
      .find({ batteryId })
      .sort({ timestamp: -1 })
      .limit(alertsLimit)
      .toArray()
  } catch (e) {
    console.warn('[BatteryAI] MongoDB context query failed:', e.message)
  }

  return { latest, history, alerts }
}