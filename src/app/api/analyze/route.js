import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { analyzeBatteryData, predictFailure, askBatteryAssistant } from '../../../lib/gemini'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const batteryId = body.batteryId || 'BAT001'
    const question = body.question
    const analysisType = body.analysisType || 'current'
    const hasRawFields = ['voltage', 'current', 'temperature'].some((k) => body[k] !== undefined)

    let latest = null

    try {
      const db = await getDB()
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
          safety: b.safety || b.state || 'SAFE',
          resistance: b.resistance,
          power: b.power,
          opDirection: b.opDirection || b.direction || 'IDLE',
        }
      } else {
        latest = await db.collection('live_data').findOne({ batteryId })
      }
    } catch (e) {
      console.warn('DB lookup in analyze route failed:', e.message)
    }

    if (!latest) {
      return NextResponse.json(
        {
          success: false,
          error: 'No telemetry received from ESP32 hardware yet. Waiting for initial sensor packet.',
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
        analysis: analysis.substring(0, 1000),
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
    return NextResponse.json(
      {
        error: 'Analysis failed',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
