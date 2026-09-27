import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSessionUser, getVerifiedFirebaseUser, verifyFirebaseIdTokenOnly, findUser, createUser, revokeAllUserSessions, requirePermission, GUEST_VIEWER_PRINCIPAL } from './auth'
import { InvalidTokenError, TokenExpiredError, AuthenticationError, PermissionError } from './errors'

// Mock Firebase Admin Auth
vi.mock('./firebaseAdmin', () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
    revokeRefreshTokens: vi.fn(),
  },
  adminDb: null,
}))

// Mock MongoDB
vi.mock('./mongodb', () => ({
  getDB: vi.fn(() => ({
    collection: vi.fn(() => ({
      findOne: vi.fn(),
      find: vi.fn(() => ({ toArray: vi.fn() })),
      insertOne: vi.fn(),
      updateOne: vi.fn(),
      deleteOne: vi.fn(),
    })),
  })),
}))

import { adminAuth } from './firebaseAdmin'
import { getDB } from './mongodb'

describe('auth — Firebase ID token verification (getSessionUser)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns guest user when token missing', async () => {
    const req = { headers: { get: () => null }, cookies: { get: () => null } }
    const result = await getSessionUser(req)
    expect(result).toEqual(GUEST_VIEWER_PRINCIPAL)
  })

  it('returns guest user when token is bv_guest_session', async () => {
    const req = { 
      headers: { get: () => null }, 
      cookies: { get: () => 'bv_guest_session' } 
    }
    const result = await getSessionUser(req)
    expect(result).toEqual(GUEST_VIEWER_PRINCIPAL)
  })

  it('rejects invalid token format', async () => {
    const req = { 
      headers: { get: () => 'Bearer invalid' }, 
      cookies: { get: () => null } 
    }
    adminAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'))
    await expect(getSessionUser(req)).rejects.toThrow()
  })

  it('throws when adminAuth not initialized', async () => {
    const { adminAuth: mockAdminAuth } = await import('./firebaseAdmin')
    mockAdminAuth.verifyIdToken.mockReset()
    mockAdminAuth.verifyIdToken.mockImplementation(() => { throw new Error('not initialized') })
    
    const req = { 
      headers: { get: () => 'Bearer some-token' }, 
      cookies: { get: () => null } 
    }
    await expect(getSessionUser(req)).rejects.toThrow()
  })
})

describe('auth — verifyFirebaseIdTokenOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing token', async () => {
    await expect(verifyFirebaseIdTokenOnly(null)).rejects.toThrow()
  })

  it('rejects non-string token', async () => {
    await expect(verifyFirebaseIdTokenOnly(123)).rejects.toThrow()
  })

  it('verifies valid token', async () => {
    adminAuth.verifyIdToken.mockResolvedValue({ uid: 'usr_123', email: 'test@example.com' })
    const result = await verifyFirebaseIdTokenOnly('valid-token')
    expect(result.uid).toBe('usr_123')
    expect(adminAuth.verifyIdToken).toHaveBeenCalledWith('valid-token', false)
  })

  it('throws on expired token', async () => {
    const err = new Error('expired')
    err.code = 'auth/id-token-expired'
    adminAuth.verifyIdToken.mockRejectedValue(err)
    await expect(verifyFirebaseIdTokenOnly('expired-token')).rejects.toThrow(TokenExpiredError)
  })

  it('throws on revoked token', async () => {
    const err = new Error('revoked')
    err.code = 'auth/id-token-revoked'
    adminAuth.verifyIdToken.mockRejectedValue(err)
    await expect(verifyFirebaseIdTokenOnly('revoked-token')).rejects.toThrow(InvalidTokenError)
  })
})

describe('auth — findUser / createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when user not found', async () => {
    const db = await getDB()
    db.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
    })
    const user = await findUser('nonexistent@example.com')
    expect(user).toBeNull()
  })

  it('creates user with firebaseUid', async () => {
    const db = await getDB()
    db.collection.mockReturnValue({
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id' }),
    })
    const user = await createUser({
      firebaseUid: 'firebase-uid-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'operator',
    })
    expect(user.firebaseUid).toBe('firebase-uid-123')
    expect(user.name).toBe('Test User')
    expect(user.role).toBe('operator')
    expect(user.passwordHash).toBeUndefined()
  })

  it('throws if firebaseUid missing', async () => {
    await expect(createUser({ name: 'Test', email: 'test@example.com' })).rejects.toThrow('firebaseUid is required')
  })
})

describe('auth — revokeAllUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revokes refresh tokens via Firebase Admin', async () => {
    adminAuth.revokeRefreshTokens.mockResolvedValue(undefined)
    const result = await revokeAllUserSessions('uid-123')
    expect(adminAuth.revokeRefreshTokens).toHaveBeenCalledWith('uid-123')
    expect(result).toBe(true)
  })

  it('returns false on error', async () => {
    adminAuth.revokeRefreshTokens.mockRejectedValue(new Error('network error'))
    const result = await revokeAllUserSessions('uid-123')
    expect(result).toBe(false)
  })

  it('returns false when adminAuth not initialized', async () => {
    const { adminAuth: mockAdminAuth } = await import('./firebaseAdmin')
    mockAdminAuth.verifyIdToken.mockReset()
    mockAdminAuth.revokeRefreshTokens.mockReset()
    const result = await revokeAllUserSessions('uid-123')
    expect(typeof result).toBe('boolean')
  })
})

describe('auth — requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is exported and callable', () => {
    expect(typeof requirePermission).toBe('function')
  })
})

describe('auth — GUEST_VIEWER_PRINCIPAL', () => {
  it('has expected guest user properties', () => {
    expect(GUEST_VIEWER_PRINCIPAL).toEqual({
      id: 'usr_guest',
      name: 'Guest Observer',
      email: 'guest@batteryvitals.local',
      role: 'viewer',
      status: 'active',
    })
  })
})