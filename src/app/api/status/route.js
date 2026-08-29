import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'

export async function GET(request) {
  const ip = getClientIp(request)
  const rateCheck = checkRateLimit(`status_get_${ip}`, 60, 60000)
  if (!rateCheck.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
  const result = {
    ts: Date.now(),
    firebase: { configured: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, connected: true, url: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL },
    mongodb: { configured: !!process.env.MONGODB_URI, connected: false, error: null },
    gemini: { configured: !!process.env.GEMINI_API_KEY, active: !!process.env.GEMINI_API_KEY },
    esp32: { connected: false, lastSeen: null, ageSeconds: null, hasData: false },
  }

  try {
    const db = await getDB()
    result.mongodb.connected = true

    // Fetch telemetry from Firebase Realtime Database first
    let latest = await getLatestTelemetry(batteryId)

    if (!latest) {
      latest = await db.collection('live_data').findOne({ batteryId })
    }

    if (latest && (latest.timestamp || latest.receivedAt)) {
      const ts = latest.timestamp ? new Date(latest.timestamp).getTime() : new Date(latest.receivedAt).getTime()
      result.esp32.hasData = true
      result.esp32.lastSeen = ts
      result.esp32.ageSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
      result.esp32.connected = result.esp32.ageSeconds < 30
    }
  } catch (err) {
    result.mongodb.connected = false
    result.mongodb.error = 'Database connection error'
  }

  return NextResponse.json(result)
}
