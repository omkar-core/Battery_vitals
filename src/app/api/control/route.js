import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { setAdminCommand, getAdminCommand, getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString } from '../../../lib/security'
import { requirePermission } from '../../../lib/auth'
import { PERMISSIONS } from '../../../lib/permissions'
import { validateTelemetry, computeSafety } from '../../../lib/batterySafety'
import { CriticalStateLockError } from '../../../lib/errors'
import { loadEngineConfigForDevice } from '../../../lib/safetyConfig'
import { handleError } from '../../../lib/errorHandler'

const DEFAULT = { auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const batteryId = 'BAT001'
    let cmd = await getAdminCommand(batteryId)

    if (!cmd) {
      try {
        const db = await getDB()
        cmd = await db.collection('commands').findOne({ key: 'default' })
      } catch (dbErr) {
        console.warn('MongoDB control lookup fallback failed:', dbErr.message)
      }
    }

    if (!cmd) cmd = DEFAULT

    return NextResponse.json({
      auto_mode: cmd.auto_mode ?? true,
      red_led: cmd.red_led ?? false,
      yellow_led: cmd.yellow_led ?? false,
      green_led: cmd.green_led ?? true,
      buzzer: cmd.buzzer ?? false,
    })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_post_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // RBAC: only operators and admins may toggle hardware actuators (RULES.md Â§4).
    // Authenticated via signed bearer token (SECURITY.md Â§6); no spoofable headers.
    await requirePermission(request, PERMISSIONS.CONTROL_HARDWARE)

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body?.batteryId || 'BAT001', 30)
    const allowed = ['auto_mode', 'red_led', 'yellow_led', 'green_led', 'buzzer']
    const update = { updatedAt: Date.now() }

    function toBool(value) {
      if (typeof value === 'boolean') return value
      if (value === 'true' || value === '1' || value === 1) return true
      if (value === 'false' || value === '0' || value === 0) return false
      return null
    }

    for (const k of allowed) {
      if (body[k] !== undefined) {
        const parsed = toBool(body[k])
        if (parsed !== null) update[k] = parsed
      }
    }

    // Hardware Safety Lockout (SECURITY.md Â§2.1): while the deterministic engine
    // reports CRITICAL or EMERGENCY, requests that silence active trips (disable
    // red LED or buzzer in manual mode, or force auto-mode off asserting safety)
    // are rejected with HTTP 422. The ESP32 firmware remains authoritative.
    const latest = await getAdminCommand(batteryId)
    const telemetry = await getLatestTelemetry(batteryId).catch(() => null)
    if (telemetry) {
      const { clean } = validateTelemetry(telemetry)
      const safety = computeSafety(clean, await loadEngineConfigForDevice(batteryId))
      const silencing =
        safety.state === 'CRITICAL' || safety.state === 'EMERGENCY'
          ? (['red_led', 'buzzer'].some((k) => update[k] === false) ||
             (update.auto_mode === true && (latest?.auto_mode === false || latest?.auto_mode == null)) ||
             update.green_led === true ||
             update.buzzer_mode === 'off')
          : false
      if (silencing) {
        const lockError = new CriticalStateLockError(safety.state, 'silencing active trip')
        lockError.statusCode = 422
        throw lockError
      }
    }

    // Merge with existing command node
    const existing = (await getAdminCommand(batteryId).catch(() => null)) || {}
    const { command: _omitCmd, value: _omitVal, requestId: _omitReq, ...existingRest } = existing
    await setAdminCommand(batteryId, {
      ...existingRest,
      ...update,
      updatedAt: Date.now(),
    })

    // 2. Persist in MongoDB in background try/catch
    try {
      const db = await getDB()
      await db.collection('commands').updateOne(
        { key: 'default' },
        { $set: update },
        { upsert: true }
      )
    } catch (dbErr) {
      console.warn('MongoDB update control failed:', dbErr.message)
    }

    return NextResponse.json({ success: true, commands: update })
  } catch (error) {
    console.error('control post error:', error)
    return handleError(error, request)
  }
}

