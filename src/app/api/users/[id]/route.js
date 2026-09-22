import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findUser, updateUser, deleteUser, requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { UserNotFoundError, ValidationError } from '../../../../lib/errors'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

const ALLOWED_UPDATE_FIELDS = new Set(['name', 'title', 'department', 'avatar', 'status'])
const ALLOWED_ROLE_VALUES = ['ADMIN', 'OPERATOR', 'VIEWER']

export async function GET(request, { params }) {
  try {
    await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`user_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    const { id } = params
    const user = await findUser(id)
    if (!user) throw new UserNotFoundError(id)
    return NextResponse.json(user)
  } catch (error) {
    return handleError(error, request)
  }
}

export async function PUT(request, { params }) {
  try {
    const actor = await requirePermission(request, PERMISSIONS.MANAGE_USERS)
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`user_put_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { id } = params

    if (id === actor.id) {
      const rawBody = await request.json().catch(() => ({}))
      if (rawBody.role && rawBody.role !== actor.role) {
        return NextResponse.json(
          { error: 'You cannot change your own role.' },
          { status: 403 }
        )
      }
    }

    const rawBody = await request.json().catch(() => ({}))

    const allowed = {}
    for (const key of Object.keys(rawBody)) {
      if (key === 'role') {
        if (!ALLOWED_ROLE_VALUES.includes(rawBody.role)) {
          throw new ValidationError(`Invalid role: ${rawBody.role}`, 'role')
        }
        if (id === actor.id) {
          throw new ValidationError('You cannot change your own role.', 'role')
        }
        allowed.role = rawBody.role
      } else if (ALLOWED_UPDATE_FIELDS.has(key)) {
        allowed[key] = rawBody[key]
      }
    }

    if (Object.keys(allowed).length === 0) {
      throw new ValidationError('No valid fields provided for update.', 'body')
    }

    const existing = await findUser(id)
    if (!existing) throw new UserNotFoundError(id)
    const updated = await updateUser(id, allowed)
    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function DELETE(request, { params }) {
  try {
    const actor = await requirePermission(request, PERMISSIONS.MANAGE_USERS)
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`user_delete_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    const { id } = params
    if (id === actor.id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 403 })
    }
    const existing = await findUser(id)
    if (!existing) throw new UserNotFoundError(id)
    await deleteUser(id)
    return NextResponse.json({ success: true, id, message: 'User deleted successfully' })
  } catch (error) {
    return handleError(error, request)
  }
}