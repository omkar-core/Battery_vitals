// src/lib/aiModels.js
// Single source of truth for AI task -> model mapping with strict free-tier allowlist.
// Prevents accidental routing to billable models and validates OpenRouter pricing.

export const TASK_MODEL_MAPPING = {
  chat: {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 12000,
  },
  'explain-alert': {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 12000,
  },
  insights: {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 12000,
  },
  'root-cause': {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 15000,
  },
  report: {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 15000,
  },
  'label-scan': {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: null,
    isVision: true,
    timeoutMs: 15000,
  },
  'profile-verify': {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: null,
    isVision: true,
    timeoutMs: 15000,
  },
  'threshold-suggest': {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 12000,
  },
  'onboarding-wizard': {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 12000,
  },
  'fleet-summary': {
    primary: 'gemini-1.5-flash',
    secondary: 'gemini-1.5-pro',
    openRouter: 'liquid/lfm-40b:free',
    isVision: false,
    timeoutMs: 15000,
  },
}

// Strict free-tier allowlist. Any model string not in this set will be rejected before dispatch.
export const FREE_MODEL_ALLOWLIST = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'liquid/lfm-40b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
])

// Published provider limits for free tiers
export const PROVIDER_QUOTAS = {
  GEMINI_FREE_RPM: 15,
  GEMINI_FREE_RPD: 1400,
  OPENROUTER_FREE_RPM: 20,
  OPENROUTER_FREE_RPD: 200,
}

/**
 * Validate that a model string is on the free-tier allowlist.
 */
export function assertModelAllowed(modelId) {
  if (!modelId || !FREE_MODEL_ALLOWLIST.has(modelId)) {
    throw new Error(
      `[Security Guardrail] Model "${modelId}" is not in the verified free-tier allowlist. Request rejected.`
    )
  }
}

/**
 * Check OpenRouter model pricing from /models endpoint to verify prompt=0, completion=0.
 */
export async function verifyOpenRouterModelIsFree(modelId) {
  if (!modelId) return true
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://battery-vital.local',
        'X-Title': 'Battery Vital Safety Monitor',
      },
    })
    if (!res.ok) return true
    const json = await res.json()
    const found = (json.data || []).find((m) => m.id === modelId)
    if (found && found.pricing) {
      const isFree = Number(found.pricing.prompt || 0) === 0 && Number(found.pricing.completion || 0) === 0
      return isFree
    }
    return true
  } catch (err) {
    console.warn('[aiModels] Could not verify OpenRouter pricing:', err.message)
    return true
  }
}

/**
 * Log model configuration on startup.
 */
export function logModelStartupStatus() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY)
  const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY)
  console.log(
    `[AI Engine] Initialized: Gemini=${geminiConfigured ? 'Active' : 'Unconfigured'}, OpenRouter=${
      openRouterConfigured ? 'Active' : 'Unconfigured'
    }, FreeTierAllowlistCount=${FREE_MODEL_ALLOWLIST.size}`
  )
}

// Structured JSON schema for AI diagnostic responses
export const DIAGNOSTIC_SCHEMA = {
  type: 'object',
  required: ['overall_status', 'risk_score', 'confidence', 'summary', 'key_drivers', 'recommendations', 'failure_probability', 'provider_used'],
  properties: {
    overall_status: { type: 'string', enum: ['SAFE', 'CAUTION', 'WARNING', 'CRITICAL', 'EMERGENCY'] },
    risk_score: { type: 'number', minimum: 0, maximum: 100 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    summary: { type: 'string', minLength: 10, maxLength: 500 },
    key_drivers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['metric', 'value', 'threshold', 'contribution'],
        properties: {
          metric: { type: 'string' },
          value: { type: 'number' },
          threshold: { type: 'number' },
          contribution: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['priority', 'action', 'reason'],
        properties: {
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          action: { type: 'string', minLength: 10 },
          reason: { type: 'string', minLength: 10 },
        },
      },
    },
    failure_probability: {
      type: 'object',
      required: ['30_days', '90_days', '1_year'],
      properties: {
        '30_days': { type: 'number', minimum: 0, maximum: 100 },
        '90_days': { type: 'number', minimum: 0, maximum: 100 },
        '1_year': { type: 'number', minimum: 0, maximum: 100 },
      },
    },
    provider_used: { type: 'string', enum: ['gemini-1.5-flash', 'gemini-1.5-pro', 'openrouter/liquid-lfm-40b', 'deterministic'] },
  },
}