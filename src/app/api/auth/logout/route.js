import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { revokeSessionByToken } from '../../../../lib/auth'
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

    const header = request.headers.get('authorization') || ''
    const match = /^Bearer\s+(.+)$/i.exec(header)
    const token = match ? match[1] : null

    // Server-side revocation is the point of this endpoint: the token's session
    // record is marked revoked so getSessionUser() rejects it even before expiry.
    const revoked = await revokeSessionByToken(token)

    return NextResponse.json({
      success: true,
      revoked,
      message: revoked ? 'User logged out successfully' : 'No active session to revoke',
    })
  } catch (error) {
    return handleError(error, request)
  }
}