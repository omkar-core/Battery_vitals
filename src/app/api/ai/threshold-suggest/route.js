import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AIThresholdSuggestSchema } from '../../../../lib/schemas'
import { ValidationError } from '../../../../lib/errors'
import { chemistryDefaults } from '../../../../lib/batteryProfiles'
import { DEFAULT_SAFETY_CONFIG } from '../../../../lib/batterySafety'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_thresh_${ip}`, 15, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = AIThresholdSuggestSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid threshold suggestion request', issue?.path?.join('.') || 'body')
    }

    const { chemistry, series, parallel, capacityAh, usageContext, ambientTempRange, criticality } = parsed.data

    // 1. Fetch current stored thresholds from DB as baseline
    let currentThresholds = {
      voltage_max: DEFAULT_SAFETY_CONFIG.voltage.warnHigh,
      voltage_min: DEFAULT_SAFETY_CONFIG.voltage.warnLow,
      temp_warning: DEFAULT_SAFETY_CONFIG.thermal.warn,
      temp_critical: DEFAULT_SAFETY_CONFIG.thermal.crit,
      mq2_warning: 500,
      mq2_critical: 800,
    }

    try {
      const db = await getDB()
      const stored = await db.collection('settings').findOne({ _id: 'alert_thresholds' })
      if (stored) {
        currentThresholds = {
          voltage_max: stored.voltage_max ?? currentThresholds.voltage_max,
          voltage_min: stored.voltage_min ?? currentThresholds.voltage_min,
          temp_warning: stored.temp_warning ?? currentThresholds.temp_warning,
          temp_critical: stored.temp_critical ?? currentThresholds.temp_critical,
          mq2_warning: stored.mq2_warning ?? currentThresholds.mq2_warning,
          mq2_critical: stored.mq2_critical ?? currentThresholds.mq2_critical,
        }
      }
    } catch (e) {
      console.warn('[AIThresholdSuggest] Could not read current thresholds:', e.message)
    }

    // Default chemistry calculations
    const d = chemistryDefaults(chemistry)
    const baselineVMin = Number((d.cellVMin * series).toFixed(2))
    const baselineVMax = Number((d.cellVMax * series).toFixed(2))

    const prompt = `A battery engineer requests safety threshold recommendations for:
- Chemistry: ${chemistry}
- Configuration: ${series}S ${parallel}P
- Capacity: ${capacityAh || 'standard'} Ah
- Usage Environment: ${usageContext || 'General indoor / laboratory'}
- Ambient Temperature Range: ${ambientTempRange || '15°C to 35°C'}
- Criticality: ${criticality}

Current Configuration:
- Voltage Max: ${currentThresholds.voltage_max}V
- Voltage Min: ${currentThresholds.voltage_min}V
- Temp Warning: ${currentThresholds.temp_warning}°C
- Temp Critical: ${currentThresholds.temp_critical}°C
- MQ-2 Gas Warning: ${currentThresholds.mq2_warning} ADC
- MQ-2 Gas Critical: ${currentThresholds.mq2_critical} ADC

Propose conservative, safety-first thresholds tailored to this chemistry and operating criticality.
Respond with JSON only:
{
  "suggested": {
    "voltage_max": number,
    "voltage_min": number,
    "temp_warning": number,
    "temp_critical": number,
    "mq2_warning": number,
    "mq2_critical": number
  },
  "rationale": "Clear 2-3 sentence engineering justification for the recommended values.",
  "confidence": "HIGH" | "MEDIUM"
}`

    const aiRes = await getAIResponse(prompt, {
      json: true,
      cacheKey: `thresh_${chemistry}_${series}_${criticality}`,
      fallbackFn: () => ({
        suggested: {
          voltage_max: baselineVMax,
          voltage_min: baselineVMin,
          temp_warning: criticality === 'MISSION_CRITICAL' ? 38 : 42,
          temp_critical: criticality === 'MISSION_CRITICAL' ? 48 : 55,
          mq2_warning: 450,
          mq2_critical: 750,
        },
        rationale: `Thresholds derived from standard ${chemistry} cell voltage boundaries (${d.cellVMin}V–${d.cellVMax}V per cell × ${series}S) with ambient safety margins.`,
        confidence: 'HIGH',
      }),
    })

    const suggested = aiRes.parsed?.suggested || {
      voltage_max: baselineVMax,
      voltage_min: baselineVMin,
      temp_warning: 40,
      temp_critical: 50,
      mq2_warning: 500,
      mq2_critical: 800,
    }

    // Compute diffs / deltas
    const deltas = {}
    Object.keys(suggested).forEach((k) => {
      const cur = currentThresholds[k] ?? 0
      const sug = suggested[k] ?? 0
      deltas[k] = Number((sug - cur).toFixed(2))
    })

    return NextResponse.json({
      success: true,
      current: currentThresholds,
      suggested,
      deltas,
      rationale: aiRes.parsed?.rationale || 'Tailored to pack chemistry and thermal envelope.',
      confidence: aiRes.parsed?.confidence || 'HIGH',
      requiresAdminApproval: true,
      provider: aiRes.provider,
      model: aiRes.model,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
