import { getDB } from './mongodb'
import { getLatestTelemetry } from './firebaseAdmin'
import { sanitizeString } from './security'
import { validateTelemetry, computeSafety } from './batterySafety'
import { loadEngineConfig, loadEngineConfigForDevice } from './safetyConfig'
import { TelemetryNotFoundError } from './errors'

// Shared Firebase → MongoDB sync used by the manual /api/sync-to-mongo POST and
// the scheduled /api/cron/sync job. Validates frames through the deterministic
// engine before persisting, so NaN/out-of-range values never reach storage.
export async function runFirebaseToMongoSync({ batteryId = 'BAT001' } = {}) {
  const cleanBatteryId = sanitizeString(String(batteryId), 30) || 'BAT001'
  const latestFirebaseData = await getLatestTelemetry(cleanBatteryId)

  if (!latestFirebaseData) {
    throw new TelemetryNotFoundError(cleanBatteryId, 'latest')
  }

  const { clean, issues, valid } = validateTelemetry(latestFirebaseData)
  const safety = computeSafety(clean, await loadEngineConfigForDevice(cleanBatteryId).catch(() => loadEngineConfig()))

  const problematicIssues = issues.filter((i) => i.code !== 'ok')
  if (problematicIssues.length > 0) {
    console.warn(
      `[sync] Validation issues for ${cleanBatteryId}:`,
      problematicIssues.map((i) => `${i.field}:${i.code}`).join(', ')
    )
  }

  const db = await getDB()
  const now = new Date()

  const doc = {
    ...latestFirebaseData,
    voltage: clean.voltage ?? latestFirebaseData.voltage,
    current: clean.current ?? latestFirebaseData.current,
    temperature: clean.temperature ?? latestFirebaseData.temperature,
    humidity: clean.humidity ?? latestFirebaseData.humidity,
    soc: clean.soc ?? latestFirebaseData.soc,
    soh: clean.soh ?? latestFirebaseData.soh,
    bhi: clean.bhi ?? latestFirebaseData.bhi,
    resistance: clean.resistance ?? latestFirebaseData.resistance,
    mq2: clean.mq2 ?? latestFirebaseData.mq2,
    mq135: clean.mq135 ?? latestFirebaseData.mq135,
    safetyState: safety.state,
    riskScore: safety.score,
    validationIssues: problematicIssues.map((i) => ({ field: i.field, code: i.code })),
    stale: clean.stale ?? false,
    syncedAt: now,
    timestamp: latestFirebaseData.timestamp ? new Date(latestFirebaseData.timestamp) : now,
    source: 'firebase_sync',
  }

  await db.collection('live_data').updateOne({ batteryId: cleanBatteryId }, { $set: doc }, { upsert: true })
  await db.collection('readings').insertOne(doc)

  if (valid || (clean.voltage != null || clean.temperature != null)) {
    await db.collection('sensor_history').insertOne({
      batteryId: cleanBatteryId,
      voltage: clean.voltage,
      current: clean.current,
      temperature: clean.temperature,
      humidity: clean.humidity,
      soc: clean.soc,
      bhi: clean.bhi,
      safetyState: safety.state,
      riskScore: safety.score,
      timestamp: now,
    })
  }

  return {
    success: true,
    batteryId: cleanBatteryId,
    safetyState: safety.state,
    riskScore: safety.score,
    validationIssueCount: problematicIssues.length,
    timestamp: now.toISOString(),
  }
}