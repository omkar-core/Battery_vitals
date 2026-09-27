import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { getVerifiedFirebaseUser, revokeAllUserSessions } from '../../../../lib/auth'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`auth_logout_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Verify Firebase ID token
    const firebaseUser = await getVerifiedFirebaseUser(request)
    if (!firebaseUser) {
      return NextResponse.json(
        { error: 'No active session', code: 'NO_SESSION' },
        { status: 400 }
      )
    }

    // Revoke all refresh tokens for this UID in Firebase Auth
    // This invalidates all ID tokens for this user across all devices
    const revoked = await revokeAllUserSessions(firebaseUser.uid)

    // Clear client-side token cookie
    const response = NextResponse.json({
      success: true,
      revoked,
      message: revoked ? 'Logged out successfully. All sessions revoked.' : 'Logged out locally.',
    })
    response.cookies.set('bv_session', '', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
    })

    return response
  } catch (error) {
    return handleError(error, request)
  }
}