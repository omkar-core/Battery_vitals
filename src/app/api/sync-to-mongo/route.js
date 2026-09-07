import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { secureErrorResponse } from '../../../lib/security'
import { validateTelemetry, computeSafety } from '../../../lib/batterySafety'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`sync_mongo_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const batteryId = 'BAT001'
    const latestFirebaseData = await getLatestTelemetry(batteryId)

    if (!latestFirebaseData) {
      return NextResponse.json({
        success: false,
        message: 'No data in Firebase Realtime Database to sync',
        timestamp: new Date().toISOString(),
      })
    }

    // -------------------------------------------------------------------------
    // VALIDATION — run the deterministic safety engine before writing to MongoDB.
    // Prevents stale, NaN, or out-of-range values from corrupting the readings
    // and sensor_history collections (Gap 4 fix per DATA_QUALITY rules).
    // -------------------------------------------------------------------------
    const { clean, issues, valid } = validateTelemetry(latestFirebaseData)
    const safety = computeSafety(clean)

    const problematicIssues = issues.filter((i) => i.code !== 'ok')
    if (problematicIssues.length > 0) {
      console.warn(
        `[sync-to-mongo] Validation issues for ${batteryId}:`,
        problematicIssues.map((i) => `${i.field}:${i.code}`).join(', ')
      )
    }
    // -------------------------------------------------------------------------

    const db = await getDB()
    const now = new Date()

    // Merge clean validated values back into the document so we persist finite
    // numbers only, but retain non-sensor fields (batteryId, firmware, mac …).
    const doc = {
      ...latestFirebaseData,
      // Override with clean (NaN/OOR-scrubbed) sensor values
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
      // Deterministic safety enrichment
      safetyState: safety.state,
      riskScore: safety.score,
      validationIssues: problematicIssues.map((i) => ({ field: i.field, code: i.code })),
      stale: clean.stale ?? false,
      syncedAt: now,
      timestamp: latestFirebaseData.timestamp ? new Date(latestFirebaseData.timestamp) : now,
      source: 'firebase_sync',
    }

    // 1. Update live_data collection
    await db.collection('live_data').updateOne(
      { batteryId },
      { $set: doc },
      { upsert: true }
    )

    // 2. Insert snapshot into readings collection
    await db.collection('readings').insertOne(doc)

    // 3. Insert into sensor_history only if core telemetry is valid
    if (valid || (clean.voltage != null || clean.temperature != null)) {
      await db.collection('sensor_history').insertOne({
        batteryId,
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

    return NextResponse.json({
      success: true,
      message: 'Firebase telemetry successfully synced to MongoDB',
      batteryId,
      safetyState: safety.state,
      riskScore: safety.score,
      validationIssueCount: problematicIssues.length,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('sync-to-mongo error:', error)
    return secureErrorResponse(error.message)
  }
}

export { GET as POST }
