import 'server-only'
import { getDB } from './mongodb'

export const DEFAULT_USER_PREFERENCES = {
  aiModel: 'gemini-1.5-flash',
  explanationDetail: 'detailed', // 'concise' | 'detailed' | 'technical'
  reportFrequency: 'weekly', // 'daily' | 'weekly' | 'monthly'
  notificationPrefs: {
    warnings: true,
    critical: true,
    anomalies: true,
    reports: true,
    offline: true,
  },
  units: {
    temperature: 'C', // 'C' | 'F'
    energy: 'Wh', // 'Wh' | 'kWh'
  },
}

/**
 * Get stored preferences & state for a user.
 * Requires explicit userId - no guest fallback.
 */
export async function getUserHistoryState(userId) {
  if (!userId) {
    return null
  }

  try {
    const db = await getDB()
    const doc = await db.collection('user_history').findOne({ userId })
    if (!doc) {
      return {
        userId,
        selectedBatteryId: null,
        lastActiveAt: new Date().toISOString(),
        preferences: DEFAULT_USER_PREFERENCES,
        viewedAlertsCount: 0,
        viewedDiagnosticsCount: 0,
      }
    }

    const { _id, ...rest } = doc
    return {
      ...rest,
      preferences: { ...DEFAULT_USER_PREFERENCES, ...(rest.preferences || {}) },
    }
  } catch (error) {
    console.error('[userHistory] Error fetching user history state:', error.message)
    return {
      userId,
      selectedBatteryId: null,
      lastActiveAt: new Date().toISOString(),
      preferences: DEFAULT_USER_PREFERENCES,
    }
  }
}

/**
 * Update user active battery or preferences.
 * Requires explicit userId - no guest fallback.
 */
export async function updateUserHistoryState(userId, updatePayload) {
  if (!userId) return null

  const now = new Date().toISOString()
  try {
    const db = await getDB()
    await db.collection('user_history').updateOne(
      { userId },
      {
        $set: {
          ...updatePayload,
          lastActiveAt: now,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    )
    return await getUserHistoryState(userId)
  } catch (error) {
    console.error('[userHistory] Failed to update user history state:', error.message)
    throw error
  }
}

/**
 * Record a user viewing an alert or diagnostic event.
 * Requires explicit userId - no guest fallback.
 */
export async function recordUserActivity(userId, activityType, details = {}) {
  if (!userId) return

  try {
    const db = await getDB()
    const now = new Date().toISOString()
    await db.collection('user_activity_logs').insertOne({
      userId,
      activityType,
      details,
      timestamp: now,
    })

    const fieldToIncrement =
      activityType === 'VIEW_ALERT'
        ? 'viewedAlertsCount'
        : activityType === 'VIEW_DIAGNOSTIC'
        ? 'viewedDiagnosticsCount'
        : null

    if (fieldToIncrement) {
      await db.collection('user_history').updateOne(
        { userId },
        {
          $inc: { [fieldToIncrement]: 1 },
          $set: { lastActiveAt: now },
        },
        { upsert: true }
      )
    }
  } catch (error) {
    console.error('[userHistory] Failed to record user activity:', error.message)
  }
}