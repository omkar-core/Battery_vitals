import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'

    let latest = await getLatestTelemetry(batteryId)
    if (!latest) {
      try {
        const db = await getDB()
        latest = await db.collection('live_data').findOne({ batteryId })
      } catch (e) {}
    }

    const env = latest?.environmental || latest || {}
    const temp = env.temperature != null ? Number(env.temperature) : 25.0
    const hum = env.humidity != null ? Number(env.humidity) : 55.0
    const mq2 = env.mq2 != null ? Number(env.mq2) : (env.gasIndex?.mq2 != null ? Number(env.gasIndex.mq2) : 320)
    const mq135 = env.mq135 != null ? Number(env.mq135) : (env.gasIndex?.mq135 != null ? Number(env.gasIndex.mq135) : 110)

    const activeViolations = []

    if (temp > 45.0) {
      activeViolations.push({
        id: `env_temp_crit_${Date.now()}`,
        type: 'TEMPERATURE_CRITICAL',
        severity: 'CRITICAL',
        message: `High ambient temperature (${temp.toFixed(1)}°C) exceeds safety limit of 45°C.`,
        value: temp,
        unit: '°C',
        timestamp: new Date().toISOString(),
      })
    } else if (temp > 38.0) {
      activeViolations.push({
        id: `env_temp_warn_${Date.now()}`,
        type: 'TEMPERATURE_WARNING',
        severity: 'WARNING',
        message: `Elevated ambient temperature (${temp.toFixed(1)}°C). Increase ventilation.`,
        value: temp,
        unit: '°C',
        timestamp: new Date().toISOString(),
      })
    }

    if (mq2 > 800) {
      activeViolations.push({
        id: `env_mq2_crit_${Date.now()}`,
        type: 'GAS_LEAK_CRITICAL',
        severity: 'CRITICAL',
        message: `MQ-2 sensor detected high combustible gas/smoke concentration (${Math.round(mq2)} ppm).`,
        value: mq2,
        unit: 'ppm',
        timestamp: new Date().toISOString(),
      })
    } else if (mq2 > 500) {
      activeViolations.push({
        id: `env_mq2_warn_${Date.now()}`,
        type: 'GAS_ELEVATED',
        severity: 'WARNING',
        message: `MQ-2 sensor detected elevated gas levels (${Math.round(mq2)} ppm). Inspect seals.`,
        value: mq2,
        unit: 'ppm',
        timestamp: new Date().toISOString(),
      })
    }

    if (hum > 80.0) {
      activeViolations.push({
        id: `env_hum_warn_${Date.now()}`,
        type: 'HUMIDITY_HIGH',
        severity: 'WARNING',
        message: `High relative humidity (${hum.toFixed(1)}% RH) risks condensation on battery terminals.`,
        value: hum,
        unit: '%RH',
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      batteryId,
      count: activeViolations.length,
      violations: activeViolations,
      hasActiveHazards: activeViolations.some((v) => v.severity === 'CRITICAL'),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to evaluate environmental alerts', details: error.message }, { status: 500 })
  }
}
