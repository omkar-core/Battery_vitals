import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`env_latest_${ip}`, 60, 60000)
    if (!rate.success) {
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

    const env = latest?.environmental || latest || {}
    const temperature = env.temperature != null ? Number(env.temperature) : 25.4
    const humidity = env.humidity != null ? Number(env.humidity) : 58.0
    const mq2 = env.mq2 != null ? Number(env.mq2) : (env.gasIndex?.mq2 != null ? Number(env.gasIndex.mq2) : 340)
    const mq135 = env.mq135 != null ? Number(env.mq135) : (env.gasIndex?.mq135 != null ? Number(env.gasIndex.mq135) : 115)

    let aqi = env.aqi != null ? Number(env.aqi) : Math.round(mq135 * 0.45)
    let aqiCategory = 'Good'
    if (aqi > 300) aqiCategory = 'Hazardous'
    else if (aqi > 200) aqiCategory = 'Very Unhealthy'
    else if (aqi > 150) aqiCategory = 'Unhealthy'
    else if (aqi > 100) aqiCategory = 'Unhealthy for Sensitive Groups'
    else if (aqi > 50) aqiCategory = 'Moderate'

    return NextResponse.json({
      batteryId,
      timestamp: latest?.timestamp || Date.now(),
      temperature,
      humidity,
      mq2,
      mq135,
      aqi,
      aqiCategory,
      gasStatus: mq2 > 800 ? 'LEAK_DETECTED' : mq2 > 500 ? 'ELEVATED' : 'NORMAL',
      thermalStatus: temperature > 45 ? 'CRITICAL' : temperature > 38 ? 'WARNING' : 'NORMAL',
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch environmental telemetry', details: error.message }, { status: 500 })
  }
}
