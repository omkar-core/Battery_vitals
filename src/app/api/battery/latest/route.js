import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_latest_${ip}`, 60, 60000)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'

    let latest = await getLatestTelemetry(batteryId)

    if (!latest) {
      try {
        const db = await getDB()
        latest = await db.collection('live_data').findOne({ batteryId })
      } catch (e) {}
    }

    const raw = latest?.battery || latest || {}
    const voltage = raw.voltage != null ? Number(raw.voltage) : 12.6
    const current = raw.current != null ? Number(raw.current) : 0.0
    const shuntVoltage = raw.shuntVoltage != null ? Number(raw.shuntVoltage) : 0.025
    const power = raw.power != null ? Number(raw.power) : (voltage * Math.abs(current))

    const response = {
      batteryId,
      timestamp: latest?.timestamp || Date.now(),
      voltage,
      shuntVoltage,
      loadVoltage: voltage + shuntVoltage,
      current,
      power,
      soc: raw.soc != null ? Number(raw.soc) : 85,
      soh: raw.soh != null ? Number(raw.soh) : 98,
      bhi: raw.bhi != null ? Number(raw.bhi) : 94,
      safety: raw.safety || 'SAFE',
      direction: current > 0.05 ? 'CHARGING' : current < -0.05 ? 'DISCHARGING' : 'IDLE',
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch battery metrics', details: error.message }, { status: 500 })
  }
}
