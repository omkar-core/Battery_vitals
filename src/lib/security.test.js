import { describe, it, expect } from 'vitest'
import { sanitizeString, sanitizeNumber, isValidCommand, secureErrorResponse } from './security'

let devState = process.env.NODE_ENV

describe('security — sanitizeString (XSS / NoSQL injection defense)', () => {
  it('strips script tags entirely', () => {
    expect(sanitizeString('<script>alert(1)</script>hello')).toBe('hello')
    expect(sanitizeString('<script src="x"></script>')).toBe('')
  })

  it('strips generic HTML tags and javascript: URLs', () => {
    expect(sanitizeString('a<b>bold</b>')).toBe('abold')
    expect(sanitizeString('click javascript:alert(1)')).toBe('click alert(1)')
  })

  it('removes $ characters to defeat NoSQL operator injection', () => {
    expect(sanitizeString('{"$gt": 1}')).toBe('{"gt": 1}')
    expect(sanitizeString('$where')).toBe('where')
  })

  it('enforces the maximum length', () => {
    expect(sanitizeString('x'.repeat(600), 100)).toBe('x'.repeat(100))
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeString(42)).toBe('')
    expect(sanitizeString(null)).toBe('')
  })
})

describe('security — sanitizeNumber (clamping to plausible bounds)', () => {
  it('clamps out-of-range values to the fallback', () => {
    expect(sanitizeNumber(200, 0, 100)).toBeNull()
    expect(sanitizeNumber(-5, 0, 100)).toBeNull()
  })

  it('returns fallback for NaN / Infinity / empty input', () => {
    expect(sanitizeNumber(NaN, 0, 100)).toBeNull()
    expect(sanitizeNumber(Infinity, 0, 100, 0)).toBe(0)
    expect(sanitizeNumber('', 0, 100)).toBeNull()
    expect(sanitizeNumber(null, 0, 100)).toBeNull()
  })

  it('accepts in-range values and string numbers within the window', () => {
    expect(sanitizeNumber(12.6, 0, 100)).toBe(12.6)
    expect(sanitizeNumber('9.8', 0, 100)).toBe(9.8)
  })
})

describe('security — hardware command allowlist', () => {
  it('accepts known commands case-insensitively', () => {
    expect(isValidCommand('LED_MODE')).toBe(true)
    expect(isValidCommand('set_config')).toBe(true)
    expect(isValidCommand('Mute_Buzzer')).toBe(true)
  })

  it('rejects unknown or unsafe commands', () => {
    expect(isValidCommand('DELETE FROM users')).toBe(false)
    expect(isValidCommand('reboot --insecure')).toBe(false)
    expect(isValidCommand('')).toBe(false)
    expect(isValidCommand(null)).toBe(false)
    expect(isValidCommand(42)).toBe(false)
  })
})

describe('security — secure error responses', () => {
  it('does not leak internal error details in production', async () => {
    process.env.NODE_ENV = 'production'
    const res = secureErrorResponse('DB_FAIL: mongodb+srv://secret', 500)
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(JSON.stringify(body)).not.toContain('mongodb+srv')
    expect(body.error).toContain('not be processed safely')
    process.env.NODE_ENV = devState
  })

  it('keeps the developer message in development only', async () => {
    process.env.NODE_ENV = 'development'
    const res = secureErrorResponse('Validation failed on field x', 422)
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Validation failed')
    process.env.NODE_ENV = devState
  })
})