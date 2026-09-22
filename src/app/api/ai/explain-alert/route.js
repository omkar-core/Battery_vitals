import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { getAIResponse } from '../../../../lib/aiProvider'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AIExplainAlertSchema } from '../../../../lib/schemas'
import { ValidationError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_explain_alert_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const rawBody = await request.json().catch(() => ({}))
    const parsed = AIExplainAlertSchema.safeParse(rawBody)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid explain-alert payload', issue?.path?.join('.') || 'body')
    }

    const { batteryId, alertId, alert } = parsed.data
    const cleanId = sanitizeString(batteryId, 30)

    // Compute or extract fingerprint
    const field = alert?.field || 'general'
    const severity = (alert?.severity || 'WARNING').toUpperCase()
    const message = alert?.message || 'Threshold violation detected'
    const value = alert?.value != null ? String(alert.value) : 'unknown'
    const threshold = alert?.threshold != null ? String(alert.threshold) : 'configured threshold'
    const fingerprint = parsed.data.fingerprint || `${cleanId}_${field}_${severity}_${value}`

    const db = await getDB()
    // 1. Check persistent MongoDB cache
    try {
      const cached = await db.collection('ai_alert_explanations').findOne({ fingerprint })
      if (cached) {
        return NextResponse.json({
          success: true,
          fingerprint,
          explanation: cached.explanation,
          suggestedAction: cached.suggestedAction,
          severity: cached.severity || severity,
          cached: true,
          provider: cached.provider || 'cached',
        })
      }
    } catch (dbErr) {
      console.warn('[AIAlertExplain] Mongo cache lookup failed:', dbErr.message)
    }

    const prompt = `A battery monitoring alert has triggered for Battery ${cleanId}:
- Parameter: ${field}
- Severity: ${severity}
- Message: ${message}
- Measured Value: ${value}
- Threshold: ${threshold}

Provide a concise 1-2 sentence explanation of why this condition is hazardous, followed by a concrete suggested action for the technician or operator.
Respond with JSON only:
{
  "explanation": "1-2 clear, informative sentences explaining the physical mechanism or danger.",
  "suggestedAction": "Specific physical or operational step to mitigate."
}`

    const aiRes = await getAIResponse(prompt, {
      json: true,
      safetyState: severity,
      cacheKey: `alert_exp_${fingerprint}`,
      fallbackFn: () => {
        let expl = `Parameter ${field} triggered an active ${severity} alert.`
        let act = 'Inspect telemetry and check pack connection.'
        if (field === 'voltage') {
          expl = `Measured voltage (${value}V) breached the safety operating window of ${threshold}V, risking cell overcharging or deep discharge.`
          act = 'Disconnect load or charger immediately and inspect cell balance.'
        } else if (field === 'temperature') {
          expl = `Ambient sensor detected high temperature (${value}°C), which degrades battery chemistry and can lead to thermal excursion.`
          act = 'Power off device, improve ventilation, and allow the pack to cool.'
        } else if (field === 'mq2' || field === 'gas') {
          expl = `Combustible gas/smoke sensor detected elevated levels (${value} ADC), suggesting potential venting or nearby thermal hazard.`
          act = 'Evacuate battery station and check for swelling or off-gassing.'
        }
        return { explanation: expl, suggestedAction: act }
      },
    })

    const parsedData = aiRes.parsed || {}
    const explanation = parsedData.explanation || `The ${field} level breached safe operating limits.`
    const suggestedAction = parsedData.suggestedAction || 'Verify hardware connections and review operating limits.'

    // Persist to MongoDB cache
    try {
      await db.collection('ai_alert_explanations').updateOne(
        { fingerprint },
        {
          $set: {
            fingerprint,
            batteryId: cleanId,
            field,
            severity,
            explanation,
            suggestedAction,
            provider: aiRes.provider,
            model: aiRes.model,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      )
    } catch (saveErr) {
      console.warn('[AIAlertExplain] Cache save failed:', saveErr.message)
    }

    return NextResponse.json({
      success: true,
      fingerprint,
      explanation,
      suggestedAction,
      severity,
      cached: false,
      provider: aiRes.provider,
      model: aiRes.model,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
