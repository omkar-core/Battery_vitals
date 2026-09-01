import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { getDB } from '../../../lib/mongodb'
import { analyzeBatteryData } from '../../../lib/gemini'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`insights_get_${ip}`, 20, 60000)
    if (!rateCheck.success) {
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

    if (!latest) {
      return NextResponse.json({
        batteryId,
        insights: [
          'Awaiting first live telemetry frame from ESP32 sensor hub.',
          'System ready for continuous voltage, current, and environmental monitoring.',
        ],
        recommendations: [
          'Ensure ESP32 is powered on and connected to WiFi SSID.',
          'Verify I2C bus wiring for INA219 (SDA GPIO 21, SCL GPIO 22).',
        ],
      })
    }

    const analysis = await analyzeBatteryData(latest, [])

    return NextResponse.json({
      batteryId,
      timestamp: Date.now(),
      status: analysis.overall_status,
      risk_score: analysis.risk_score,
      summary: analysis.summary,
      key_findings: analysis.key_findings || [],
      recommendations: analysis.recommendations || [],
      urgent_actions: analysis.urgent_actions || [],
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate insights', details: error.message }, { status: 500 })
  }
}
