import { NextResponse } from 'next/server'

// Login is now handled client-side via Firebase Auth SDK (signInWithEmailAndPassword).
// This endpoint is intentionally disabled — the server no longer verifies passwords.
// 
// WHY: Firebase Auth is the sole identity provider. It handles password hashing,
// rate limiting, brute-force protection, and session management (ID tokens).
// The server only verifies Firebase ID tokens via Firebase Admin SDK.

export const dynamic = 'force-dynamic'

export async function POST(request) {
  return NextResponse.json(
    { 
      error: 'Login is handled client-side via Firebase Auth. Use signInWithEmailAndPassword from firebase/auth.',
      code: 'USE_CLIENT_AUTH' 
    },
    { status: 410 }
  )
}