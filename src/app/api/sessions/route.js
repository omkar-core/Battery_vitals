import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    let sessions = []

    try {
      const db = await getDB()
      // First check stored sessions collection
      sessions = await db
        .collection('sessions')
        .find({ batteryId })
        .sort({ startTime: -1 })
        .limit(limit)
        .toArray()

      // If no stored sessions yet, derive sessions strictly from real readings
      if (!sessions || sessions.length === 0) {
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
    console.error('sessions route error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
        sessions.push(finalizeSession(currentSession, r.timestamp))
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
      sessions.push(finalizeSession(currentSession, r.timestamp))
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
    sessions.push(finalizeSession(currentSession, Date.now()))
  }

  return sessions.reverse()
}

function finalizeSession(session, endTime) {
  const rs = session.readings
  const startT = new Date(session.startTime).getTime()
  const endT = new Date(endTime).getTime()
  const durationSec = Math.max(10, Math.floor((endT - startT) / 1000))

  let peakTemp = rs[0]?.temperature ?? null
  let totalCurrent = 0
  let totalBhi = 0
  let energyWh = 0

  for (const r of rs) {
    if (r.temperature != null && (peakTemp == null || r.temperature > peakTemp)) {
      peakTemp = r.temperature
    }
    totalCurrent += Math.abs(r.current || 0)
    if (r.bhi != null) totalBhi += r.bhi
    const p = (r.voltage || 0) * Math.abs(r.current || 0)
    energyWh += (p * (2 / 3600))
  }

  const lastReading = rs[rs.length - 1]
  const bhis = rs.map((r) => r.bhi).filter((v) => v != null)
  return {
    id: `sess_${startT}`,
    batteryId: session.batteryId,
    sessionType: session.sessionType,
    startTime: session.startTime,
    endTime,
    duration: durationSec,
    energyMoved: Number(energyWh.toFixed(2)),
    peakTemperature: peakTemp != null ? Number(peakTemp.toFixed(1)) : null,
    avgCurrent: Number((totalCurrent / rs.length).toFixed(2)),
    maxBHI: bhis.length ? Math.round(Math.max(...bhis)) : null,
    startSOC: session.startSOC != null ? Math.round(session.startSOC) : null,
    endSOC: lastReading?.soc != null ? Math.round(lastReading.soc) : null,
    // True round-trip efficiency cannot be measured from a single
    // unidirectional session, so report nothing instead of a fabricated value.
    efficiency: null,
  }
}
