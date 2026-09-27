import 'server-only'
import { getDB } from './mongodb'
import { ROLES, hasPermission, PERMISSIONS } from './permissions'
import { AuthenticationError, InvalidTokenError, TokenExpiredError, MissingCredentialsError, PermissionError } from './errors'
import { adminAuth } from './firebaseAdmin'
import { verifyFirebaseIdToken, getVerifiedFirebaseUser } from './firebaseAuthVerify'

// ---------------------------------------------------------------------------
// Battery Vital — Authentication & Session Layer (Firebase Auth + MongoDB Profiles)
// ---------------------------------------------------------------------------
// Passwords: Handled entirely by Firebase Auth (Google-managed, secure by default).
// Sessions: Firebase ID tokens (1h expiry, auto-refreshed by client SDK).
// MongoDB: Stores user PROFILES keyed by Firebase UID (firebaseUid field).
// NO password fields in MongoDB. Firebase Auth owns all credential logic.
// ---------------------------------------------------------------------------

/**
 * Verify a Firebase ID token and return the authenticated user's MongoDB profile.
 * This is the SINGLE authoritative auth check for all protected routes.
 * Fail-closed: any verification error throws InvalidTokenError/TokenExpiredError.
 */
export async function getSessionUser(request) {
  const authHeader = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  let token = match ? match[1] : null

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookieMatch = /(?:^|;\s*)bv_session=([^;]+)/.exec(cookieHeader)
    if (cookieMatch) token = decodeURIComponent(cookieMatch[1])
  }

  if (!token || token === 'bv_guest_session' || token === 'null' || token === 'undefined') {
    return GUEST_VIEWER_PRINCIPAL
  }

  try {
    if (!adminAuth) {
      throw new InvalidTokenError('Firebase Admin not initialized')
    }
    const decoded = await adminAuth.verifyIdToken(token, true) // checkRevoked = true
    const user = await findUser(decoded.uid)
    if (!user || user.status === 'disabled') return GUEST_VIEWER_PRINCIPAL
    return user
  } catch (err) {
    if (err instanceof InvalidTokenError || err instanceof TokenExpiredError) throw err
    if (err.code === 'auth/id-token-expired') throw new TokenExpiredError()
    if (err.code === 'auth/id-token-revoked') throw new InvalidTokenError('Token revoked')
    throw new InvalidTokenError(err.message || 'Invalid ID token')
  }
}

/**
 * Assert that the request principal holds a given permission.
 * Throws AuthenticationError (401) or PermissionError (403) accordingly.
 */
export async function requirePermission(request, permission) {
  const user = await getSessionUser(request)
  if (!hasPermission(user.role, permission)) {
    throw new PermissionError(
      `Forbidden: this action requires the "${permission}" permission.`,
      permission,
      user.role
    )
  }
  return user
}

/**
 * Verify a Firebase ID token without fetching MongoDB profile.
 * Used by middleware for quick checks.
 */
export async function verifyFirebaseIdTokenOnly(idToken) {
  if (!adminAuth) throw new InvalidTokenError('Firebase Admin not initialized')
  if (!idToken || typeof idToken !== 'string') throw new InvalidTokenError('Missing ID token')
  try {
    return await adminAuth.verifyIdToken(idToken, false) // checkRevoked = false for speed
  } catch (err) {
    if (err.code === 'auth/id-token-expired') throw new TokenExpiredError()
    if (err.code === 'auth/id-token-revoked') throw new InvalidTokenError('Token revoked')
    throw new InvalidTokenError(err.message || 'Invalid ID token')
  }
}

// ---------------------------------------------------------------------------
// User store — MongoDB profiles keyed by Firebase UID
// ---------------------------------------------------------------------------

export const GUEST_VIEWER_PRINCIPAL = {
  id: 'usr_guest',
  name: 'Guest Observer',
  email: 'guest@batteryvitals.local',
  role: ROLES.VIEWER,
  status: 'active',
}

const DEFAULT_USERS = [
  {
    id: 'usr_admin_01',
    name: 'Chief Battery Engineer',
    email: 'admin@example.com',
    role: ROLES.ADMIN,
    title: 'Lead Power Systems Engineer',
    department: 'Energy Storage & Safety',
    avatar: '🛡️',
    status: 'active',
    lastActive: new Date().toISOString(),
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'usr_op_02',
    name: 'Alex Rivera',
    email: 'operator@example.com',
    role: ROLES.OPERATOR,
    title: 'Field Operations Specialist',
    department: 'Hardware Telemetry & Maintenance',
    avatar: '⚡',
    status: 'active',
    lastActive: new Date().toISOString(),
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'usr_view_03',
    name: 'Elena Rostova',
    email: 'viewer@example.com',
    role: ROLES.VIEWER,
    title: 'Fleet Analytics Observer',
    department: 'Data Science & Reliability',
    avatar: '👁️',
    status: 'active',
    lastActive: new Date().toISOString(),
    createdAt: '2024-02-01T00:00:00Z',
  },
]

/**
 * Find user by Firebase UID (primary key) or email (fallback for migration).
 * Returns public profile (no password hash — Firebase owns credentials).
 */
export async function findUser(idOrEmail) {
  try {
    const db = await getDB()
    // Primary lookup: by Firebase UID
    let user = await db.collection('users').findOne({ firebaseUid: idOrEmail })
    if (!user && idOrEmail.includes('@')) {
      // Fallback: by email (for demo/migration accounts)
      user = await db.collection('users').findOne({ email: idOrEmail.toLowerCase() })
    }
    if (user) {
      const { passwordHash, ...safe } = user
      return { ...safe, id: user.id || user._id?.toString(), firebaseUid: user.firebaseUid }
    }
  } catch (e) {
    console.warn('[auth] findUser DB error:', e.message)
  }
  // Fallback to in-memory demo users
  const fallback = DEFAULT_USERS.find((u) => u.id === idOrEmail || u.email.toLowerCase() === idOrEmail.toLowerCase())
  return fallback || null
}

/**
 * Find user by email for backward compatibility (some routes may still call this).
 */
export async function findUserByCredentials(idOrEmail) {
  return findUser(idOrEmail)
}

/**
 * Get all users from MongoDB or fallback to in-memory store.
 * Never exposes password hashes (there aren't any in the new schema).
 */
export async function getUsers() {
  try {
    const db = await getDB()
    const users = await db.collection('users').find({}).toArray()
    if (users && users.length > 0) {
      return users.map((u) => {
        const { passwordHash, ...safe } = u
        return { ...safe, id: u.id || u._id?.toString(), firebaseUid: u.firebaseUid }
      })
    }
  } catch (e) {
    console.warn('[auth] getUsers DB error, falling back to memory:', e.message)
  }
  return DEFAULT_USERS.map(({ passwordHash, ...safe }) => safe)
}

/**
 * Create a new MongoDB profile keyed by Firebase UID.
 * NO password field — Firebase Auth owns credentials.
 * Caller must provide firebaseUid from verified Firebase Auth token.
 */
export async function createUser(userData) {
  const { firebaseUid, ...profileData } = userData

  if (!firebaseUid) {
    throw new Error('firebaseUid is required to create user profile')
  }

  const newUser = {
    firebaseUid,
    name: profileData.name || 'Team Member',
    email: profileData.email,
    role: profileData.role || ROLES.VIEWER,
    title: profileData.title || 'Battery Specialist',
    department: profileData.department || 'Operations',
    avatar: profileData.role === ROLES.ADMIN ? '🛡️' : profileData.role === ROLES.OPERATOR ? '⚡' : '👁️',
    status: profileData.status || 'active',
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  try {
    const db = await getDB()
    const result = await db.collection('users').insertOne(newUser)
    const { passwordHash, ...safe } = newUser
    return { ...safe, id: result.insertedId.toString(), firebaseUid }
  } catch (e) {
    console.warn('[auth] createUser DB error:', e.message)
    // Fallback to memory
    return { ...newUser, id: `usr_${Date.now().toString(36)}` }
  }
}

/**
 * Update user profile (role, name, etc.). NO password updates — Firebase Auth owns that.
 */
export async function updateUser(id, updates) {
  const { password, firebaseUid, ...safeUpdates } = updates
  if (firebaseUid) delete safeUpdates.firebaseUid // immutable

  try {
    const db = await getDB()
    await db.collection('users').updateOne(
      { firebaseUid: id },
      { $set: { ...safeUpdates, lastActive: new Date().toISOString() } }
    )
  } catch (e) {
    console.warn('[auth] updateUser DB error:', e.message)
  }
  return findUser(id)
}

/**
 * Delete user profile by Firebase UID.
 */
export async function deleteUser(id) {
  try {
    const db = await getDB()
    await db.collection('users').deleteOne({ firebaseUid: id })
  } catch (e) {
    console.warn('[auth] deleteUser DB error:', e.message)
  }
  return true
}

/**
 * Revoke all sessions for a user (called on logout, role change, etc.).
 * Uses Firebase Admin SDK to revoke all refresh tokens for the UID.
 */
export async function revokeAllUserSessions(firebaseUid) {
  if (!adminAuth) return false
  try {
    await adminAuth.revokeRefreshTokens(firebaseUid)
    return true
  } catch (e) {
    console.warn('[auth] revokeAllUserSessions failed:', e.message)
    return false
  }
}

// Keep for backward compatibility (no-op since we don't use MongoDB sessions anymore)
export async function revokeSessionByToken(token) {
  if (!token || !token.includes('.')) return false
  try {
    const decoded = await adminAuth?.verifyIdToken(token, false)
    if (decoded?.uid) {
      return revokeAllUserSessions(decoded.uid)
    }
  } catch (e) {}
  return false
}

// Re-export Firebase Auth verification functions
export { verifyFirebaseIdToken, getVerifiedFirebaseUser } from './firebaseAuthVerify'

// Re-export permissions
export { PERMISSIONS }