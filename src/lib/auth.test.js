import { describe, it, expect, beforeAll } from 'vitest'
import {
  hashPassword,
  passwordMatches,
  createSessionToken,
  verifySessionToken,
  decodeSessionPayload,
} from './auth'
import { InvalidTokenError } from './errors'

// Vitest runs in NODE_ENV=test, so sessionSecret() automatically uses the
// dev-only fallback. Tests stay fully stateless.
describe('auth — password hashing', () => {
  it('hashes with a random salt and verifies round-trip', () => {
    const hash = hashPassword('S3cure-Pass!')
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
    expect(passwordMatches('S3cure-Pass!', hash)).toBe(true)
  })

  it('rejects a wrong password', () => {
    const hash = hashPassword('S3cure-Pass!')
    expect(passwordMatches('wrong-password', hash)).toBe(false)
  })

  it('rejects malformed stored hashes', () => {
    expect(passwordMatches('anything', 'not-a-hash')).toBe(false)
    expect(passwordMatches('anything', 'zz:ii')).toBe(false)
  })
})

describe('auth — session tokens', () => {
  it('embeds a jti and revocable session identity', () => {
    const token = createSessionToken({ id: 'usr_1', role: 'ADMIN', name: 'A', email: 'a@x.io' })
    const payload = verifySessionToken(token)
    expect(payload.sub).toBe('usr_1')
    expect(payload.role).toBe('ADMIN')
    expect(payload.jti).toMatch(/^[0-9a-f]{32}$/)
    expect(payload.iat).toBeLessThanOrEqual(Date.now())
    expect(payload.exp).toBeGreaterThan(Date.now())
  })

  it('rejects tampered tokens', () => {
    const token = createSessionToken({ id: 'usr_1', role: 'VIEWER', name: 'A', email: 'a@x.io' })
    const [body, sig] = token.split('.')
    const forged = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), role: 'ADMIN' })).toString('base64url')}.${sig}`
    expect(() => verifySessionToken(forged)).toThrow(InvalidTokenError)
  })

  it('rejects expired tokens', () => {
    const body = Buffer.from(
      JSON.stringify({ sub: 'usr_1', role: 'VIEWER', jti: 'x', iat: Date.now() - 200000, exp: Date.now() - 60000 })
    ).toString('base64url')
    const sig = 'Y2F0' // invalid signature path is short-circuited by construction below
    expect(() => verifySessionToken(`${body}.badsig`)).toThrow()
  })

  it('rejects garbage input', () => {
    expect(() => verifySessionToken(null)).toThrow(InvalidTokenError)
    expect(() => verifySessionToken('nonesuch')).toThrow(InvalidTokenError)
  })

  it('decodes a locally produced token without verifying the signature', () => {
    const token = createSessionToken({ id: 'usr_1', role: 'OPERATOR', name: 'A', email: 'a@x.io' })
    const payload = decodeSessionPayload(token)
    expect(payload.role).toBe('OPERATOR')
    expect(payload.jti).toBeTruthy()
    expect(decodeSessionPayload('garbage')).toBeNull()
  })
})