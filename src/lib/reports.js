import 'server-only'
import { getDB } from './mongodb'

/**
 * Save a newly generated AI health report.
 * Requires explicit userId and batteryId - no guest/demo fallback.
 */
export async function saveReport(reportData) {
  if (!reportData.userId) {
    throw new Error('userId is required to save report')
  }
  if (!reportData.batteryId) {
    throw new Error('batteryId is required to save report')
  }

  const reportId = reportData.reportId || `rep_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
  const now = new Date().toISOString()

  const doc = {
    reportId,
    userId: reportData.userId,
    batteryId: reportData.batteryId,
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
 * Requires explicit userId - no guest fallback.
 */
export async function getUserReports(userId, batteryId = null) {
  if (!userId) return []

  try {
    const db = await getDB()
    const query = { userId }
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
    console.error('[reports] Error loading reports:', error.message)
    return []
  }
}

/**
 * Fetch a single report by reportId.
 * Requires explicit userId - no guest fallback.
 */
export async function getReportById(reportId, userId) {
  if (!userId) return null

  try {
    const db = await getDB()
    const report = await db.collection('ai_reports').findOne({ reportId })
    if (!report) return null

    if (report.userId !== userId) {
      return null
    }

    const { _id, ...rest } = report
    return rest
  } catch (error) {
    console.error('[reports] Error fetching report by ID:', error.message)
    return null
  }
}

/**
 * Delete a report by ID.
 * Requires explicit userId - no guest fallback.
 */
export async function deleteReport(reportId, userId) {
  if (!userId) return false

  try {
    const db = await getDB()
    const report = await db.collection('ai_reports').findOne({ reportId })
    if (!report) return false

    if (report.userId !== userId) {
      return false
    }

    await db.collection('ai_reports').deleteOne({ reportId })
    return true
  } catch (error) {
    console.error('[reports] Error deleting report:', error.message)
    return false
  }
}