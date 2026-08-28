import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { analyzeBatteryData, predictFailure } from '../../../lib/gemini'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const batteryId = body.batteryId || 'BAT001'
    const analysisType = body.analysisType || 'current'
    const hasRawFields = ['voltage', 'current', 'temperature'].some((k) => body[k] !== undefined)

    const db = await getDB()
    let latest

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

    if (!latest) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    let analysis

    if (analysisType === 'predict') {
      const history = await db
        .collection('readings')
        .find({ batteryId })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray()
      analysis = await predictFailure(history)
    } else {
      analysis = await analyzeBatteryData(latest)
    }

    try {
      const bhi = latest.bhi ?? latest.risk?.bhi
      const riskLevel = bhi >= 75 ? 'CRITICAL' : bhi >= 55 ? 'WARNING' : bhi >= 30 ? 'CAUTION' : 'INFO'
      await db.collection('predictions').insertOne({
        batteryId: latest.batteryId || batteryId,
        riskLevel,
        riskScore: bhi ?? null,
        analysis: analysis.substring(0, 500),
        recommendations: [],
        modelVersion: 'gemini',
        timestamp: new Date(),
      })
    } catch (e) { /* non-critical */ }

    return NextResponse.json({
      success: true,
      analysis,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      error: 'Analysis failed',
      message: error.message,
    }, { status: 500 })
  }
}
