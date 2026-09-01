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

    const b = latest?.battery || latest || {}
    const voltage = b.voltage != null ? Number(b.voltage) : 12.6
    const current = b.current != null ? Number(b.current) : 0.0

    // Linear OCV model for 12V system
    let calculatedSoc = Math.max(0, Math.min(100, Math.round(((voltage - 10.5) / (12.6 - 10.5)) * 100)))
    const finalSoc = b.soc != null ? Number(b.soc) : calculatedSoc

    const nominalCapacityAh = 2.6
    const remainingCapacityAh = (finalSoc / 100) * nominalCapacityAh

    let runtimeMinutes = null
    if (Math.abs(current) > 0.05) {
      if (current < 0) {
        // Discharging
        runtimeMinutes = Math.round((remainingCapacityAh / Math.abs(current)) * 60)
      } else {
        // Charging
        const missingAh = ((100 - finalSoc) / 100) * nominalCapacityAh
        runtimeMinutes = Math.round((missingAh / current) * 60)
      }
    }

    return NextResponse.json({
      batteryId,
      soc: finalSoc,
      voltage,
      current,
      nominalCapacityAh,
      remainingCapacityAh: Number(remainingCapacityAh.toFixed(2)),
      chargingState: current > 0.05 ? 'CHARGING' : current < -0.05 ? 'DISCHARGING' : 'IDLE',
      estimatedRuntimeMinutes: runtimeMinutes,
      timestamp: latest?.timestamp || Date.now(),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to estimate SOC', details: error.message }, { status: 500 })
  }
}
