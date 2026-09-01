import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { getDB } from '../../../lib/mongodb'

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

    const b = latest?.battery || latest || {}
    const env = latest?.environmental || latest || {}
    const anomalies = []

    const v = b.voltage != null ? Number(b.voltage) : 12.6
    const i = b.current != null ? Number(b.current) : 0.0
    const temp = env.temperature != null ? Number(env.temperature) : 25.0
    const mq2 = env.mq2 != null ? Number(env.mq2) : (env.gasIndex?.mq2 != null ? Number(env.gasIndex.mq2) : 320)

    // Voltage Drop / Spike check
    if (v < 11.0) {
      anomalies.push({
        id: `anom_v_low_${Date.now()}`,
        parameter: 'Voltage',
        type: 'UNDERVOLTAGE_DRIFT',
        severity: 'HIGH',
        detectedValue: `${v.toFixed(2)}V`,
        expectedRange: '11.5V – 14.4V',
        confidence: 0.94,
        description: 'Significant voltage depression detected under moderate load.',
        timestamp: new Date().toISOString(),
      })
    } else if (v > 14.5) {
      anomalies.push({
        id: `anom_v_high_${Date.now()}`,
        parameter: 'Voltage',
        type: 'OVERVOLTAGE_SURGE',
        severity: 'CRITICAL',
        detectedValue: `${v.toFixed(2)}V`,
        expectedRange: '11.5V – 14.4V',
        confidence: 0.98,
        description: 'Charging overvoltage surge risks damaging cell chemistry.',
        timestamp: new Date().toISOString(),
      })
    }

    // High current draw
    if (Math.abs(i) > 12.0) {
      anomalies.push({
        id: `anom_i_high_${Date.now()}`,
        parameter: 'Current',
        type: 'OVERCURRENT_SPIKE',
        severity: 'HIGH',
        detectedValue: `${i.toFixed(2)}A`,
        expectedRange: '±8.0A',
        confidence: 0.91,
        description: 'Abnormal high current draw detected.',
        timestamp: new Date().toISOString(),
      })
    }

    // Thermal delta
    if (temp > 40.0) {
      anomalies.push({
        id: `anom_temp_high_${Date.now()}`,
        parameter: 'Temperature',
        type: 'THERMAL_EXCURSION',
        severity: temp > 45 ? 'CRITICAL' : 'MEDIUM',
        detectedValue: `${temp.toFixed(1)}°C`,
        expectedRange: '15°C – 35°C',
        confidence: 0.96,
        description: 'Battery ambient temperature exceeding standard dissipation threshold.',
        timestamp: new Date().toISOString(),
      })
    }

    // Gas anomaly
    if (mq2 > 600) {
      anomalies.push({
        id: `anom_gas_high_${Date.now()}`,
        parameter: 'MQ-2 Gas / Smoke',
        type: 'GAS_CONCENTRATION_JUMP',
        severity: mq2 > 800 ? 'CRITICAL' : 'HIGH',
        detectedValue: `${Math.round(mq2)} ppm`,
        expectedRange: '< 400 ppm',
        confidence: 0.99,
        description: 'Rapid increase in combustible gas or smoke signature.',
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      batteryId,
      count: anomalies.length,
      anomalies,
      systemHealthState: anomalies.length === 0 ? 'NORMAL' : anomalies.some((a) => a.severity === 'CRITICAL') ? 'HAZARDOUS' : 'ATTENTION_REQUIRED',
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to evaluate anomalies', details: error.message }, { status: 500 })
  }
}
