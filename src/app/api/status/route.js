import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const batteryId = searchParams.get('batteryId') || 'BAT001'
  const result = {
    ts: Date.now(),
    mongodb: { configured: !!process.env.MONGODB_URI, connected: false, error: null },
    gemini: { configured: !!process.env.GEMINI_API_KEY, active: !!process.env.GEMINI_API_KEY },
    esp32: { connected: false, lastSeen: null, ageSeconds: null, hasData: false },
  }

  try {
    const db = await getDB()
    result.mongodb.connected = true

    const latest = await db
      .collection('live_data')
      .findOne({ batteryId })
    if (latest && latest.timestamp) {
      result.esp32.hasData = true
      result.esp32.lastSeen = latest.timestamp
      result.esp32.ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / 1000))
      result.esp32.connected = result.esp32.ageSeconds < 30
    }
  } catch (err) {
    result.mongodb.connected = false
    result.mongodb.error = err.message
  }

  return NextResponse.json(result)
}
