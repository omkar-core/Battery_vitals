import 'server-only'
import crypto from 'crypto'
import { getDB } from './mongodb'
import { ROLES, hasPermission, PERMISSIONS } from './permissions'
import { AuthenticationError, InvalidTokenError, TokenExpiredError, MissingCredentialsError, PermissionError } from './errors'

// ---------------------------------------------------------------------------
// Battery Vital — Authentication & Session Layer
// Passwords: PBKDF2-style scrypt hashing (Node stdlib, no external deps).
// Sessions: HMAC-SHA256 signed tokens (stateless, expiring).
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12h
const SALT_BYTES = 16
const KEY_LENGTH = 64

// Demo bootstrap credential used ONLY when a user row has no stored hash
// (e.g. first-run seed in MongoDB). Never used as a session secret.
export const DEFAULT_USER_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'BatteryVital-2026'

function sessionSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_TOKEN_SECRET must be set to a value of at least 32 chars in production.')
  }
  if (!process.env.AUTH_TOKEN_SECRET) {
    console.warn('[auth] AUTH_TOKEN_SECRET not set; using dev-only fallback secret. Set it before deploying.')
  }
  return process.env.AUTH_TOKEN_SECRET || 'battery-vital-dev-secret-do-not-use-in-prod-0123456789abcdef'
}

// ------------------------- Password hashing -------------------------------

export function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex')
  const derived = crypto.scryptSync(String(password), salt, KEY_LENGTH).toString('hex')
  return `${salt}:${derived}`
}

export function passwordMatches(password, storedHash) {
  if (!storedHash || storedHash === DEFAULT_USER_PASSWORD || !storedHash.includes(':')) {
    // Seeded/demo users may store the plain boot credential fingerprint only.
    return timingSafeEqualStrings(String(password), DEFAULT_USER_PASSWORD)
  }
  const [salt, expectedHex] = storedHash.split(':')
  if (!salt || !/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(expectedHex)) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const candidate = crypto.scryptSync(String(password), salt, KEY_LENGTH)
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// --------------------------- Session tokens -------------------------------

function base64Url(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function sign(payload) {
  const body = base64Url(payload)
  const sig = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function createSessionToken(user) {
  return sign({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    jti: crypto.randomBytes(16).toString('hex'),
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  })
}

/**
 * Decode a token payload without verifying the signature. Use only on tokens
 * produced locally in the same request (e.g. login), never on external input.
 */
export function decodeSessionPayload(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  try {
    return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'))
  } catch (e) {
    return null
  }
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new InvalidTokenError()
  }
  const [body, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  const userSig = Buffer.from(sig)
  const expectedSig = Buffer.from(expected)
  if (userSig.length !== expectedSig.length || !crypto.timingSafeEqual(userSig, expectedSig)) {
    throw new InvalidTokenError()
  }
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch (e) {
    throw new InvalidTokenError()
  }
  if (!payload.sub || payload.exp == null || !payload.role) throw new InvalidTokenError()
  if (Date.now() > payload.exp) throw new TokenExpiredError(payload.exp)
  return payload
}

/**
 * Persist a session record so tokens can be revoked server-side on logout
 * (SECURITY.md §6). Best-effort: a DB failure must not block login.
 */
export async function recordSession(payload) {
  try {
    const db = await getDB()
    await db.collection('sessions').updateOne(
      { jti: payload.jti },
      {
        $set: {
          jti: payload.jti,
          sub: payload.sub,
          role: payload.role,
          name: payload.name || null,
          email: payload.email || null,
          createdAt: new Date(payload.iat).toISOString(),
          expiresAt: new Date(payload.exp).toISOString(),
          revoked: false,
        },
      },
      { upsert: true }
    )
  } catch (e) {
    console.warn('[auth] recordSession failed (best-effort):', e.message)
  }
}

/**
 * Fail-closed revocation check: a token must have an active, non-revoked,
 * unexpired session record in MongoDB. If the store is unreachable we reject
 * rather than risk replaying a revoked token.
 */
async function assertSessionActive(payload) {
  try {
    const db = await getDB()
    await db.collection('sessions').createIndex({ jti: 1 }).catch(() => {})
    const session = await db.collection('sessions').findOne({ jti: payload.jti })
    if (!session || session.revoked === true) throw new InvalidTokenError()
    if (Date.now() > new Date(session.expiresAt).getTime()) throw new TokenExpiredError(payload.exp)
  } catch (error) {
    if (error instanceof InvalidTokenError || error instanceof TokenExpiredError) throw error
    console.warn('[auth] session store unreachable; rejecting token (fail-closed):', error.message)
    throw new InvalidTokenError()
  }
}

/**
 * Revoke a session by its raw signed token (used by /api/auth/logout).
 */
export async function revokeSessionByToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false
  const body = token.split('.')[0]
  let payload = null
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch (e) {
    return false
  }
  if (!payload.jti) return false
  try {
    const db = await getDB()
    await db.collection('sessions').updateOne({ jti: payload.jti }, { $set: { revoked: true, revokedAt: new Date().toISOString() } })
    return true
  } catch (e) {
    console.warn('[auth] revokeSessionByToken failed:', e.message)
    return false
  }
}

function getCookieFromRequest(request, name) {
  if (request?.cookies?.get) {
    const val = request.cookies.get(name)?.value
    if (val) return val
  }
  const cookieHeader = request?.headers?.get?.('cookie') || ''
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(cookieHeader)
  return match ? decodeURIComponent(match[1]) : ''
}

const GUEST_VIEWER_PRINCIPAL = {
  id: 'usr_guest',
  name: 'Guest Observer',
  email: 'guest@batteryvitals.local',
  role: ROLES.VIEWER,
  status: 'active',
}

/**
 * Resolve the authenticated user from an incoming request.
 * Reads `Authorization: Bearer <token>` or `bv_session` cookie.
 * Defaults to guest viewer with safe read-only permissions when unauthenticated.
 */
export async function getSessionUser(request) {
  const header = request?.headers?.get?.('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const cookieToken = getCookieFromRequest(request, 'bv_session')
  const token = match ? match[1] : cookieToken

  if (!token || token === 'bv_guest_session' || token === 'null' || token === 'undefined') {
    return GUEST_VIEWER_PRINCIPAL
  }

  try {
    const payload = verifySessionToken(token)
    await assertSessionActive(payload)
    const user = await findUser(payload.sub)
    if (!user || user.status === 'disabled') return GUEST_VIEWER_PRINCIPAL
    return user
  } catch (err) {
    // If bearer token was explicitly provided in header and is invalid/expired, throw
    if (match) throw err
    return GUEST_VIEWER_PRINCIPAL
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

// --------------------------- User store -----------------------------------

export const DEFAULT_USERS = [
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

let inMemoryUsers = [...DEFAULT_USERS]

/**
 * Fetch all users from MongoDB or fallback to in-memory store.
 * Never expose password hashes to callers.
 */
export async function getUsers() {
  try {
    const db = await getDB()
    const users = await db.collection('users').find({}).toArray()
    if (users && users.length > 0) {
      return users.map((u) => {
        const { passwordHash, ...safe } = u
        return { ...safe, id: u.id || u._id?.toString() }
      })
    }
  } catch (e) {
    // Fall back to memory store
  }
  return inMemoryUsers.map(({ passwordHash, ...safe }) => safe)
}

/**
 * Raw (including credential hashes when present) user lookup for auth checks.
 */
export async function findUserByCredentials(idOrEmail) {
  try {
    const db = await getDB()
    const user = await db.collection('users').findOne({
      $or: [{ id: idOrEmail }, { email: idOrEmail.toLowerCase() }],
    })
    if (user) return { ...user, id: user.id || user._id?.toString() }
  } catch (e) {
    // fall through to in-memory store
  }
  return inMemoryUsers.find((u) => u.id === idOrEmail || u.email.toLowerCase() === idOrEmail.toLowerCase()) || null
}

/**
 * Find user by ID or Email (public shape; never leaks hashes).
 */
export async function findUser(idOrEmail) {
  const user = await findUserByCredentials(idOrEmail)
  if (!user) return null
  const { passwordHash, ...safe } = user
  return safe
}

/**
 * Create or register a new user. Stores a scrypt hash of `userData.password`
 * or the boot credential when no password is supplied.
 */
export async function createUser(userData) {
  const passwordHash = userData.password
    ? hashPassword(userData.password)
    : hashPassword(DEFAULT_USER_PASSWORD)
  const newUser = {
    id: userData.id || `usr_${Date.now().toString(36)}`,
    name: userData.name || 'Team Member',
    email: userData.email,
    role: userData.role || ROLES.VIEWER,
    title: userData.title || 'Battery Specialist',
    department: userData.department || 'Operations',
    avatar: userData.role === ROLES.ADMIN ? '🛡️' : userData.role === ROLES.OPERATOR ? '⚡' : '👁️',
    status: userData.status || 'active',
    lastActive: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    passwordHash,
  }
  const newUserRaw = { ...newUser }

  try {
    const db = await getDB()
    await db.collection('users').insertOne(newUserRaw)
  } catch (e) {
    inMemoryUsers.push(newUserRaw)
  }

  const { passwordHash: _drop, ...publicUser } = newUserRaw
  return publicUser
}

/**
 * Update user profile or role.
 */
export async function updateUser(id, updates) {
  const { password, ...safeUpdates } = updates
  const setFields = { ...safeUpdates }
  if (password) setFields.passwordHash = hashPassword(password)

  try {
    const db = await getDB()
    await db.collection('users').updateOne({ id }, { $set: setFields })
  } catch (e) {
    inMemoryUsers = inMemoryUsers.map((u) => (u.id === id ? { ...u, ...setFields } : u))
  }
  return findUser(id)
}

/**
 * Delete a user.
 */
export async function deleteUser(id) {
  try {
    const db = await getDB()
    await db.collection('users').deleteOne({ id })
  } catch (e) {
    inMemoryUsers = inMemoryUsers.filter((u) => u.id !== id)
  }
  return true
}

export { PERMISSIONS }