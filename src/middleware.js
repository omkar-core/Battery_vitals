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

  // Allow public API paths and static assets
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // For API routes, check Authorization header
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'MISSING_CREDENTIALS' },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // For page routes, check for session cookie presence
  // If not present, assign a guest viewer session cookie so browsing is never blocked
  const token = request.cookies.get('bv_session')?.value
  if (!token) {
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
