import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { secureErrorResponse } from '../../../lib/security'

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

    const db = await getDB()
    const now = new Date()

    const doc = {
      ...latestFirebaseData,
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

    // 3. Insert into sensor_history if telemetry valid
    if (latestFirebaseData.voltage != null || latestFirebaseData.temperature != null) {
      await db.collection('sensor_history').insertOne({
        batteryId,
        voltage: latestFirebaseData.voltage,
        current: latestFirebaseData.current,
        temperature: latestFirebaseData.temperature,
        humidity: latestFirebaseData.humidity,
        soc: latestFirebaseData.soc,
        bhi: latestFirebaseData.bhi,
        timestamp: now,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Firebase telemetry successfully synced to MongoDB',
      batteryId,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('sync-to-mongo error:', error)
    return secureErrorResponse(error.message)
  }
}

export { GET as POST }
