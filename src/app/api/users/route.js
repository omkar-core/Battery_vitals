import { NextResponse } from 'next/server'
import { getUsers, createUser, findUser, requirePermission } from '../../../lib/auth'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { PERMISSIONS } from '../../../lib/permissions'
import { handleError } from '../../../lib/errorHandler'
import { DuplicateEntryError, ValidationError } from '../../../lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`users_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)
    const users = await getUsers()
    return NextResponse.json({ count: users.length, users, actor: { id: user.id, role: user.role } })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`user_create_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Only admins may create/modify team accounts.
    await requirePermission(request, PERMISSIONS.MANAGE_USERS)

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    if (!email || !body.name) {
      throw new ValidationError('Name and Email are required.')
    }

    const existing = await findUser(email)
    if (existing) throw new DuplicateEntryError('Email', email)

    const newUser = await createUser({ ...body, email })
    return NextResponse.json({ success: true, user: newUser }, { status: 201 })
  } catch (error) {
    return handleError(error, request)
  }
}