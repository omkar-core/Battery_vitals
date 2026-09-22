import { NextResponse } from 'next/server'

const PUBLIC_PATHS = [
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

export function middleware(request) {
  const { pathname } = request.nextUrl
  const method = request.method

  // Allow public API paths and static assets
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization') || ''
  const cookieToken = request.cookies.get('bv_session')?.value

  // For API routes:
  // - If Bearer token is provided, pass through to route handler for token verification
  // - If cookie session is present, pass through
  // - If it's a read-only GET request, allow viewing telemetry/diagnostics
  // - If it's a mutating request (POST/PUT/DELETE/PATCH) without any auth, reject with 401
  if (pathname.startsWith('/api/')) {
    const hasBearer = authHeader.startsWith('Bearer ') && authHeader.length > 7
    const hasCookie = Boolean(cookieToken)
    const isReadOnly = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'

    if (!hasBearer && !hasCookie && !isReadOnly) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_CREDENTIALS' },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // For page routes, check for session cookie presence
  // If not present, assign a guest viewer session cookie so browsing is never blocked
  if (!cookieToken) {
    const response = NextResponse.next()
    response.cookies.set('bv_session', 'bv_guest_session', {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
