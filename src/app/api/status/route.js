import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { handleError } from '../../../lib/errorHandler'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`status_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const firebaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    const result = {
      ts: Date.now(),
      firebase: { configured: !!firebaseUrl, connected: false, error: null },
      mongodb: { configured: !!process.env.MONGODB_URI, connected: false, error: null },
      gemini: { configured: !!process.env.GEMINI_API_KEY, active: !!process.env.GEMINI_API_KEY },
      esp32: { connected: false, lastSeen: null, ageSeconds: null, hasData: false },
    }

    let latest = null
    try {
      latest = await getLatestTelemetry(batteryId)
      // A successful Realtime Database read proves the client SDK can reach it.
      result.firebase.connected = !!(latest || firebaseUrl)
    } catch (err) {
      result.firebase.connected = false
      result.firebase.error = 'Realtime Database read failed'
    }

    try {
      const db = await getDB()
      result.mongodb.connected = true
      if (!latest) {
        latest = await db.collection('live_data').findOne({ batteryId })
      }
    } catch (err) {
      result.mongodb.connected = false
      result.mongodb.error = 'Database connection error'
    }

    if (latest && (latest.timestamp || latest.receivedAt || latest.ts)) {
      const raw = latest.timestamp ?? latest.receivedAt ?? latest.ts
      const ts = new Date(raw).getTime()
      if (Number.isFinite(ts)) {
        result.esp32.hasData = true
        result.esp32.lastSeen = ts
        result.esp32.lastSeenIso = new Date(ts).toISOString()
        result.esp32.ageSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000))
        // Telemetry cadence is 1.5s; gap > 2× cadence (4s) indicates offline
        result.esp32.online = result.esp32.ageSeconds <= 4
        result.esp32.status = result.esp32.ageSeconds <= 4 ? 'ONLINE' : 'OFFLINE'
        result.esp32.connected = result.esp32.ageSeconds < 30
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    return handleError(error, request)
  }
}