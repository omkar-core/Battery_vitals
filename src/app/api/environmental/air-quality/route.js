import { NextResponse } from 'next/server'
import { getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { getDB } from '../../../../lib/mongodb'
import { validateTelemetry } from '../../../../lib/batterySafety'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'
import { TelemetryNotFoundError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

// Air quality reports real sensor values only. The MQ-135 ADC is converted to
// an approximate index, clearly labeled as derived and NOT an EPA-standard AQI.
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`air_quality_get_${ip}`, 60, 60000)
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
        console.warn('MongoDB air-quality fallback failed:', e.message)
      }
    }
    if (!latest) throw new TelemetryNotFoundError(batteryId, 'latest')

    const { clean } = validateTelemetry(latest)
    const mq135 = clean.mq135
    const mq2 = clean.mq2

    let aqi = null
    let category = 'Unknown'
    let advisory = 'No gas sensor reading available yet.'
    let color = '#94A3B8'

    if (mq135 != null) {
      aqi = Math.min(500, Math.max(0, Math.round(mq135 * 0.45)))
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
      note: aqi != null
        ? 'Approximate index derived from raw MQ-135 sensor ADC; not an EPA-standardized AQI.'
        : 'No MQ-135 reading available.',
      timestamp: latest.timestamp ? new Date(latest.timestamp).getTime() : null,
    })
  } catch (error) {
    return handleError(error, request)
  }
}