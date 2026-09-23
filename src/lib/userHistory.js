import 'server-only'
import { getDB } from './mongodb'
import { GUEST_USER_ID, DEMO_BATTERY_ID } from './batteryRegistry'

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
  defaultBatteryId: DEMO_BATTERY_ID,
  units: {
    temperature: 'C', // 'C' | 'F'
    energy: 'Wh', // 'Wh' | 'kWh'
  },
}

/**
 * Get stored preferences & state for a user.
 */
export async function getUserHistoryState(userId) {
  if (!userId || userId === GUEST_USER_ID) {
    return {
      userId: GUEST_USER_ID,
      selectedBatteryId: DEMO_BATTERY_ID,
      lastActiveAt: new Date().toISOString(),
      preferences: DEFAULT_USER_PREFERENCES,
      viewedAlertsCount: 0,
      viewedDiagnosticsCount: 0,
    }
  }

  try {
    const db = await getDB()
    const doc = await db.collection('user_history').findOne({ userId })
    if (!doc) {
      return {
        userId,
        selectedBatteryId: DEMO_BATTERY_ID,
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
    console.warn('[userHistory] Error fetching user history state:', error.message)
    return {
      userId,
      selectedBatteryId: DEMO_BATTERY_ID,
      lastActiveAt: new Date().toISOString(),
      preferences: DEFAULT_USER_PREFERENCES,
    }
  }
}

/**
 * Update user active battery or preferences.
 */
export async function updateUserHistoryState(userId, updatePayload) {
  if (!userId || userId === GUEST_USER_ID) return null

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
 */
export async function recordUserActivity(userId, activityType, details = {}) {
  if (!userId || userId === GUEST_USER_ID) return

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
    console.warn('[userHistory] Failed to record user activity:', error.message)
  }
}
