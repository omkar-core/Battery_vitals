// Deterministic unit tests for the ERROR_HANDLING.md modules:
//   - src/lib/errors.js       (error taxonomy §2.1)
//   - src/lib/retry.js        (exponential backoff §4.1)
//   - src/lib/circuitBreaker.js (circuit breaker §4.2)
import { describe, it, expect } from 'vitest'
import {
  BatteryVitalError,
  ValidationError,
  AuthenticationError,
  InvalidTokenError,
  TokenExpiredError,
  MissingCredentialsError,
  PermissionError,
  RoleRestrictionError,
  HardwareSafetyError,
  CriticalStateLockError,
  InputOutOfRangeError,
  NotFoundError,
  RateLimitError,
  AIAnalysisRateLimitError,
  ControlCommandRateLimitError,
  ExportRateLimitError,
  MongoDBError,
  GeminiTimeoutError,
  GeminiInvalidResponseError,
  NetworkError,
  CommandTimeoutError,
  InvalidBatteryStateError,
  InsufficientDataError,
  RequiredFieldMissingError,
} from './errors'
import { retryWithBackoff, isRetryable } from './retry'
import { CircuitBreaker } from './circuitBreaker'

describe('errors — base BatteryVitalError', () => {
  it('defaults to UNKNOWN_ERROR with status 500', () => {
    const e = new BatteryVitalError('boom')
    expect(e.code).toBe('UNKNOWN_ERROR')
    expect(e.statusCode).toBe(500)
    expect(e.name).toBe('BatteryVitalError')
    expect(Number.isNaN(Date.parse(e.timestamp))).toBe(false)
  })

  it('toJSON exposes only safe public fields', () => {
    const e = new BatteryVitalError('boom', 'TEST', 400, { requestId: 'req_1' })
    const json = e.toJSON()
    expect(json.code).toBe('TEST')
    expect(json.statusCode).toBe(400)
    expect(json.requestId).toBe('req_1')
    expect(json.stack).toBeUndefined()
  })
})

describe('errors — taxonomy codes & status maps', () => {
  const cases = [
    [ValidationError, 'VALIDATION_ERROR', 400],
    [AuthenticationError, 'UNAUTHORIZED', 401],
    [InvalidTokenError, 'INVALID_TOKEN', 401],
    [TokenExpiredError, 'TOKEN_EXPIRED', 401],
    [MissingCredentialsError, 'MISSING_CREDENTIALS', 401],
    [PermissionError, 'FORBIDDEN', 403],
    [RoleRestrictionError, 'ROLE_RESTRICTED', 403],
    [HardwareSafetyError, 'HARDWARE_SAFETY_ERROR', 403],
    [CriticalStateLockError, 'CRITICAL_STATE_LOCK', 403],
    [NotFoundError, 'NOT_FOUND', 404],
    [InputOutOfRangeError, 'OUT_OF_RANGE', 400],
    [MongoDBError, 'MONGODB_ERROR', 500],
    [GeminiTimeoutError, 'GEMINI_TIMEOUT', 503],
    [GeminiInvalidResponseError, 'GEMINI_INVALID_RESPONSE', 503],
    [NetworkError, 'NETWORK_ERROR', 503],
    [CommandTimeoutError, 'COMMAND_TIMEOUT', 500],
    [InvalidBatteryStateError, 'INVALID_BATTERY_STATE', 409],
    [InsufficientDataError, 'INSUFFICIENT_DATA', 422],
  ]

  for (const [Ctor, code, status] of cases) {
    it(`${Ctor.name} → ${code} (${status})`, () => {
      const e = new Ctor('anything')
      expect(e.code).toBe(code)
      expect(e.statusCode).toBe(status)
    })
  }
})

describe('errors — specialized fields', () => {
  it('RateLimitError computes retryAfter from resetAt', () => {
    const e = new RateLimitError(60, 60000, Date.now() + 5000)
    expect(e.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(e.limit).toBe(60)
    expect(e.window).toBe(60000)
    expect(e.retryAfter).toBeLessThanOrEqual(6)
    expect(e.retryAfter).toBeGreaterThan(0)
  })

  it('rate-limit subclasses pin their documented limits and endpoints', () => {
    const ai = new AIAnalysisRateLimitError(Date.now() + 10000)
    expect(ai.endpoint).toBe('/api/analyze')
    expect(ai.code).toBe('AI_RATE_LIMIT')

    const ctl = new ControlCommandRateLimitError(Date.now() + 10000)
    expect(ctl.endpoint).toBe('/api/control/*')
    expect(ctl.code).toBe('CONTROL_RATE_LIMIT')

    const exp = new ExportRateLimitError(Date.now() + 10000)
    expect(exp.limit).toBe(10)
    expect(exp.window).toBe(3600000)
    expect(exp.code).toBe('EXPORT_RATE_LIMIT')
  })

  it('CriticalStateLockError pins the offending state and action', () => {
    const e = new CriticalStateLockError('CRITICAL', 'buzzer off')
    expect(e.batteryStatus).toBe('CRITICAL')
    expect(e.attemptedAction).toBe('buzzer off')
    expect(e.constraint).toBe('CRITICAL_STATE_LOCK')
  })

  it('RequiredFieldMissingError and InputOutOfRangeError carry field details', () => {
    const missing = new RequiredFieldMissingError('deviceId')
    expect(missing.field).toBe('deviceId')
    expect(missing.code).toBe('REQUIRED_FIELD_MISSING')

    const range = new InputOutOfRangeError('voltage', 999, 0.5, 100)
    expect(range.min).toBe(0.5)
    expect(range.max).toBe(100)
    expect(range.code).toBe('OUT_OF_RANGE')
  })
})

describe('retry — isRetryable classification', () => {
  it('retries documented transient codes', () => {
    expect(isRetryable({ code: 'NETWORK_ERROR' })).toBe(true)
    expect(isRetryable({ code: 'CONNECTION_TIMEOUT' })).toBe(true)
    expect(isRetryable({ code: 'SERVICE_UNAVAILABLE' })).toBe(true)
    expect(isRetryable({ code: 'MONGODB_CONNECTION_ERROR' })).toBe(true)
    expect(isRetryable({ code: 'FIREBASE_ERROR' })).toBe(true)
    expect(isRetryable({ code: 'GEMINI_TIMEOUT' })).toBe(true)
  })

  it('retries HTTP 503/504/408 regardless of code', () => {
    expect(isRetryable({ statusCode: 503 })).toBe(true)
    expect(isRetryable({ statusCode: 504 })).toBe(true)
    expect(isRetryable({ statusCode: 408 })).toBe(true)
    expect(isRetryable({ statusCode: 500 })).toBe(false)
  })
})

describe('retry — retryWithBackoff', () => {
  it('returns first success immediately', async () => {
    const fn = () => Promise.resolve('ok')
    await expect(retryWithBackoff(fn)).resolves.toBe('ok')
  })

  it('retries a transient failure a bounded number of times', async () => {
    let calls = 0
    const flaky = async () => {
      calls++
      if (calls < 3) throw Object.assign(new Error('flaky'), { code: 'NETWORK_ERROR' })
      return 'recovered'
    }
    await expect(retryWithBackoff(flaky, { initialDelayMs: 1, maxDelayMs: 5 })).resolves.toBe('recovered')
    expect(calls).toBe(3)
  })

  it('does not retry non-retryable errors', async () => {
    let calls = 0
    const fn = async () => {
      calls++
      throw Object.assign(new Error('bad'), { code: 'VALIDATION_ERROR' })
    }
    await expect(retryWithBackoff(fn, { maxAttempts: 3 })).rejects.toThrow('bad')
    expect(calls).toBe(1)
  })

  it('gives up after maxAttempts', async () => {
    let calls = 0
    const always = async () => {
      calls++
      throw Object.assign(new Error('nope'), { code: 'NETWORK_ERROR' })
    }
    await expect(
      retryWithBackoff(always, { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5 })
    ).rejects.toThrow('nope')
    expect(calls).toBe(3)
  })
})

describe('circuitBreaker — CircuitBreaker', () => {
  it('opens after the failure threshold and returns fallback', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2, resetTimeoutMs: 60000 })
    await cb.execute(() => Promise.resolve('ok')).then((r) => expect(r).toBe('ok'))

    const fail = () => Promise.reject(new Error('down'))
    await expect(cb.execute(fail)).rejects.toThrow('down')
    expect(cb.state).toBe('CLOSED') // 1 failure < threshold

    await expect(cb.execute(fail)).rejects.toThrow('down')
    expect(cb.state).toBe('OPEN')
    expect(cb.failureCount).toBe(2)

    await expect(cb.execute(fail)).rejects.toThrow('Circuit test is OPEN')
  })

  it('honors the fallback path while the circuit is OPEN', async () => {
    const cb = new CircuitBreaker({ name: 'fb', failureThreshold: 1, resetTimeoutMs: 60000 })
    const fail = () => Promise.reject(new Error('down'))
    await expect(cb.execute(fail)).rejects.toThrow('down')
    const val = await cb.execute(fail, () => 'stale-ok')
    expect(val).toBe('stale-ok')
  })

  it('recloses on success', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: -1 })
    const fail = () => Promise.reject(new Error('down'))
    await expect(cb.execute(fail)).rejects.toThrow('down')
    expect(cb.state).toBe('OPEN')

    // resetTimeoutMs = -1 → the very next call transitions to HALF_OPEN and attempts.
    await cb.execute(() => Promise.resolve('up')).then((r) => expect(r).toBe('up'))
    expect(cb.state).toBe('CLOSED')
    expect(cb.failureCount).toBe(0)
  })
})