import { NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/status',
  '/api/telemetry',
  '/api/data',
  '/api/alerts/esp32',
  '/api/cron/sync',
  '/_next',
  '/favicon.ico',
  '/sw.js',
  '/manifest.json',
]

/**
 * Middleware for auth - does basic token presence check only.
 * Full Firebase ID token verification (with revocation check) happens in route handlers
 * via getVerifiedFirebaseUser() which uses Firebase Admin SDK in Node.js runtime.
 * 
 * WHY: Middleware runs in Edge Runtime where firebase-admin (and its jwks-rsa dependency)
 * uses eval() which is not allowed. Full token verification with revocation check
 * is done in route handlers via getVerifiedFirebaseUser() which runs in Node.js runtime.
 */
export async function middleware(request) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Allow public API paths and static assets
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Extract token from Authorization header or cookie
  const authHeader = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  let token = match ? match[1] : null

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookieMatch = /(?:^|;\s*)bv_session=([^;]+)/.exec(cookieHeader)
    if (cookieMatch) token = decodeURIComponent(cookieMatch[1])
  }

  // For API routes: enforce token presence for mutating requests
  if (pathname.startsWith('/api/')) {
    const isReadOnly = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'

    if (!isReadOnly) {
      // Mutating requests MUST have a token (full verification in route handler)
      if (!token || token === 'bv_guest_session') {
        return NextResponse.json(
          { error: 'Authentication required', code: 'MISSING_CREDENTIALS' },
          { status: 401 }
        )
      }
      // Token present - let route handler do full verification
      return NextResponse.next()
    }

    // Read-only API requests: allow regardless
    return NextResponse.next()
  }

  // For page routes: no blocking
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}