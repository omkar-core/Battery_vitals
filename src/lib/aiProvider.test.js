import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractJson,
  clampRiskToDeterministic,
  getAIResponse,
  getDeterministicFallback,
} from './aiProvider'
import { assertModelAllowed, FREE_MODEL_ALLOWLIST } from './aiModels'
import { cacheSet, cacheGet } from './aiCache'

describe('aiProvider — extractJson', () => {
  it('extracts raw JSON objects', () => {
    const raw = '{"status": "SAFE", "risk_score": 10}'
    expect(extractJson(raw)).toEqual({ status: 'SAFE', risk_score: 10 })
  })

  it('extracts JSON surrounded by markdown code blocks', () => {
    const raw = '```json\n{"status": "WARNING", "findings": ["High temperature"]}\n```'
    expect(extractJson(raw)).toEqual({ status: 'WARNING', findings: ['High temperature'] })
  })

  it('extracts JSON embedded inside explanatory prose', () => {
    const raw = 'Here is the result:\n{"overall_status": "CAUTION", "risk_score": 35}\nPlease review.'
    expect(extractJson(raw)).toEqual({ overall_status: 'CAUTION', risk_score: 35 })
  })

  it('returns null for unparseable strings', () => {
    expect(extractJson('random unformatted text without json')).toBeNull()
    expect(extractJson('')).toBeNull()
    expect(extractJson(null)).toBeNull()
  })
})

describe('aiProvider — Invariant #1: clampRiskToDeterministic', () => {
  it('never allows AI to downgrade a CRITICAL safety state to SAFE', () => {
    const aiOutput = { overall_status: 'SAFE', risk_score: 5, message: 'All looking good' }
    const clamped = clampRiskToDeterministic(aiOutput, 'CRITICAL', 85)
    expect(clamped.overall_status).toBe('CRITICAL')
    expect(clamped.risk_score).toBe(85)
  })

  it('never allows AI to downgrade EMERGENCY to WARNING', () => {
    const aiOutput = { status: 'WARNING', risk_score: 40 }
    const clamped = clampRiskToDeterministic(aiOutput, 'EMERGENCY', 95)
    expect(clamped.status).toBe('EMERGENCY')
    expect(clamped.risk_score).toBe(95)
  })

  it('preserves higher risk reported by AI if platform is in CAUTION', () => {
    const aiOutput = { overall_status: 'WARNING', risk_score: 55 }
    const clamped = clampRiskToDeterministic(aiOutput, 'CAUTION', 20)
    expect(clamped.overall_status).toBe('WARNING')
    expect(clamped.risk_score).toBe(55)
  })

  it('handles severity property', () => {
    const aiOutput = { severity: 'LOW' }
    const clamped = clampRiskToDeterministic(aiOutput, 'CRITICAL')
    expect(clamped.severity).toBe('CRITICAL')
  })
})

describe('aiProvider — Security Guardrail: assertModelAllowed', () => {
  it('allows verified free-tier models', () => {
    expect(() => assertModelAllowed('gemini-1.5-flash')).not.toThrow()
    expect(() => assertModelAllowed('meta-llama/llama-3.3-70b-instruct:free')).not.toThrow()
  })

  it('rejects paid or unverified model strings with an explicit guardrail error', () => {
    expect(() => assertModelAllowed('gpt-4o')).toThrow(/Security Guardrail/)
    expect(() => assertModelAllowed('claude-3-5-sonnet')).toThrow(/Security Guardrail/)
    expect(() => assertModelAllowed('unknown-paid-model:expensive')).toThrow(/Security Guardrail/)
  })
})

describe('aiProvider — Fallback & Caching Operations', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENROUTER_API_KEY
  })

  it('gracefully falls back to deterministic engine when API keys are absent', async () => {
    const response = await getAIResponse('Generate a health summary', {
      task: 'report',
      json: true,
      safetyState: 'WARNING',
      safetyScore: 40,
    })

    expect(response.provider).toBe('deterministic')
    expect(response.parsed).toBeDefined()
    expect(response.parsed.grade).toBe('B-')
  })

  it('serves cached responses without network calls when cacheKey is provided', async () => {
    const testKey = 'test_report_cache_001'
    cacheSet(testKey, {
      text: '{"cached": true, "status": "SAFE"}',
      parsed: { cached: true, status: 'SAFE' },
      provider: 'cache',
      model: 'cached',
    })

    const response = await getAIResponse('Generate report', {
      task: 'report',
      cacheKey: testKey,
      json: true,
    })

    expect(response.cached).toBe(true)
    expect(response.parsed.cached).toBe(true)
  })

  it('bypasses and overwrites cache when regenerate: true is specified', async () => {
    const testKey = 'test_regenerate_cache_002'
    cacheSet(testKey, {
      text: 'OLD_CONTENT',
      parsed: { old: true },
      provider: 'cache',
      model: 'cached',
    })

    const response = await getAIResponse('Generate report', {
      task: 'report',
      cacheKey: testKey,
      regenerate: true,
      json: true,
      safetyState: 'SAFE',
    })

    expect(response.cached).toBeFalsy()
    expect(response.parsed.old).toBeUndefined()
  })

  it('ensures all deterministic fallbacks clamp properly to Invariant #1', () => {
    const tasks = ['explain-alert', 'report', 'root-cause', 'threshold-suggest']
    for (const task of tasks) {
      const fallback = getDeterministicFallback(task, 'Test prompt', 'CRITICAL', true)
      const clamped = clampRiskToDeterministic(fallback, 'CRITICAL', 85)
      if (clamped.status) {
        expect(clamped.status).toBe('CRITICAL')
      }
      if (clamped.severity) {
        expect(clamped.severity).toBe('CRITICAL')
      }
    }
  })
})

