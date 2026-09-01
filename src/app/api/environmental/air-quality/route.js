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
    const mq135 = env.mq135 != null ? Number(env.mq135) : 120
    const mq2 = env.mq2 != null ? Number(env.mq2) : 340

    let aqi = Math.round(mq135 * 0.45)
    let category = 'Good'
    let advisory = 'Air quality is satisfactory, and air pollution poses little or no risk.'
    let color = '#00E8A0'

    if (aqi > 300) {
      category = 'Hazardous'
      advisory = 'Health warning of emergency conditions: everyone is more likely to be affected.'
      color = '#7E0023'
    } else if (aqi > 200) {
      category = 'Very Unhealthy'
      advisory = 'Health alert: the risk of health effects is increased for everyone.'
      color = '#8F3F97'
    } else if (aqi > 150) {
      category = 'Unhealthy'
      advisory = 'Some members of the general public may experience health effects.'
      color = '#FF2D55'
    } else if (aqi > 100) {
      category = 'Unhealthy for Sensitive Groups'
      advisory = 'Members of sensitive groups may experience health effects.'
      color = '#FF9500'
    } else if (aqi > 50) {
      category = 'Moderate'
      advisory = 'Air quality is acceptable; moderate concern for very sensitive people.'
      color = '#FFB800'
    }

    return NextResponse.json({
      batteryId,
      aqi,
      category,
      advisory,
      color,
      pollutants: {
        co2_equivalent_ppm: mq135,
        lpg_smoke_ppm: mq2,
      },
      timestamp: latest?.timestamp || Date.now(),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to compute AQI', details: error.message }, { status: 500 })
  }
}
