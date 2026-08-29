import { NextResponse } from 'next/server'

/**
 * Sanitize text input by removing script tags, HTML tags, and dangerous characters.
 */
export function sanitizeString(input, maxLength = 500) {
  if (typeof input !== 'string') return ''
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/[$]/g, '') // Remove $ to prevent NoSQL operator injection
    .trim()

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  return sanitized
}

/**
 * Validate and sanitize numeric telemetry inputs within realistic bounds
 */
export function sanitizeNumber(value, min = -1000, max = 1000, fallback = null) {
  if (value == null || value === '') return fallback
  const num = Number(value)
  if (isNaN(num) || !isFinite(num)) return fallback
  if (num < min || num > max) return fallback
  return num
}

/**
 * Allowed hardware command list for authorization checks
 */
const ALLOWED_COMMANDS = new Set([
  'LED_MODE',
  'ALL_OFF',
  'SILENCE_ALL',
  'BUZZER_ON',
  'BUZZER_OFF',
  'RESET_ALARM',
  'RED_ON',
  'RED_OFF',
  'YELLOW_ON',
  'YELLOW_OFF',
  'GREEN_ON',
  'GREEN_OFF',
  'TEST_BUZZER',
  'DEMO_CYCLE',
  'SET_PROFILE',
  'SET_SAMPLE_INTERVAL',
  'REBOOT',
  'START_CALIBRATION',
  'RUN_SELF_TEST',
])

export function isValidCommand(cmd) {
  if (!cmd || typeof cmd !== 'string') return false
  return ALLOWED_COMMANDS.has(cmd.toUpperCase())
}

/**
 * Format error response securely without exposing stack traces or internal DB details
 */
export function secureErrorResponse(message = 'An error occurred', status = 500) {
  const isDev = process.env.NODE_ENV === 'development'
  return NextResponse.json(
    {
      success: false,
      error: isDev ? message : 'Request could not be processed safely.',
      timestamp: new Date().toISOString(),
    },
    { status }
  )
}
