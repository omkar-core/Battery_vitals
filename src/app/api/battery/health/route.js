import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../../lib/errors'
import { validateTelemetry, computeSafety } from '../../../../lib/batterySafety'
import { fuseHazardIndex } from '../../../../lib/batteryAnalytics'
import { loadEngineConfigForDevice } from '../../../../lib/safetyConfig'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_health_${ip}`, 30, 60000)
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
        console.warn('MongoDB battery/health fallback failed:', e.message)
      }
    }

    if (!latest) throw new TelemetryNotFoundError(batteryId, 'latest')

    const b = latest?.battery || latest || {}
    const temp = latest?.environment?.temperature ?? latest?.environmental?.temperature ?? latest?.temperature ?? null
    const voltage = b.voltage != null ? Number(b.voltage) : null
    const current = b.current != null ? Number(b.current) : null
    const power = b.power != null ? Number(b.power) : null
    const soh = b.soh != null ? Number(b.soh) : null
    const sohValid = b.soh_valid === true || (b.soh_valid !== false && b.resistance != null && Number(b.resistance) > 0)
    const bhi = b.bhi ?? latest?.risk?.bhi ?? null
    const mq2 = latest?.gas?.index_mq2 ?? latest?.gasIndex?.mq2 ?? null
    const mq135 = latest?.gas?.index_mq135 ?? latest?.gasIndex?.mq135 ?? null

    const cycleCount = b.cycles != null ? Number(b.cycles) : null
    const energyWh = b.energyWh != null ? Number(b.energyWh) : null
    const internalResistance_mOhm = b.resistance != null ? Number(b.resistance) : null

    // Thermal stress is derived from the actual reported temperature only.
    const thermalStressFactor = temp == null ? null : temp > 45 ? 'CRITICAL' : temp > 35 ? 'ELEVATED' : 'NOMINAL'

    // Lifespan projection is honestly gated on a measured SOH value.
    const estimatedLifespanMonths = !sohValid || soh == null ? null : Math.max(6, Math.round((soh / 100) * 24))

    // Deterministic safety + fused hazard (same-hardware inputs only).
    const { clean } = validateTelemetry(latest)
    const safety = computeSafety(clean, await loadEngineConfigForDevice(batteryId).catch(() => ({})))
    const fused = fuseHazardIndex({ voltage, current, temperature: temp, mq2, mq135, resistance: internalResistance_mOhm })
    let profileId = latest?.profileId || null
    let profileState = latest?.profileState || null
    try {
      const { getActiveDeployment } = await import('../../../../lib/profileStore')
      const dep = await getActiveDeployment(batteryId)
      profileId = dep?.profileId || profileId
      if (!profileId) profileState = 'UNKNOWN_BATTERY'
    } catch (e) { /* non-critical */ }

    return NextResponse.json({
      batteryId,
      profileId,
      profileState,
      bhi: bhi != null ? Number(bhi) : null,
      soh: sohValid ? soh : null,
      sohValid,
      voltage,
      current,
      power,
      temperature: temp,
      cycleCount,
      energyWh,
      internalResistance_mOhm,
      thermalStressFactor,
      estimatedLifespanMonths,
      // BHI convention: 0 = best, 100 = fail (ESP32_RULES §4).
      healthStatus: bhi == null ? null : bhi <= 15 ? 'EXCELLENT' : bhi <= 30 ? 'GOOD' : bhi <= 50 ? 'FAIR' : 'POOR',
      hazardIndex: fused.index,
      hazardBand: fused.band,
      safetyState: safety.state,
      protectionLevel: safety.level,
      degradationRate: null,
      lastEvaluated: new Date().toISOString(),
    })
  } catch (error) {
    return handleError(error, request)
  }
}