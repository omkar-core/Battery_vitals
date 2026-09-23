import { NextResponse } from 'next/server'
import { guardAIRequest } from '../../../../lib/securityGuard'
import { getDB } from '../../../../lib/mongodb'
import { callAIProvider } from '../../../../lib/aiProvider'
import { logAIAuditRecord } from '../../../../lib/aiAudit'
import { sanitizeString } from '../../../../lib/security'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const startTime = Date.now()
  try {
    const rawBody = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(rawBody.batteryId || 'BAT001', 30)

    const guard = await guardAIRequest(request, batteryId)
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const alert = rawBody.alert || {}
    const field = alert.field || 'general'
    const severity = (alert.severity || 'WARNING').toUpperCase()
    const message = alert.message || 'Threshold violation detected'
    const value = alert.value != null ? String(alert.value) : 'unknown'
    const threshold = alert.threshold != null ? String(alert.threshold) : 'configured threshold'
    const fingerprint = rawBody.fingerprint || `${guard.batteryId}_${field}_${severity}_${value}`

    // 1. Check persistent DB cache (Section 11 requirement)
    try {
      const db = await getDB()
      const cached = await db.collection('ai_alert_explanations').findOne({ fingerprint })
      if (cached) {
        await logAIAuditRecord({
          userId: guard.user.id,
          batteryId: guard.batteryId,
          endpoint: '/api/ai/explain-alert',
          responseTimeMs: Date.now() - startTime,
          cacheHit: true,
        })

        return NextResponse.json({
          success: true,
          fingerprint,
          explanation: cached.explanation,
          suggestedAction: cached.suggestedAction,
          severity: cached.severity || severity,
          cached: true,
        })
      }
    } catch (e) {
      console.warn('[explain-alert] Cache read failed:', e.message)
    }

    const prompt = `A battery monitoring alert has triggered for Battery ${guard.batteryId}:
- Parameter: ${field}
- Severity: ${severity}
- Message: ${message}
- Measured Value: ${value}
- Threshold: ${threshold}

Provide a concise 1-2 sentence explanation of why this condition is hazardous, followed by a concrete suggested action.
Respond with JSON only:
{
  "explanation": "1-2 clear, informative sentences.",
  "suggestedAction": "Specific physical step to mitigate."
}`

    const aiResText = await callAIProvider({
      taskType: 'chat',
      prompt,
      systemInstruction: 'Output valid JSON strictly matching requested format.',
    })

    let parsedData = {}
    try {
      parsedData = JSON.parse(aiResText.replace(/```json|```/g, '').trim())
    } catch (e) {
      parsedData = {
        explanation: `Parameter ${field} breached safe limits (${value} vs threshold ${threshold}).`,
        suggestedAction: 'Inspect battery hardware and check connection cables.',
      }
    }

    const resultDoc = {
      fingerprint,
      userId: guard.user.id,
      batteryId: guard.batteryId,
      explanation: parsedData.explanation,
      suggestedAction: parsedData.suggestedAction,
      severity,
      createdAt: new Date().toISOString(),
    }

    // Persist to DB
    try {
      const db = await getDB()
      await db.collection('ai_alert_explanations').updateOne(
        { fingerprint },
        { $set: resultDoc },
        { upsert: true }
      )
    } catch (e) {
      console.warn('[explain-alert] Cache write failed:', e.message)
    }

    await logAIAuditRecord({
      userId: guard.user.id,
      batteryId: guard.batteryId,
      endpoint: '/api/ai/explain-alert',
      responseTimeMs: Date.now() - startTime,
      cacheHit: false,
    })

    return NextResponse.json({
      success: true,
      fingerprint,
      explanation: parsedData.explanation,
      suggestedAction: parsedData.suggestedAction,
      severity,
      cached: false,
    })
  } catch (error) {
    return handleError(error, request)
  }
}
