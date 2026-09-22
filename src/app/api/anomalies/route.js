import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { getDB } from '../../../lib/mongodb'
import { validateTelemetry, computeSafety } from '../../../lib/batterySafety'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { handleError } from '../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../lib/errors'
import { loadEngineConfigForDevice } from '../../../lib/safetyConfig'
import { getActiveDeployment } from '../../../lib/profileStore'

export const dynamic = 'force-dynamic'

// Anomalies are derived from the deterministic safety engine only. No sensor
// values, ranges, or severities are invented when telemetry is absent.
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`anomalies_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
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
        console.warn('MongoDB anomalies fallback failed:', e.message)
      }
    }
    if (!latest) throw new TelemetryNotFoundError(batteryId, 'latest')

    const { clean } = validateTelemetry(latest)
    const engineCfg = await loadEngineConfigForDevice(batteryId)
    const safety = computeSafety(clean, engineCfg)
    const deployment = await getActiveDeployment(batteryId)
    const pv = deployment?.profile?.voltage
    const voltageRange = pv
      ? `${pv.minOperating}V – ${pv.maxAllowed}V`
      : `${engineCfg.voltage?.critLow ?? '?'}V – ${engineCfg.voltage?.critHigh ?? '?'}V`
    const now = Date.now()

    const severityMap = {
      EMERGENCY: 'CRITICAL',
      CRITICAL: 'CRITICAL',
      WARNING: 'HIGH',
      CAUTION: 'MEDIUM',
    }

    const anomalies = safety.violations.map((v) => ({
      id: `anom_${v.rule.code}_${now}`,
      parameter: v.rule.field,
      type: v.rule.code.toUpperCase(),
      severity: severityMap[v.state] || 'MEDIUM',
      detectedValue: v.rule.value,
      expectedRange: v.rule.field === 'voltage' ? voltageRange : null,
      confidence: 0.9,
      description: v.rule.message,
      timestamp: new Date(now).toISOString(),
      code: v.rule.code,
    }))

    return NextResponse.json({
      batteryId,
      count: anomalies.length,
      anomalies,
      systemHealthState: anomalies.length === 0
        ? 'NORMAL'
        : anomalies.some((a) => a.severity === 'CRITICAL')
          ? 'HAZARDOUS'
          : 'ATTENTION_REQUIRED',
      checkedAt: new Date(now).toISOString(),
    })
  } catch (error) {
    return handleError(error, request)
  }
}