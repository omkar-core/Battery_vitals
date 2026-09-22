import { NextResponse } from 'next/server'
import { setAdminCommand, getAdminCommand, getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { validateTelemetry, computeSafety } from '../../../../lib/batterySafety'
import { PermissionError, CriticalStateLockError, ValidationError } from '../../../../lib/errors'
import { loadEngineConfigForDevice } from '../../../../lib/safetyConfig'
import { handleError } from '../../../../lib/errorHandler'
import { BuzzerControlSchema } from '../../../../lib/schemas'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_buzzer_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMIT_EXCEEDED', statusCode: 429, retryAfter: 60 })
    }

    // RBAC: only operators and admins may toggle hardware actuators (RULES.md Â§4, SECURITY.md Â§3.2).
    // Authenticated via signed bearer token; no spoofable client headers.
    await requirePermission(request, PERMISSIONS.CONTROL_HARDWARE)

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body?.deviceId || body?.batteryId || 'BAT001', 30)

    // Documented payload shape (VALIDATION.md Â§4.2, API.md Â§5.2): { deviceId, mode }.
    // Valid modes: "off", "slow_beep", "fast_beep", "continuous".
    let pattern
    if (body.mode !== undefined) {
      const parsed = BuzzerControlSchema.safeParse({ deviceId: body.deviceId, mode: body.mode })
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new ValidationError(issue?.message || 'Invalid buzzer control payload', issue?.path?.join('.') || 'body')
      }
      pattern = parsed.data.mode
    } else {
      pattern = sanitizeString(body?.pattern || (body?.enabled ? 'continuous' : 'off'), 20) // 'off', 'continuous', 'fast_beep', 'slow_beep'
    }

    // Hardware Safety Lockout (SECURITY.md Â§2.1): while the deterministic engine
    // reports CRITICAL or EMERGENCY, requests to silence the buzzer (`mode: "off"`)
    // are rejected with HTTP 422. Physical ESP32 firmware remains authoritative.
    const latest = await getLatestTelemetry(batteryId).catch(() => null)
    if (latest) {
      const { clean } = validateTelemetry(latest)
      const safety = computeSafety(clean, await loadEngineConfigForDevice(batteryId))
      if ((safety.state === 'CRITICAL' || safety.state === 'EMERGENCY') && pattern === 'off') {
        const lockError = new CriticalStateLockError(safety.state, 'buzzer off')
        lockError.statusCode = 422 // SECURITY.md Â§2.1 mandates 422 for the actuator lockout.
        throw lockError
      }
    }

    const existing = (await getAdminCommand(batteryId)) || {}
    const update = {
      ...existing,
      buzzer: pattern !== 'off',
      buzzer_mode: pattern,
      updatedAt: Date.now(),
    }

    await setAdminCommand(batteryId, update)

    return NextResponse.json({
      success: true,
      message: `Buzzer state set to ${pattern}`,
      state: {
        buzzer: update.buzzer,
        pattern: update.buzzer_mode,
      },
    })
  } catch (error) {
    return handleError(error, request)
  }
}