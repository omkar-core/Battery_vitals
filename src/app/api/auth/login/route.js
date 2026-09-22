import { NextResponse } from 'next/server'
import { findUserByCredentials, passwordMatches, createSessionToken, decodeSessionPayload, recordSession } from '../../../../lib/auth'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { MissingCredentialsError, AuthenticationError } from '../../../../lib/errors'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`auth_login_${ip}`, 10, 60000)
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.', retryAfter: 60 },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (!email || !password) {
      throw new MissingCredentialsError(email ? 'password' : 'email')
    }

    const user = await findUserByCredentials(email)
    // Constant-time-style single error path so responses do not leak whether an
    // account exists (SECURITY.md §6.2 fingerprinting defense).
    if (!user || user.status === 'disabled' || !passwordMatches(password, user.passwordHash)) {
      throw new AuthenticationError('Invalid email or password')
    }

    const token = createSessionToken(user)
    await recordSession(decodeSessionPayload(token))

    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful',
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
    })
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