import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { analyzeBatteryData, predictFailure, askBatteryAssistant } from '../../../lib/gemini'
import { getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, secureErrorResponse } from '../../../lib/security'

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
        safety: sanitizeString(b.safety || b.state || 'SAFE', 20),
        resistance: b.resistance,
        power: b.power,
        opDirection: sanitizeString(b.opDirection || b.direction || 'IDLE', 20),
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
      return NextResponse.json(
        {
          success: false,
          error: 'No telemetry received from ESP32 hardware in Firebase yet. Waiting for initial sensor packet.',
        },
        { status: 404 }
      )
    }

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
      } catch (e) {}
      analysis = await predictFailure(history)
    } else {
      // 3. Standard Structured Health Analysis
      analysis = await analyzeBatteryData(latest)
    }

    // Save prediction record if database is reachable
    try {
      const db = await getDB()
      const bhi = latest.bhi ?? 15
      const riskLevel = bhi >= 75 ? 'CRITICAL' : bhi >= 55 ? 'WARNING' : bhi >= 30 ? 'CAUTION' : 'INFO'
      await db.collection('predictions').insertOne({
        batteryId: latest.batteryId || batteryId,
        question: question || null,
        riskLevel,
        riskScore: bhi ?? null,
        analysis: sanitizeString(analysis, 2000),
        timestamp: new Date(),
      })
    } catch (e) {}

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return secureErrorResponse(error.message)
  }
}
