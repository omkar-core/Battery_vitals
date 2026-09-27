import 'server-only'
import { getSessionUser } from './auth'
import { validateBatteryOwnership, DEMO_BATTERY_ID, GUEST_USER_ID } from './batteryRegistry'
import { checkRateLimit } from './rateLimit'

// Per-endpoint rate limit configuration
const AI_ENDPOINT_LIMITS = {
  chat: { max: 20, windowMs: 60000 },           // 20 req/min for chat
  conversations: { max: 30, windowMs: 60000 },  // 30 req/min for conversations
  'health-summary': { max: 10, windowMs: 60000 }, // 10 req/min for health-summary
  diagnostic: { max: 10, windowMs: 60000 },     // 10 req/min for diagnostic
  default: { max: 30, windowMs: 60000 },        // fallback
}

/**
 * Unified Backend Security & Ownership Guard for Battery Vital API Endpoints.
 */
export async function guardAIRequest(request, requestedBatteryId = null, endpoint = 'default') {
  // 1. Resolve Authenticated User
  const user = await getSessionUser(request)
  const isGuest = user.id === GUEST_USER_ID

  // 2. Resolve Target Battery ID
  const batteryId = requestedBatteryId || DEMO_BATTERY_ID

  // 3. Ownership Verification
  const isOwner = await validateBatteryOwnership(user.id, batteryId)
  if (!isOwner) {
    return {
      authorized: false,
      status: 403,
      error: 'Forbidden: You do not own or have access to this battery.',
      user,
      batteryId,
    }
  }

  // 4. Rate Limiting (per user/IP + per endpoint)
  const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1'
  const rateKey = isGuest ? `ip:${clientIp}:ai:${endpoint}` : `usr:${user.id}:ai:${endpoint}`
  const limitConfig = AI_ENDPOINT_LIMITS[endpoint] || AI_ENDPOINT_LIMITS.default
  const rateCheck = checkRateLimit(rateKey, limitConfig)

  if (!rateCheck.allowed) {
    return {
      authorized: false,
      status: 429,
      error: 'Too Many Requests: Rate limit exceeded. Please try again shortly.',
      retryAfter: rateCheck.retryAfter,
      user,
      batteryId,
    }
  }

  return {
    authorized: true,
    user,
    batteryId,
    isGuest,
    rateLimit: {
      remaining: rateCheck.remaining,
      resetTime: rateCheck.resetTime,
    },
  }
}
