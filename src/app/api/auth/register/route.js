import { NextResponse } from 'next/server'
import { findUserByCredentials, createUser, createSessionToken, decodeSessionPayload, recordSession } from '../../../../lib/auth'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { DuplicateEntryError, ValidationError } from '../../../../lib/errors'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`auth_register_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.', retryAfter: 60 },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const name = String(body.name || '').trim()
    const role = String(body.role || 'viewer').toLowerCase()
    const title = String(body.title || 'Battery Specialist').trim()
    const department = String(body.department || 'Operations').trim()

    if (!email || !password || !name) {
      throw new ValidationError('Name, Email, and Password are required.')
    }

    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long.')
    }

    const existing = await findUserByCredentials(email)
    if (existing) {
      throw new DuplicateEntryError('Email', email)
    }

    const user = await createUser({
      name,
      email,
      password,
      role: ['admin', 'operator', 'viewer'].includes(role) ? role : 'viewer',
      title,
      department,
    })

    const token = createSessionToken(user)
    await recordSession(decodeSessionPayload(token))

    const response = NextResponse.json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
        department: user.department,
        avatar: user.avatar,
      },
    }, { status: 201 })

    response.cookies.set('bv_session', token, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    return handleError(error, request)
  }
}
