import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { validateTelemetry, computeSafety } from '../../../../lib/batterySafety'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../../lib/errors'
import { loadEngineConfig, loadEngineConfigForDevice } from '../../../../lib/safetyConfig'

export const dynamic = 'force-dynamic'

const SEVERITY_MAP = {
  EMERGENCY: 'CRITICAL',
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  CAUTION: 'WARNING',
}

// The deterministic engine is the sole authority for temperature/gas hazards.
// This endpoint translates engine violations into the alert API shape and adds
// only the humidity condensation check the engine does not model.
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`env_alerts_get_${ip}`, 60, 60000)
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
        console.warn('MongoDB environmental/alerts fallback failed:', e.message)
      }
    }
    if (!latest) throw new TelemetryNotFoundError(batteryId, 'latest')

    const { clean } = validateTelemetry(latest)
    const safety = computeSafety(clean, await loadEngineConfigForDevice(batteryId).catch(() => loadEngineConfig()))

    const now = Date.now()
    const activeViolations = safety.violations
      .filter((v) => ['temperature', 'mq2', 'mq135', 'sensors'].includes(v.rule.field))
      .map((v) => ({
        id: `env_${v.rule.code}_${now}`,
        type: v.rule.code.toUpperCase(),
        severity: SEVERITY_MAP[v.state] || 'WARNING',
        message: v.rule.message,
        value: v.rule.value,
        unit: v.rule.field === 'temperature' ? 'Â°C' : v.rule.field === 'mq2' || v.rule.field === 'mq135' ? 'ADC' : null,
        timestamp: new Date(now).toISOString(),
        code: v.rule.code,
      }))

    // Humidity is not part of the cell safety engine; surface it as an advisory
    // only when the measured value is actually reported.
    const humidity = clean.humidity
    if (humidity != null && humidity > 80.0) {
      activeViolations.push({
        id: `env_hum_warn_${now}`,
        type: 'HUMIDITY_HIGH',
        severity: 'WARNING',
        message: `High relative humidity (${humidity.toFixed(1)}% RH) risks condensation on battery terminals.`,
        value: humidity,
        unit: '%RH',
        timestamp: new Date(now).toISOString(),
        code: 'humidity_high',
      })
    }

    return NextResponse.json({
      batteryId,
      state: safety.state,
      riskScore: safety.score,
      count: activeViolations.length,
      violations: activeViolations,
      hasActiveHazards: activeViolations.some((v) => v.severity === 'CRITICAL'),
    })
  } catch (error) {
    return handleError(error, request)
  }
}