import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AIRootCauseSchema } from '../../../../lib/schemas'
import { ValidationError } from '../../../../lib/errors'
import { slopePerMinute } from '../../../../lib/batteryAnalytics'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_root_cause_${ip}`, 15, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = AIRootCauseSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid root cause payload', issue?.path?.join('.') || 'body')
    }

    const { batteryId, windowStart, windowEnd, alert, telemetrySamples } = parsed.data
    const cleanId = sanitizeString(batteryId, 30)

    let samples = Array.isArray(telemetrySamples) && telemetrySamples.length > 0 ? telemetrySamples : []

    // If no samples supplied in body, query MongoDB around window
    if (samples.length === 0) {
      try {
        const db = await getDB()
        const end = windowEnd ? new Date(windowEnd) : new Date()
        const start = windowStart ? new Date(windowStart) : new Date(end.getTime() - 15 * 60 * 1000) // 15 min window
        samples = await db
          .collection('readings')
          .find({ batteryId: cleanId, timestamp: { $gte: start, $lte: end } })
          .sort({ timestamp: 1 })
          .limit(60)
          .toArray()
      } catch (e) {
        console.warn('[AIRootCause] DB fetch failed:', e.message)
      }
    }

    // Correlate parameters
    const vSlope = slopePerMinute(samples, 'voltage')
    const tSlope = slopePerMinute(samples, 'temperature')
    const mq2Slope = slopePerMinute(samples, 'mq2')

    // Timeline contributing factors
    const timelineFactors = []
    samples.forEach((s, idx) => {
      const ts = s.timestamp || s.time || Date.now() - (samples.length - idx) * 5000
      const v = Number(s.voltage ?? s.battery?.voltage)
      const t = Number(s.temperature ?? s.environment?.temperature)
      const mq2 = Number(s.mq2 ?? s.gasIndex?.mq2 ?? s.gas?.index_mq2)
      const i = Number(s.current ?? s.battery?.current)

      if (v != null && (v > 12.6 || v < 10.0)) {
        timelineFactors.push({
          timestamp: ts,
          factor: 'voltage',
          value: `${v}V`,
          severity: v > 13.0 || v < 9.5 ? 'CRITICAL' : 'WARNING',
          description: v > 12.6 ? 'Voltage peak above ceiling' : 'Voltage drop below floor',
        })
      }
      if (t != null && t > 40) {
        timelineFactors.push({
          timestamp: ts,
          factor: 'temperature',
          value: `${t}°C`,
          severity: t > 45 ? 'CRITICAL' : 'WARNING',
          description: 'Thermal rise above nominal band',
        })
      }
      if (mq2 != null && mq2 > 500) {
        timelineFactors.push({
          timestamp: ts,
          factor: 'gas',
          value: `${mq2} ADC`,
          severity: mq2 > 800 ? 'CRITICAL' : 'WARNING',
          description: 'Combustible gas/smoke elevation',
        })
      }
      if (i != null && Math.abs(i) > 5.0) {
        timelineFactors.push({
          timestamp: ts,
          factor: 'current',
          value: `${i}A`,
          severity: Math.abs(i) > 8.0 ? 'CRITICAL' : 'WARNING',
          description: i < 0 ? 'High discharge surge' : 'High charging surge',
        })
      }
    })

    const prompt = `Analyze this battery hazard event window for Root-Cause Correlation:
Battery: ${cleanId}
Triggering Alert: ${alert ? JSON.stringify(alert) : 'Multiple parameter excursion'}
Telemetry Timeline Samples: ${samples.length} readings
Observed Trends:
- Voltage rate of change: ${vSlope ? `${vSlope.slopePerMin.toFixed(2)}V/min` : 'flat / insufficient data'}
- Temperature rate of change: ${tSlope ? `${tSlope.slopePerMin.toFixed(2)}°C/min` : 'flat / insufficient data'}
- Gas rate of change: ${mq2Slope ? `${mq2Slope.slopePerMin.toFixed(1)} ADC/min` : 'flat / insufficient data'}

Synthesize the correlated evidence into an engineering root-cause hypothesis.
Respond with JSON only:
{
  "hypothesisTitle": "Short bold hypothesis title (e.g. 'High Current Discharge Triggered Thermal Rise')",
  "hypothesis": "2-3 sentences explaining the likely root physical cause without overstating certainty.",
  "confidencePercent": number (between 40 and 95),
  "primaryFactor": "voltage" | "temperature" | "gas" | "current" | "sensor_drift",
  "recommendedAction": "Immediate step to inspect or resolve."
}`

    const aiRes = await getAIResponse(prompt, {
      json: true,
      safetyState: alert?.severity || 'CRITICAL',
      fallbackFn: () => ({
        hypothesisTitle: 'Multi-Sensor Parameter Excursion',
        hypothesis: 'Telemetry traces indicate correlated deviations across electrical and environmental sensors during this operational window.',
        confidencePercent: 70,
        primaryFactor: timelineFactors[0]?.factor || 'voltage',
        recommendedAction: 'Inspect load connections and verify ambient temperature.',
      }),
    })

    const parsedData = aiRes.parsed || {}

    return NextResponse.json({
      success: true,
      batteryId: cleanId,
      hypothesisTitle: parsedData.hypothesisTitle || 'Correlated Anomaly Event',
      hypothesis: parsedData.hypothesis || 'Correlated excursions detected during the observation period.',
      confidencePercent: parsedData.confidencePercent || 65,
      primaryFactor: parsedData.primaryFactor || 'voltage',
      recommendedAction: parsedData.recommendedAction || 'Inspect battery pack and wiring.',
      timelineFactors: timelineFactors.slice(-20),
      samplesAnalyzed: samples.length,
      provider: aiRes.provider,
      model: aiRes.model,
      disclaimer: 'This output is strictly an AI hypothesis and does not replace deterministic safety engine trips.',
    })
  } catch (error) {
    return handleError(error, request)
  }
}
