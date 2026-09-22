import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { setAdminCommand, getAdminCommand, getLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, isValidCommand } from '../../../lib/security'
import { requirePermission } from '../../../lib/auth'
import { PERMISSIONS } from '../../../lib/permissions'
import { validateTelemetry, computeSafety } from '../../../lib/batterySafety'
import { CriticalStateLockError } from '../../../lib/errors'
import { loadEngineConfigForDevice } from '../../../lib/safetyConfig'
import { handleError } from '../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

const DEFAULT = { auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`commands_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const db = await getDB()
    let cmd = await db.collection('commands').findOne({ key: 'default' })
    if (!cmd) cmd = DEFAULT
    return NextResponse.json({
      auto_mode: cmd.auto_mode, red_led: cmd.red_led,
      yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer,
    })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`commands_post_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Command rate limit exceeded. Please wait.' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const rawCommand = sanitizeString(body.command || '', 50)
    const value = body.value
    const requestId = sanitizeString(body.requestId || Math.random().toString(16).slice(2, 10), 40)
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)

    if (rawCommand && !isValidCommand(rawCommand)) {
      return NextResponse.json(
        { success: false, error: `Unauthorized command: ${rawCommand}` },
        { status: 400 }
      )
    }

    // Command dispatch is a hardware mutating action: require operator/admin
    // via a signed bearer token (RULES.md Â§4, SECURITY.md Â§6). No spoofable headers.
    const actor = await requirePermission(request, PERMISSIONS.CONTROL_HARDWARE)

    const now = new Date()
    const update = { updatedAt: now.getTime() }
    const cmdName = rawCommand.toUpperCase()

    if (cmdName === 'LED_MODE') {
      const v = String(value ?? '').toUpperCase()
      if (v === 'AUTO') update.auto_mode = true
      else if (v === 'MANUAL') update.auto_mode = false
      else if (value === true || value === false) update.auto_mode = !!value
    } else if (cmdName === 'ALL_OFF' || cmdName === 'SILENCE_ALL') {
      update.red_led = false; update.yellow_led = false; update.green_led = false; update.buzzer = false
    } else if (cmdName === 'BUZZER_ON' || cmdName === 'TEST_BUZZER') {
      update.buzzer = true
    } else if (cmdName === 'BUZZER_OFF' || cmdName === 'MUTE_BUZZER') {
      update.buzzer = false
      if (cmdName === 'MUTE_BUZZER') {
        const parsed = Number.parseInt(value, 10)
        update.mute_duration = Number.isFinite(parsed) ? Math.max(10, Math.min(3600, parsed)) : 300
      }
    } else if (cmdName === 'RESET_ALARM') {
      update.red_led = false; update.buzzer = false
    } else if (/^RED.*(ON|OFF)$/.test(cmdName)) {
      update.red_led = cmdName.endsWith('ON')
    } else if (/^YELLOW.*(ON|OFF)$/.test(cmdName)) {
      update.yellow_led = cmdName.endsWith('ON')
    } else if (/^GREEN.*(ON|OFF)$/.test(cmdName)) {
      update.green_led = cmdName.endsWith('ON')
    } else if (cmdName === 'GREEN_LED' || cmdName === 'YELLOW_LED' || cmdName === 'RED_LED') {
      // Bare LED toggles from LEDControl.jsx ({command: 'GREEN_LED', value: bool}).
      const key = cmdName.toLowerCase()
      update[key] = value === true || value === 'true' || value === 1
    } else if (cmdName === 'BUZZER_PATTERN') {
      // Buzzer patterns from BuzzerControl.jsx ({command, value: mode}).
      const mode = sanitizeString(String(value || 'off'), 20).toLowerCase()
      const valid = ['off', 'slow_beep', 'fast_beep', 'continuous']
      update.buzzer_mode = valid.includes(mode) ? mode : 'off'
      update.buzzer = update.buzzer_mode !== 'off'
    } else if (cmdName === 'SET_PROFILE') {
      update.profile = sanitizeString(String(value ?? ''), 20).toUpperCase()
    } else if (cmdName === 'SET_SAMPLE_INTERVAL') {
      const parsed = Number.parseInt(value, 10)
      update.sampleInterval = Number.isFinite(parsed) ? Math.max(1, Math.min(60, parsed)) : 3
    } else if (cmdName === 'START_MONITORING') {
      update.monitoring = true
    } else if (cmdName === 'STOP_MONITORING') {
      update.monitoring = false
    } else if (cmdName === 'SET_FIREBASE_INTERVAL') {
      const parsed = Number.parseInt(value, 10)
      update.firebaseInterval = Number.isFinite(parsed) ? Math.max(1, Math.min(60, parsed)) : 3
    } else if (cmdName === 'SET_CONFIG') {
      if (value && typeof value === 'object') {
        try {
          const db = await getDB()
          const capped = JSON.parse(JSON.stringify(value).slice(0, 8000))
          await db.collection('settings').updateOne(
            { key: 'app_config' },
            { $set: { config: capped, updatedAt: now.getTime() } },
            { upsert: true }
          )
        } catch (e) {
          console.warn('SET_CONFIG persistence failed:', e.message)
        }
        update.last_command = cmdName
      }
    } else if (cmdName === 'REBOOT' || cmdName === 'START_CALIBRATION' || cmdName === 'RUN_SELF_TEST' || cmdName === 'GET_SELFTEST') {
      update.last_command = cmdName
    }

    // Hardware Safety Lockout (SECURITY.md Â§2.1): while the deterministic engine
    // reports CRITICAL or EMERGENCY, commands that silence active trips (buzzer/LED
    // off) are rejected with HTTP 422. The ESP32 firmware remains authoritative.
    const silencing =
      cmdName === 'BUZZER_OFF' ||
      cmdName === 'MUTE_BUZZER' ||
      cmdName === 'SILENCE_ALL' ||
      cmdName === 'ALL_OFF' ||
      cmdName === 'RESET_ALARM' ||
      (cmdName === 'BUZZER_PATTERN' && String(value || '').toLowerCase() === 'off') ||
      (cmdName === 'LED_MODE' && value === true) ||
      (/^RED.*(OFF)$/.test(cmdName)) ||
      (/^YELLOW.*(OFF)$/.test(cmdName))

    if (silencing) {
      const telemetry = await getLatestTelemetry(batteryId).catch(() => null)
      if (telemetry) {
        const { clean } = validateTelemetry(telemetry)
        const safety = computeSafety(clean, await loadEngineConfigForDevice(batteryId))
        if (safety.state === 'CRITICAL' || safety.state === 'EMERGENCY') {
          const lockError = new CriticalStateLockError(safety.state, cmdName)
          lockError.statusCode = 422 // SECURITY.md §2.1 mandates 422 for the actuator lockout.
          lockError.context = { actor: actor?.id ?? null }
          throw lockError
        }
      }
    }

    // Merge with the live node so actuator/profile keys survive every dispatch.
    const existing = (await getAdminCommand(batteryId).catch(() => null)) || {}
    const { command: _omitCmd, value: _omitVal, requestId: _omitReq, ...existingRest } = existing
    // 1. Dispatch command payload to Firebase Realtime Database
    await setAdminCommand(batteryId, {
      ...existingRest,
      command: cmdName,
      value,
      requestId,
      ...update,
    })

    // 2. Update local state & audit event in MongoDB
    try {
      const db = await getDB()
      await db.collection('commands').updateOne(
        { key: 'default' },
        { $set: update },
        { upsert: true }
      )
      await db.collection('system_events').insertOne({
        type: 'USER_ACTION',
        severity: 'INFO',
        message: `Command dispatched via Firebase: ${cmdName} ${value || ''}`,
        details: { command: cmdName, value, requestId, ip },
        timestamp: now,
      })
    } catch (e) { /* non-critical */ }

    return NextResponse.json({ success: true, command: cmdName, value, ts: now.getTime() })
  } catch (error) {
    console.error('commands post error:', error)
    return handleError(error, request)
  }
}
