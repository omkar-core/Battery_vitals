import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { ensureAiIndexes, DIAGNOSTICS_COLLECTION, CHAT_COLLECTION } from '../../../../lib/aiDb'
import { geminiModel } from '../../../../lib/gemini'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

// Honest metadata about what is actually in the system. No fabricated ML
// metrics, no invented model cards. "Training data" here simply means the real
// telemetry corpus the intelligence engine can reason over.
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_training_get_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || '', 30)

    const collectionsMeta = {}
    let db = null
    let reachable = true

    try {
      db = await getDB()
      await ensureAiIndexes()
    } catch (e) {
      console.warn('[BatteryAI] training metadata db unreachable:', e.message)
      reachable = false
    }

    if (db && reachable) {
      for (const coll of ['readings', 'live_data', 'alerts', 'predictions', DIAGNOSTICS_COLLECTION, CHAT_COLLECTION]) {
        const q = batteryId ? { batteryId } : {}
        try {
          const [countDoc, latestDoc] = await Promise.all([
            db.collection(coll).countDocuments(q),
            db.collection(coll).find(q).sort({ createdAt: -1 }).project({ createdAt: 1 }).limit(1).toArray().catch(() => []),
          ])
          let lastRecorded = null
          if (latestDoc && latestDoc.length) lastRecorded = new Date(latestDoc[0].createdAt).getTime()
          collectionsMeta[coll] = { documents: countDoc, lastRecorded }
        } catch (e) {
          collectionsMeta[coll] = { documents: null, lastRecorded: null }
        }
      }
    }

    return NextResponse.json({
      success: true,
      database: reachable ? 'connected' : 'unreachable',
      sources: ['ESP32 (MongoDB readings archive)', 'Firebase Realtime Database (live snapshot)'],
      telemetrySchema: ['voltage', 'current', 'power', 'temperature', 'humidity', 'soc', 'soh', 'bhi', 'resistance', 'mq2', 'mq135', 'cycles', 'energyWh', 'network', 'outputs'],
      model: {
        hosted: process.env.GEMINI_API_KEY ? true : false,
        name: process.env.GEMINI_API_KEY ? geminiModel() : null,
        provider: 'Google Gemini (generativelanguage.googleapis.com)',
        note: 'No model weights are hosted in this deployment. Gemini is called remotely; the deterministic safety engine runs locally in code.',
      },
      collections: collectionsMeta,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[BatteryAI] training metadata error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load training metadata' }, { status: 500 })
  }
}