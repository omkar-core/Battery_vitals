import 'server-only'
import { getDB } from './mongodb'
import { GUEST_USER_ID, DEMO_BATTERY_ID } from './batteryRegistry'

/**
 * Save a newly generated AI health report.
 */
export async function saveReport(reportData) {
  const reportId = reportData.reportId || `rep_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
  const now = new Date().toISOString()

  const doc = {
    reportId,
    userId: reportData.userId || GUEST_USER_ID,
    batteryId: reportData.batteryId || DEMO_BATTERY_ID,
    title: reportData.title || `Battery Report — ${new Date().toLocaleDateString()}`,
    period: reportData.period || 'weekly',
    summary: reportData.summary || '',
    content: reportData.content || {},
    telemetryFingerprint: reportData.telemetryFingerprint || '',
    generatedAt: reportData.generatedAt || now,
    createdAt: now,
  }

  try {
    const db = await getDB()
    await db.collection('ai_reports').insertOne(doc)
    const { _id, ...rest } = doc
    return rest
  } catch (error) {
    console.error('[reports] Failed to save report:', error.message)
    throw error
  }
}

/**
 * Get saved reports for a user and battery.
 */
export async function getUserReports(userId, batteryId = null) {
  const effectiveUser = userId || GUEST_USER_ID

  try {
    const db = await getDB()
    const query = { userId: effectiveUser }
    if (batteryId) {
      query.batteryId = batteryId
    }

    const reports = await db
      .collection('ai_reports')
      .find(query)
      .sort({ generatedAt: -1 })
      .toArray()

    return reports.map((r) => {
      const { _id, ...rest } = r
      return rest
    })
  } catch (error) {
    console.warn('[reports] Error loading reports:', error.message)
    return []
  }
}

/**
 * Fetch a single report by reportId.
 */
export async function getReportById(reportId, userId) {
  const effectiveUser = userId || GUEST_USER_ID

  try {
    const db = await getDB()
    const report = await db.collection('ai_reports').findOne({ reportId })
    if (!report) return null

    if (report.userId !== effectiveUser && report.userId !== GUEST_USER_ID && effectiveUser !== GUEST_USER_ID) {
      return null
    }

    const { _id, ...rest } = report
    return rest
  } catch (error) {
    console.warn('[reports] Error fetching report by ID:', error.message)
    return null
  }
}

/**
 * Delete a report by ID.
 */
export async function deleteReport(reportId, userId) {
  const effectiveUser = userId || GUEST_USER_ID

  try {
    const db = await getDB()
    const report = await db.collection('ai_reports').findOne({ reportId })
    if (!report) return false

    if (report.userId !== effectiveUser && effectiveUser !== GUEST_USER_ID) {
      return false
    }

    await db.collection('ai_reports').deleteOne({ reportId })
    return true
  } catch (error) {
    console.error('[reports] Error deleting report:', error.message)
    return false
  }
}
