import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`env_latest_${ip}`, 60, 60000)
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
        console.warn('MongoDB environmental/latest fallback failed:', e.message)
      }
    }

    if (!latest) throw new TelemetryNotFoundError(batteryId, 'latest')

    const env = latest?.environment || latest?.environmental || latest || {}
    const gasIndex = latest?.gasIndex || {}
    const temperature = env.temperature != null ? Number(env.temperature) : null
    const humidity = env.humidity != null ? Number(env.humidity) : null
    const mq2 = env.mq2 != null ? Number(env.mq2) : gasIndex.mq2 != null ? Number(gasIndex.mq2) : latest.mq2 != null ? Number(latest.mq2) : null
    const mq135 = env.mq135 != null ? Number(env.mq135) : gasIndex.mq135 != null ? Number(gasIndex.mq135) : latest.mq135 != null ? Number(latest.mq135) : null

    // AQI is an honest derivation from the reported MQ-135 ADC, never a default.
    const aqi = mq135 != null ? Math.round(mq135 * 0.45) : null
    let aqiCategory = null
    if (aqi != null) {
      if (aqi > 300) aqiCategory = 'Hazardous'
      else if (aqi > 200) aqiCategory = 'Very Unhealthy'
      else if (aqi > 150) aqiCategory = 'Unhealthy'
      else if (aqi > 100) aqiCategory = 'Unhealthy for Sensitive Groups'
      else if (aqi > 50) aqiCategory = 'Moderate'
      else aqiCategory = 'Good'
    }

    // Heat Index (Rothfusz / Steadman approximation)
    let heatIndex = null
    if (temperature != null && humidity != null) {
      const hi = Number((temperature + 0.5555 * ((humidity / 100) * 6.11 * Math.exp(5417.7530 * (1 / 273.16 - 1 / (273.15 + temperature))) - 10)).toFixed(1))
      heatIndex = Number.isFinite(hi) ? hi : temperature
    }

    // Dew Point calculation (Magnus-Tetens formula)
    let dewPoint = null
    if (temperature != null && humidity != null && humidity > 0) {
      const a = 17.27
      const b = 237.7
      const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100)
      const dp = Number(((b * alpha) / (a - alpha)).toFixed(1))
      dewPoint = Number.isFinite(dp) ? dp : null
    }

    const gasStatus = mq2 == null ? null : mq2 > 800 ? 'LEAK_DETECTED' : mq2 > 500 ? 'ELEVATED' : 'NORMAL'
    const thermalStatus = temperature == null ? null : temperature > 45 ? 'CRITICAL' : temperature > 38 ? 'WARNING' : 'NORMAL'

    return NextResponse.json({
      batteryId,
      timestamp: latest?.timestamp ?? latest?.ts ?? Date.now(),
      temperature,
      humidity,
      heatIndex,
      dewPoint,
      mq2,
      mq135,
      aqi,
      aqiCategory,
      gasStatus,
      thermalStatus,
    })
  } catch (error) {
    return handleError(error, request)
  }
}