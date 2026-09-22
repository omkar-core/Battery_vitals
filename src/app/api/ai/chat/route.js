import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { chatWithContext, streamChatWithContext } from '../../../../lib/gemini'
import { loadAiContext, ensureAiIndexes, CHAT_COLLECTION } from '../../../../lib/aiDb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

const streamHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

// GET -> per-battery chat history (for the assistant UI).
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_chat_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

    let messages = []
    try {
      const db = await getDB()
      await ensureAiIndexes()
      messages = await db
        .collection(CHAT_COLLECTION)
        .find({ batteryId })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray()
    } catch (dbErr) {
      console.warn('[BatteryAI] chat history query failed:', dbErr.message)
    }

    return NextResponse.json({
      success: true,
      count: messages.length,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        source: m.source || null,
        createdAt: m.createdAt ? new Date(m.createdAt).getTime() : null,
      })),
    })
  } catch (error) {
    return handleError(error, request)
  }
}

// POST -> ask the assistant. Streams SSE when body.stream is true.
export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_chat_post_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'AI chat rate limit exceeded. Please wait a moment.' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.ACCESS_AI)

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const question = sanitizeString(body.question || body.message || '', 1000)
    if (!question) {
      return NextResponse.json({ error: 'Missing question or message' }, { status: 400 })
    }
    const stream = body.stream === true

    const { latest, history, alerts } = await loadAiContext(batteryId)

    // Load recent diagnostics so the assistant can reference past analyses.
    let recentDiagnostics = []
    try {
      const db = await getDB()
      await ensureAiIndexes()
      recentDiagnostics = await db
        .collection('ai_diagnostics')
        .find({ batteryId })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray()
      recentDiagnostics = recentDiagnostics.map((d) => d.result)
    } catch (e) { /* history is optional */ }

    const saveMessage = async (role, content, source) => {
      try {
        const db = await getDB()
        await db.collection(CHAT_COLLECTION).insertOne({ batteryId, role, content: sanitizeString(content, 4000), source: source || null, createdAt: new Date() })
      } catch (e) {
        console.warn('[BatteryAI] chat persistence failed:', e.message)
      }
    }

    await saveMessage('user', question, null)

    const context = { question, telemetry: latest || {}, history, recentDiagnostics, alerts }

    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          let full = ''
          let source = 'gemini'
          try {
            for await (const chunk of streamChatWithContext(context)) {
              full += chunk
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
            }
          } catch (e) {
            console.warn('[BatteryAI] chat SSE error:', e.message)
            source = 'rule-based-fallback'
          }
          if (full) await saveMessage('assistant', full, source)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          controller.close()
        },
      })
      return new Response(readable, { headers: streamHeaders })
    }

    const outcome = await chatWithContext(context)
    await saveMessage('assistant', outcome.reply, outcome.source)

    // If query relates to trend/voltage/thermal, prepare inline mini sparkline dataset
    let sparkline = null
    const qLower = question.toLowerCase()
    const isTrendQuery = ['trend', 'voltage', 'temp', 'temperature', 'graph', 'week', 'dip', 'spike', 'history', 'health'].some((k) => qLower.includes(k))
    if (isTrendQuery && Array.isArray(history) && history.length > 0) {
      const step = Math.max(1, Math.floor(history.length / 12))
      sparkline = []
      for (let idx = history.length - 1; idx >= 0; idx -= step) {
        const h = history[idx]
        sparkline.push({
          v: Number(h.voltage ?? h.battery?.voltage ?? 0),
          t: Number(h.temperature ?? h.environment?.temperature ?? 0),
          ts: new Date(h.timestamp || h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
      }
    }

    return NextResponse.json({
      success: true,
      reply: outcome.reply,
      source: outcome.source,
      model: outcome.model,
      sparkline,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[BatteryAI] chat route error:', error)
    return handleError(error, request)
  }
}