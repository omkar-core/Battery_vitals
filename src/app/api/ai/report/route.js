import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AIReportSchema } from '../../../../lib/schemas'
import { ValidationError, TelemetryNotFoundError } from '../../../../lib/errors'
import { integrateEnergy } from '../../../../lib/batteryAnalytics'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_report_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = AIReportSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid AI report request', issue?.path?.join('.') || 'body')
    }

    const { batteryId, period, startDate, endDate } = parsed.data
    const cleanId = sanitizeString(batteryId, 30)

    // Calculate time window
    const now = new Date()
    let start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7d default
    let end = now

    if (period === 'monthly') {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (period === 'custom' && startDate) {
      start = new Date(startDate)
      if (endDate) end = new Date(endDate)
    }

    const db = await getDB()
    const readings = await db
      .collection('readings')
      .find({
        batteryId: cleanId,
        timestamp: { $gte: start, $lte: end },
      })
      .sort({ timestamp: 1 })
      .limit(500)
      .toArray()

    const energy = integrateEnergy(readings)

    // Compute aggregate metrics
    const sampleCount = readings.length
    let maxTemp = null
    let minTemp = null
    let avgVoltage = null
    let latestSoh = null
    let gasExposures = 0

    if (sampleCount > 0) {
      let vSum = 0
      let vCount = 0
      readings.forEach((r) => {
        const v = Number(r.voltage ?? r.battery?.voltage)
        const t = Number(r.temperature ?? r.environment?.temperature)
        const mq2 = Number(r.mq2 ?? r.gasIndex?.mq2 ?? r.gas?.index_mq2)
        const soh = Number(r.soh ?? r.battery?.soh)

        if (Number.isFinite(v)) {
          vSum += v
          vCount++
        }
        if (Number.isFinite(t)) {
          maxTemp = maxTemp == null ? t : Math.max(maxTemp, t)
          minTemp = minTemp == null ? t : Math.min(minTemp, t)
        }
        if (Number.isFinite(mq2) && mq2 > 500) {
          gasExposures++
        }
        if (Number.isFinite(soh)) {
          latestSoh = soh
        }
      })
      avgVoltage = vCount > 0 ? Number((vSum / vCount).toFixed(2)) : null
    }

    // Downsample sparkline to ~20 points
    const step = Math.max(1, Math.floor(sampleCount / 20))
    const sparklines = {
      voltage: [],
      temperature: [],
    }
    for (let i = 0; i < sampleCount; i += step) {
      const r = readings[i]
      const ts = new Date(r.timestamp || r.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      sparklines.voltage.push({
        t: ts,
        v: Number(r.voltage ?? r.battery?.voltage ?? 0),
      })
      sparklines.temperature.push({
        t: ts,
        v: Number(r.temperature ?? r.environment?.temperature ?? 0),
      })
    }

    // Prompt the AI Provider for narrative & headline stat
    const prompt = `Generate a ${period} executive battery health report for Battery ID: ${cleanId}.
Aggregated statistics over the period:
- Samples analyzed: ${sampleCount}
- Average Voltage: ${avgVoltage ? `${avgVoltage}V` : 'not reported'}
- Max Temperature: ${maxTemp ? `${maxTemp}°C` : 'not reported'}
- Min Temperature: ${minTemp ? `${minTemp}°C` : 'not reported'}
- Gas warning excursions: ${gasExposures}
- Energy throughput: ${energy.throughputAh} Ah (${energy.energyWh} Wh)
- Latest SOH: ${latestSoh ? `${latestSoh}%` : 'not reported'}

Respond with JSON only:
{
  "headlineStat": "A short bold punchy headline like 'SOH held steady at 98%' or 'Thermal stress detected under load'",
  "narrative": "A cohesive, professional 2-3 paragraph analysis of overall health, stability, and thermal behavior.",
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "grade": "A+" | "A" | "B" | "C" | "D"
}`

    const aiRes = await getAIResponse(prompt, {
      json: true,
      cacheKey: `report_${cleanId}_${period}_${Math.floor(Date.now() / 300000)}`,
      fallbackFn: () => ({
        headlineStat: latestSoh ? `SOH recorded at ${latestSoh}%` : `System recorded ${sampleCount} vitals packets`,
        narrative: `During this ${period} period, ${sampleCount} telemetry packets were logged for ${cleanId}. Average voltage was ${avgVoltage || 'normal'}V with peak recorded ambient temperatures of ${maxTemp || 'normal'}°C. The pack handled approximately ${energy.throughputAh} Ah of cumulative throughput with ${gasExposures} gas detection alerts.`,
        recommendations: [
          'Continue routine thermal and voltage logging.',
          'Verify INA219 calibration during scheduled maintenance.',
        ],
        grade: gasExposures > 0 ? 'B' : 'A',
      }),
    })

    const parsedData = aiRes.parsed || {}

    return NextResponse.json({
      success: true,
      batteryId: cleanId,
      period,
      headlineStat: parsedData.headlineStat || 'Battery Health Report',
      narrative: parsedData.narrative || 'Telemetry within normal operating range.',
      recommendations: parsedData.recommendations || [],
      grade: parsedData.grade || 'A',
      stats: {
        samples: sampleCount,
        avgVoltage,
        maxTemp,
        minTemp,
        gasExposures,
        throughputAh: energy.throughputAh,
        energyWh: energy.energyWh,
        soh: latestSoh,
      },
      sparklines,
      provider: aiRes.provider,
      model: aiRes.model,
      generatedAt: Date.now(),
    })
  } catch (error) {
    return handleError(error, request)
  }
}
