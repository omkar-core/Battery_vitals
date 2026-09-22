import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_sessions_${ip}`, 60, 60000)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    let events = []
    try {
      const db = await getDB()
      if (db) {
        events = await db
          .collection('connection_events')
          .find({ batteryId })
          .sort({ timestamp: -1 })
          .limit(100)
          .toArray()
      }
    } catch (e) {
      console.warn('MongoDB connection_events query failed:', e.message)
    }

    // Group events into session summaries
    const sessionMap = new Map()
    for (const evt of events) {
      const sId = evt.sessionId || 'legacy_session'
      if (!sessionMap.has(sId)) {
        sessionMap.set(sId, {
          sessionId: sId,
          batteryId,
          firstSeen: evt.timestamp,
          lastSeen: evt.timestamp,
          initialVoltage: evt.voltage,
          eventCount: 1,
          lastEventType: evt.eventType,
        })
      } else {
        const s = sessionMap.get(sId)
        s.eventCount += 1
        s.firstSeen = evt.timestamp // earlier timestamp
      }
    }

    const sessions = Array.from(sessionMap.values())

    return NextResponse.json({
      batteryId,
      sessionCount: sessions.length,
      sessions,
      events: events.map((e) => ({
        id: String(e._id),
        sessionId: e.sessionId,
        eventType: e.eventType,
        voltage: e.voltage,
        timestamp: e.timestamp,
      })),
    })
  } catch (error) {
    return handleError(error, request)
  }
}
