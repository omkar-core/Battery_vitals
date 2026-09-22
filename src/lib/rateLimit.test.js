import { describe, it, expect } from 'vitest'
import { checkRateLimit, getClientIp } from './rateLimit'

describe('rateLimit — sliding window', () => {
  it('allows requests up to the window maximum', () => {
    const id = `rl_allow_${Date.now()}_${Math.random()}`
    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(id, 5, 60000)
      expect(res.success).toBe(true)
    }
    // sixth call in the same window must be denied
    const denied = checkRateLimit(id, 5, 60000)
    expect(denied.success).toBe(false)
    expect(denied.remaining).toBe(0)
    expect(denied.resetTime).toBeGreaterThan(Date.now())
  })

  it('creates independent buckets per identifier', () => {
    const a = `rl_a_${Date.now()}_${Math.random()}`
    const b = `rl_b_${Date.now()}_${Math.random()}`
    for (let i = 0; i < 3; i++) checkRateLimit(a, 3, 60000)
    expect(checkRateLimit(a, 3, 60000).success).toBe(false)
    expect(checkRateLimit(b, 3, 60000).success).toBe(true)
  })

  it('refreshes the window once it expires', async () => {
    const id = `rl_reset_${Date.now()}_${Math.random()}`
    checkRateLimit(id, 1, 5) // 5ms window, consumed immediately
    await new Promise((r) => setTimeout(r, 20)) // window has definitely expired
    const after = checkRateLimit(id, 1, 5)
    expect(after.success).toBe(true)
    expect(after.remaining).toBe(0)
  })
})

describe('rateLimit — client IP extraction', () => {
  const req = (headers) => ({ headers: { get: (k) => headers[k] || null } })

  it('prefers the first x-forwarded-for entry', () => {
    const ip = getClientIp(req({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))
    expect(ip).toBe('203.0.113.9')
  })

  it('falls back to x-real-ip', () => {
    const ip = getClientIp(req({ 'x-real-ip': '198.51.100.7' }))
    expect(ip).toBe('198.51.100.7')
  })

  it('returns loopback when no header is present', () => {
    expect(getClientIp(req({}))).toBe('127.0.0.1')
    expect(getClientIp(null)).toBe('127.0.0.1')
  })
})