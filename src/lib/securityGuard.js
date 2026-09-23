import 'server-only'
import { getSessionUser } from './auth'
import { validateBatteryOwnership, DEMO_BATTERY_ID, GUEST_USER_ID } from './batteryRegistry'
import { checkRateLimit } from './rateLimit'

/**
 * Unified Backend Security & Ownership Guard for Battery Vital API Endpoints.
 */
export async function guardAIRequest(request, requestedBatteryId = null) {
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

  // 4. Rate Limiting (per user or per IP)
  const clientIp = request.headers.get('x-forwarded-for') || '127.0.0.1'
  const rateKey = isGuest ? `ip:${clientIp}` : `usr:${user.id}`
  const rateCheck = checkRateLimit(rateKey, { max: 30, windowMs: 60000 })

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
  }
}
