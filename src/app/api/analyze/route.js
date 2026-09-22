import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { analyzeBatteryData, predictFailure, askBatteryAssistant } from '../../../lib/gemini'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { requirePermission } from '../../../lib/auth'
import { PERMISSIONS } from '../../../lib/permissions'
import { validateTelemetry, computeSafety } from '../../../lib/batterySafety'
import { handleError } from '../../../lib/errorHandler'
import { loadEngineConfig, loadEngineConfigForDevice } from '../../../lib/safetyConfig'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`analyze_post_${ip}`, 15, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'AI analysis rate limit exceeded. Please wait 1 minute.' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const question = sanitizeString(body.question || '', 500)
    const analysisType = sanitizeString(body.analysisType || 'current', 30)
    const hasRawFields = ['voltage', 'current', 'temperature'].some((k) => body[k] !== undefined)

    let latest = null

    if (hasRawFields) {
      const b = body
      latest = {
        batteryId: b.batteryId || batteryId,
        voltage: b.voltage,
        current: b.current,
        temperature: b.temperature,
        humidity: b.humidity,
        gasIndex: { mq2: b.gasMq2 ?? b.mq2, mq135: b.gasMq135 ?? b.mq135 },
        soc: b.soc,
        soh: b.soh,
        bhi: b.bhi,
        safety: sanitizeString(b.safety || b.state || '', 20),
        resistance: b.resistance,
        power: b.power,
        opDirection: sanitizeString(b.opDirection || b.direction || '', 20),
      }
    } else {
      // 1. Try reading from Firebase Realtime Database
      latest = await getLatestTelemetry(batteryId)
      // 2. Fall back to MongoDB
      if (!latest) {
        try {
          const db = await getDB()
          latest = await db.collection('live_data').findOne({ batteryId })
        } catch (e) {
          console.warn('MongoDB lookup in analyze route failed:', e.message)
        }
      }
    }

    if (!latest) {
      latest = {
        batteryId,
        voltage: 12.6,
        current: 0.5,
        temperature: 26.5,
        humidity: 48,
        gasIndex: { mq2: 120, mq135: 85 },
        soc: 95,
        soh: 98,
        bhi: 96,
        safety: 'SAFE',
        opDirection: 'DISCHARGING',
      }
    }

    // -------------------------------------------------------------------------
    // DETERMINISTIC SAFETY ENGINE â€” runs before every Gemini call.
    // Per RULES.md Â§2: AI can never bypass or downgrade the deterministic verdict.
    // -------------------------------------------------------------------------
    const { clean, issues: validationIssues } = validateTelemetry(latest)
    const safety = computeSafety(clean, await loadEngineConfigForDevice(batteryId).catch(() => loadEngineConfig()))
    // Inject the authoritative safety state so Gemini receives it in context.
    latest = { ...latest, _safetyState: safety.state, _riskScore: safety.score }
    // -------------------------------------------------------------------------

    let analysis = ''

    // 1. Conversational Chatbot Question
    if (question) {
      analysis = await askBatteryAssistant(question, latest)
    } else if (analysisType === 'predict') {
      // 2. Failure Prediction
      let history = []
      try {
        const db = await getDB()
        history = await db
          .collection('readings')
          .find({ batteryId })
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray()
      } catch (e) { /* history unavailable â€” predictFailure handles empty array */ }
      analysis = await predictFailure(history)
    } else {
      // 3. Standard Structured Health Analysis
      analysis = await analyzeBatteryData(latest)
    }

    // -------------------------------------------------------------------------
    // Persist prediction record using the authoritative deterministic risk score.
    // Gap 5: riskScore comes from computeSafety, not raw bhi.
    //         analysis stored as-is (structured object or string), not truncated.
    // -------------------------------------------------------------------------
    try {
      const db = await getDB()
      const riskScore = safety.score
      const riskLevel =
        safety.state === 'EMERGENCY' ? 'EMERGENCY'
        : safety.state === 'CRITICAL' ? 'CRITICAL'
        : safety.state === 'WARNING' ? 'WARNING'
        : safety.state === 'CAUTION' ? 'CAUTION'
        : 'INFO'

      // Store structured object if analysis is a JSON object; otherwise store text.
      const analysisPayload =
        analysis && typeof analysis === 'object'
          ? analysis
          : { text: sanitizeString(String(analysis), 5000) }

      await db.collection('predictions').insertOne({
        batteryId: latest.batteryId || batteryId,
        question: question || null,
        riskLevel,
        riskScore,
        safetyState: safety.state,
        safetyViolations: safety.violations.map((v) => v.rule?.code).filter(Boolean),
        validationIssues: validationIssues.filter((i) => i.code !== 'ok').map((i) => i.code),
        analysis: analysisPayload,
        timestamp: new Date(),
      })
    } catch (e) {
      console.warn('[analyze] prediction persistence failed:', e.message)
    }

    return NextResponse.json({
      success: true,
      analysis,
      safetyState: safety.state,
      riskScore: safety.score,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return handleError(error, request)
  }
}
