import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../../lib/errors'
import { getActiveDeployment } from '../../../../lib/profileStore'
import { estimateSOCVoltage, PACK } from '../../../../lib/batteryAnalytics'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_soc_${ip}`, 30, 60000)
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
        console.warn('MongoDB battery/soc fallback failed:', e.message)
      }
    }

    if (!latest) throw new TelemetryNotFoundError(batteryId, 'latest')

    const b = latest?.battery || latest || {}
    const voltage = b.voltage != null ? Number(b.voltage) : null
    const current = b.current != null ? Number(b.current) : null

    // Load active profile for OCV bounds and capacity. Falls back to
    // safe generic defaults when no profile is deployed.
    const deployment = await getActiveDeployment(batteryId)
    const profile = deployment?.profile
    const pv = profile?.voltage
    const ocvLow = pv?.minOperating ?? PACK.vEmpty
    const ocvHigh = pv?.maxAllowed ?? PACK.vFull
    const reportedSoc = b.soc != null ? Number(b.soc) : null
    const ocvEstimate = estimateSOCVoltage(voltage, { vEmpty: ocvLow, vFull: ocvHigh })
    const finalSoc = reportedSoc != null ? reportedSoc : ocvEstimate

    const nominalCapacityAh = profile?.capacityAh ?? PACK.nominalAh
    const remainingCapacityAh = finalSoc != null && nominalCapacityAh != null
      ? Number(((finalSoc / 100) * nominalCapacityAh).toFixed(2))
      : null

    let runtimeMinutes = null
    if (current != null && finalSoc != null && Math.abs(current) > 0.05 && nominalCapacityAh != null) {
      if (current < 0) {
        runtimeMinutes = Math.round((remainingCapacityAh / Math.abs(current)) * 60)
      } else {
        const missingAh = ((100 - finalSoc) / 100) * nominalCapacityAh
        runtimeMinutes = Math.round((missingAh / current) * 60)
      }
    }

    const series = profile?.series || 1
    const cellVoltagesEstimate =
      voltage != null && series > 0
        ? Array.from({ length: series }, () => Number((voltage / series).toFixed(2)))
        : null

    return NextResponse.json({
      batteryId,
      soc: finalSoc,
      socSource: reportedSoc != null ? 'reported' : ocvEstimate != null ? 'ocv_estimate' : null,
      voltage,
      current,
      nominalCapacityAh,
      remainingCapacityAh,
      chemistry: profile?.chemistry ? `${profile.chemistry}_${series}S` : null,
      cellVoltagesEstimate,
      chargingState: current == null ? null : current > 0.05 ? 'CHARGING' : current < -0.05 ? 'DISCHARGING' : 'IDLE',
      estimatedRuntimeMinutes: runtimeMinutes,
      timestamp: latest?.timestamp ?? latest?.ts ?? Date.now(),
    })
  } catch (error) {
    return handleError(error, request)
  }
}