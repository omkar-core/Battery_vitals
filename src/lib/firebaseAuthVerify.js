import 'server-only'
import { adminAuth } from './firebaseAdmin'
import { InvalidTokenError, TokenExpiredError } from './errors'

/**
 * Verify a Firebase ID token using Firebase Admin SDK.
 * Returns the decoded token payload (including uid, email, etc.).
 * Throws InvalidTokenError (401) or TokenExpiredError (401) on failure.
 * 
 * WHY: Firebase Admin SDK's verifyIdToken is the only secure way to verify
 * Firebase ID tokens on the server. It checks signature, expiration, audience,
 * and revocation status against Google's servers. We never trust client-provided
 * tokens without this verification.
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!adminAuth) {
    throw new InvalidTokenError('Firebase Admin not initialized')
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new InvalidTokenError('Missing ID token')
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true) // checkRevoked = true
    return decoded
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      throw new TokenExpiredError()
    }
    if (err.code === 'auth/id-token-revoked') {
      throw new InvalidTokenError('Token revoked')
    }
    throw new InvalidTokenError(err.message || 'Invalid ID token')
  }
}

/**
 * Extract and verify Firebase ID token from request headers.
 * Supports both Authorization: Bearer <token> and cookie fallback.
 * Returns { uid, email, ...decodedClaims } on success.
 * Throws on verification failure.
 * 
 * WHY: Centralizes token extraction + verification so every API route
 * uses the same logic. Fail-closed: any verification error becomes 401.
 */
export async function getVerifiedFirebaseUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  let idToken = match ? match[1] : null

  // Fallback to cookie (for browser-initiated requests)
  if (!idToken) {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookieMatch = /(?:^|;\s*)bv_session=([^;]+)/.exec(cookieHeader)
    if (cookieMatch) {
      idToken = decodeURIComponent(cookieMatch[1])
    }
  }

  if (!idToken || idToken === 'bv_guest_session') {
    return null // Not authenticated
  }

  return verifyFirebaseIdToken(idToken)
}