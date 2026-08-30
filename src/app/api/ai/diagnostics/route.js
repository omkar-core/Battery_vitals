import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { ensureAiIndexes, DIAGNOSTICS_COLLECTION } from '../../../../lib/aiDb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

function serialize(d) {
  return {
    id: String(d._id),
    batteryId: d.batteryId,
    safety: d.safety,
    result: d.result,
    source: d.source,
    cached: d.cached,
    model: d.model,
    snapshot: d.snapshot,
    historySummary: d.historySummary,
    createdAt: d.createdAt ? new Date(d.createdAt).getTime() : null,
  }
}

// GET ?batteryId=&limit=20   |   GET ?id=<ObjectId>
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_diagnostics_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const id = sanitizeString(searchParams.get('id') || '', 40)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const db = await getDB()
    await ensureAiIndexes()

    if (id) {
      let doc = null
      try {
        const { ObjectId } = await import('mongodb')
        doc = await db.collection(DIAGNOSTICS_COLLECTION).findOne({ _id: new ObjectId(id) })
      } catch (e) {
        return NextResponse.json({ error: 'Invalid diagnostic id' }, { status: 400 })
      }
      if (!doc) return NextResponse.json({ error: 'Diagnostic not found' }, { status: 404 })
      return NextResponse.json({ success: true, diagnostic: serialize(doc) })
    }

    const docs = await db
      .collection(DIAGNOSTICS_COLLECTION)
      .find({ batteryId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      success: true,
      count: docs.length,
      diagnostics: docs.map(serialize),
    })
  } catch (error) {
    console.error('[BatteryAI] diagnostics list error:', error)
    return NextResponse.json({ success: false, count: 0, diagnostics: [] })
  }
}

// DELETE body { id } — or query ?id=  (view/compare/refresh/delete history)
export async function DELETE(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`ai_diagnostics_del_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    let id = null
    try {
      const body = await request.json().catch(() => ({}))
      id = sanitizeString(body.id || '', 40)
    } catch (e) { /* body optional */ }

    const { searchParams } = new URL(request.url)
    if (!id) id = sanitizeString(searchParams.get('id') || '', 40)
    if (!id) return NextResponse.json({ error: 'Missing diagnostic id' }, { status: 400 })

    const db = await getDB()
    const { ObjectId } = await import('mongodb')
    const result = await db.collection(DIAGNOSTICS_COLLECTION).deleteOne({ _id: new ObjectId(id) })
    if (!result.deletedCount) return NextResponse.json({ error: 'Diagnostic not found' }, { status: 404 })
    return NextResponse.json({ success: true, deleted: result.deletedCount })
  } catch (error) {
    console.error('[BatteryAI] diagnostics delete error:', error)
    return NextResponse.json({ error: 'Failed to delete diagnostic' }, { status: 500 })
  }
}