import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_latest_${ip}`, 60, 60000)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    let latest = await getLatestTelemetry(batteryId)

    if (!latest) {
      try {
        const db = await getDB()
        latest = await db.collection('live_data').findOne({ batteryId })
      } catch (e) {
        console.warn('MongoDB battery/latest fallback failed:', e.message)
      }
    }

    if (!latest) throw new TelemetryNotFoundError(batteryId, 'latest')

    const raw = latest?.battery || latest || {}
    const voltage = raw.voltage != null ? Number(raw.voltage) : null
    const current = raw.current != null ? Number(raw.current) : null
    const shuntVoltage = raw.shuntVoltage != null ? Number(raw.shuntVoltage) : null
    const power =
      raw.power != null
        ? Number(raw.power)
        : voltage != null && current != null
        ? voltage * Math.abs(current)
        : null

    const direction = current == null ? null : current > 0.05 ? 'CHARGING' : current < -0.05 ? 'DISCHARGING' : 'IDLE'

    return NextResponse.json({
      batteryId,
      timestamp: latest?.timestamp ?? latest?.ts ?? Date.now(),
      voltage,
      shuntVoltage,
      loadVoltage: voltage != null && shuntVoltage != null ? voltage + shuntVoltage : null,
      current,
      power,
      soc: raw.soc != null ? Number(raw.soc) : null,
      soh: raw.soh != null ? Number(raw.soh) : null,
      bhi: raw.bhi != null ? Number(raw.bhi) : null,
      safety: raw.safety || null,
      direction,
    })
  } catch (error) {
    return handleError(error, request)
  }
}