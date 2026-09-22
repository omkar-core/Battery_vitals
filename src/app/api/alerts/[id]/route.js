import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { ObjectId } from 'mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { AlertNotFoundError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

function buildFilter(id) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { id }
}

export async function GET(request, { params }) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_id_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)

    const { id } = params
    const db = await getDB()
    const alert = await db.collection('alerts').findOne(buildFilter(id))
    if (!alert) throw new AlertNotFoundError(id)
    return NextResponse.json({
      id: String(alert._id),
      time: alert.timestamp,
      severity: alert.severity,
      type: alert.type,
      bhi: alert.bhi,
      message: alert.message,
      acknowledged: Boolean(alert.acknowledged),
      sensorData: alert.sensorData || null,
    })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function PUT(request, { params }) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_id_put_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.MANAGE_ALERTS)

    const { id } = params
    const body = await request.json().catch(() => ({}))
    const acknowledged = body.acknowledged !== undefined ? Boolean(body.acknowledged) : true
    const resolved = body.resolved !== undefined ? Boolean(body.resolved) : false

    const db = await getDB()
    const result = await db.collection('alerts').updateOne(buildFilter(id), {
      $set: {
        acknowledged,
        resolved,
        acknowledgedAt: acknowledged ? new Date().toISOString() : null,
        resolvedAt: resolved ? new Date().toISOString() : null,
      },
    })
    if (!result.matchedCount) throw new AlertNotFoundError(id)

    return NextResponse.json({ success: true, id, acknowledged, resolved })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_id_del_${ip}`, 15, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.MANAGE_ALERTS)

    const { id } = params
    const db = await getDB()
    const result = await db.collection('alerts').deleteOne(buildFilter(id))
    if (!result.deletedCount) throw new AlertNotFoundError(id)
    return NextResponse.json({ success: true, id, dismissed: true })
  } catch (error) {
    return handleError(error, request)
  }
}