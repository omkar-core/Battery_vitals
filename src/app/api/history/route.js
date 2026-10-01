import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'

import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { runFirebaseToMongoSync } from '../../../lib/dataSync'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`history_get_${ip}`, 120, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const limitParam = searchParams.get('limit') || '50'
    const minutesParam = searchParams.get('minutes')

    const parsedLimit = Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 5000)
    const parsedMinutes = minutesParam ? Math.min(Math.max(parseInt(minutesParam, 10) || 60, 1), 1440) : null

    let data = []

    const authenticFilter = {
      batteryId,
      deviceId: { $nin: ['ESP32_TEST', 'mock_device', 'test_device', null] },
      isMock: { $ne: true },
      mock: { $ne: true },
      synthetic: { $ne: true },
      source: { $ne: 'mock' },
    }

    try {
      const db = await getDB()
      if (parsedMinutes) {
        const since = new Date(Date.now() - parsedMinutes * 60 * 1000)
        const sinceMs = since.getTime()
        data = await db
          .collection('readings')
          .find({
            ...authenticFilter,
            $or: [
              { timestamp: { $gte: since } },
              { timestamp: { $gte: sinceMs } },
              { receivedAt: { $gte: since.toISOString() } },
            ],
          })
          .sort({ timestamp: 1 })
          .limit(parsedLimit)
          .toArray()
      }

      // If no data found within the time window or minutes wasn't specified, fetch latest N stored readings
      if (!data || data.length === 0) {
        const latestDesc = await db
          .collection('readings')
          .find(authenticFilter)
          .sort({ timestamp: -1, _id: -1 })
          .limit(parsedLimit)
          .toArray()
        data = latestDesc.reverse()
      }

      // If DB has no historical packets yet, check if Firebase RTDB has an authentic ESP32 packet
      if (!data || data.length === 0) {
        try {
          const liveFb = await getLatestTelemetry(batteryId)
          if (liveFb && (liveFb.voltage != null || liveFb.temperature != null) && liveFb.deviceId !== 'ESP32_TEST') {
            await runFirebaseToMongoSync({ batteryId })
            const syncedDesc = await db
              .collection('readings')
              .find(authenticFilter)
              .sort({ timestamp: -1, _id: -1 })
              .limit(parsedLimit)
              .toArray()
            data = syncedDesc.reverse()
          }
        } catch (syncErr) {
          // If Firebase has no data or device offline, data remains empty []
        }
      }
    } catch (dbErr) {
      console.warn('MongoDB history query failed:', dbErr.message)
    }

    const mapped = data.map((d) => {
      const ts = d.timestamp ? (typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp).getTime()) : (d.receivedAt ? new Date(d.receivedAt).getTime() : Date.now())
      return {
        id: String(d._id || Math.random().toString(36).slice(2, 8)),
        time: ts,
        timestamp: ts,
        receivedAt: d.receivedAt || new Date(ts).toISOString(),
        voltage: d.voltage != null ? Number(d.voltage) : null,
        current: d.current != null ? Number(d.current) : null,
        power: d.power != null ? Number(d.power) : (d.voltage != null && d.current != null ? Number((d.voltage * d.current).toFixed(3)) : null),
        soc: d.soc != null ? Number(d.soc) : null,
        soh: d.soh != null ? Number(d.soh) : null,
        temperature: d.temperature != null ? Number(d.temperature) : null,
        humidity: d.humidity != null ? Number(d.humidity) : null,
        mq2: d.gasIndex?.mq2 ?? d.mq2 ?? null,
        mq135: d.gasIndex?.mq135 ?? d.mq135 ?? null,
        gasIndex: {
          mq2: d.gasIndex?.mq2 ?? d.mq2 ?? null,
          mq135: d.gasIndex?.mq135 ?? d.mq135 ?? null,
          warm: d.gasIndex?.warm ?? false,
        },
        bhi: d.bhi != null ? Number(d.bhi) : (d.riskScore != null ? Number(d.riskScore) : null),
        safety: d.safetyState || d.safety || 'SAFE',
        safetyState: d.safetyState || d.safety || 'SAFE',
        opDirection: d.opDirection || '',
        resistance: d.resistance != null ? Number(d.resistance) : null,
        cycles: d.cycles != null ? Number(d.cycles) : null,
        energyWh: d.energyWh != null ? Number(d.energyWh) : null,
        network: d.network || {},
      }
    })

    return NextResponse.json({
      success: true,
      count: mapped.length,
      data: mapped,
    }, { headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('history error:', error)
    return NextResponse.json({ success: true, count: 0, data: [] })
  }
}
