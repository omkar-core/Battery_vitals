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
import { LEDControlSchema } from '../../../../lib/schemas'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_led_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      throw Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMIT_EXCEEDED', statusCode: 429, retryAfter: 60 })
    }

    // RBAC: only operators and admins may toggle hardware actuators (RULES.md Â§4, SECURITY.md Â§3.2).
    // Authenticated via signed bearer token; no spoofable client headers.
    await requirePermission(request, PERMISSIONS.CONTROL_HARDWARE)

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body?.deviceId || body?.batteryId || 'BAT001', 30)

    // Documented payload shape (VALIDATION.md Â§4.2, API.md Â§5.1): { deviceId, led, state }.
    let green
    let yellow
    let red
    if (body.led !== undefined || body.state !== undefined) {
      const parsed = LEDControlSchema.safeParse({ deviceId: body.deviceId, led: body.led, state: body.state })
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new ValidationError(issue?.message || 'Invalid LED control payload', issue?.path?.join('.') || 'body')
      }
      const { led, state } = parsed.data
      green = led === 'green' ? state : undefined
      yellow = led === 'yellow' ? state : undefined
      red = led === 'red' ? state : undefined
    } else {
      green = body.green
      yellow = body.yellow
      red = body.red
    }

    const existing = (await getAdminCommand(batteryId)) || {}
    const update = {
      ...existing,
      auto_mode: body.mode === 'auto' ? true : false,
      green_led: green !== undefined ? Boolean(green) : existing.green_led ?? true,
      yellow_led: yellow !== undefined ? Boolean(yellow) : existing.yellow_led ?? false,
      red_led: red !== undefined ? Boolean(red) : existing.red_led ?? false,
      updatedAt: Date.now(),
    }

    // Hardware Safety Lockout (SECURITY.md Â§2.1): while the deterministic engine
    // reports CRITICAL or EMERGENCY, requests to silence (green LED on) are rejected
    // with HTTP 422. Physical ESP32 firmware remains authoritative regardless.
    const latest = await getLatestTelemetry(batteryId).catch(() => null)
    if (latest) {
      const { clean } = validateTelemetry(latest)
      const safety = computeSafety(clean, await loadEngineConfigForDevice(batteryId))
      if ((safety.state === 'CRITICAL' || safety.state === 'EMERGENCY') && green === true) {
        const lockError = new CriticalStateLockError(safety.state, 'green LED on')
        lockError.statusCode = 422 // SECURITY.md Â§2.1 mandates 422 for the actuator lockout.
        throw lockError
      }
    }

    await setAdminCommand(batteryId, update)

    return NextResponse.json({
      success: true,
      message: 'LED state dispatched to ESP32',
      state: {
        auto_mode: update.auto_mode,
        led_green: update.green_led,
        led_yellow: update.yellow_led,
        led_red: update.red_led,
      },
    })
  } catch (error) {
    return handleError(error, request)
  }
}