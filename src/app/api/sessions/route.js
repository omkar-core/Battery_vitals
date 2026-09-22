import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { handleError } from '../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`sessions_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const rawLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 200) : 20
    const cappedStored = searchParams.get('capStored') === 'true'

    let sessions = []
    try {
      const db = await getDB()
      if (!cappedStored) {
        sessions = await db
          .collection('sessions')
          .find({ batteryId })
          .sort({ startTime: -1 })
          .limit(limit)
          .toArray()
      }

      if (sessions.length === 0) {
        const readings = await db
          .collection('readings')
          .find({ batteryId })
          .sort({ timestamp: 1 })
          .limit(1000)
          .toArray()

        if (readings.length > 1) {
          sessions = detectSessions(readings)
        }
      }
    } catch (dbErr) {
      console.warn('DB session fetch error:', dbErr.message)
    }

    return NextResponse.json({
      success: true,
      count: sessions.length,
      sessions: sessions.map((s) => ({
        ...s,
        id: s._id ? String(s._id) : s.id,
      })),
    })
  } catch (error) {
    return handleError(error, request)
  }
}

function detectSessions(readings) {
  const sessions = []
  let currentSession = null

  for (let i = 0; i < readings.length; i++) {
    const r = readings[i]
    const current = r.current || 0
    const type = current > 0.1 ? 'charge' : current < -0.1 ? 'discharge' : 'idle'

    if (type === 'idle') {
      if (currentSession) {
        const finalized = finalizeSession(currentSession, r.timestamp)
        if (finalized) sessions.push(finalized)
        currentSession = null
      }
      continue
    }

    if (!currentSession) {
      currentSession = {
        batteryId: r.batteryId || 'BAT001',
        sessionType: type,
        startTime: r.timestamp,
        startSOC: r.soc != null ? r.soc : null,
        readings: [r],
      }
    } else if (currentSession.sessionType !== type) {
      const finalized = finalizeSession(currentSession, r.timestamp)
      if (finalized) sessions.push(finalized)
      currentSession = {
        batteryId: r.batteryId || 'BAT001',
        sessionType: type,
        startTime: r.timestamp,
        startSOC: r.soc != null ? r.soc : null,
        readings: [r],
      }
    } else {
      currentSession.readings.push(r)
    }
  }

  if (currentSession && currentSession.readings.length > 2) {
    const finalized = finalizeSession(currentSession, Date.now())
    if (finalized) sessions.push(finalized)
  }

  return sessions.reverse()
}

function finalizeSession(session, endTime) {
  const rs = session.readings
  const startT = new Date(session.startTime).getTime()
  const endT = new Date(endTime).getTime()
  if (!Number.isFinite(startT) || !Number.isFinite(endT)) return null
  const durationSec = Math.max(10, Math.floor((endT - startT) / 1000))

  const filtered = rs.filter((r) => r && r.timestamp != null)
  if (filtered.length === 0) return null

  let peakTemp = null
  let totalCurrent = 0
  let totalBhi = 0
  let energyWh = 0
  // ESP32 samples roughly every 2s; timeseries spacing is restored from the
  // actual timestamps when available.
  const dtSec = (a, b) => {
    const da = new Date(a.timestamp).getTime()
    const db = new Date(b.timestamp).getTime()
    if (!Number.isFinite(da) || !Number.isFinite(db)) return 2
    return Math.max(1, Math.min(60, (db - da) / 1000))
  }

  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i]
    if (r.temperature != null && (peakTemp == null || r.temperature > peakTemp)) {
      peakTemp = r.temperature
    }
    totalCurrent += Math.abs(r.current || 0)
    if (r.bhi != null) totalBhi += r.bhi
    const p = (r.voltage || 0) * Math.abs(r.current || 0)
    const dt = i > 0 ? dtSec(filtered[i - 1], r) : 2
    energyWh += (p * dt) / 3600
  }

  const lastReading = filtered[filtered.length - 1]
  const bhis = filtered.map((r) => r.bhi).filter((v) => v != null)
  return {
    id: `sess_${startT}`,
    batteryId: session.batteryId,
    sessionType: session.sessionType,
    startTime: session.startTime,
    endTime,
    duration: durationSec,
    energyMoved: Number(energyWh.toFixed(2)),
    peakTemperature: peakTemp != null ? Number(peakTemp.toFixed(1)) : null,
    avgCurrent: Number((totalCurrent / filtered.length).toFixed(2)),
    maxBHI: bhis.length ? Math.round(Math.max(...bhis)) : null,
    startSOC: session.startSOC != null ? Math.round(session.startSOC) : null,
    endSOC: lastReading.soc != null ? Math.round(lastReading.soc) : null,
    // True round-trip efficiency cannot be measured from a single unidirectional
    // session, so nothing is fabricated here.
    efficiency: null,
  }
}