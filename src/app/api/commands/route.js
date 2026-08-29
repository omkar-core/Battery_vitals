import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { setAdminCommand } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, isValidCommand, secureErrorResponse } from '../../../lib/security'

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
    console.error('commands get error:', error)
    return NextResponse.json(DEFAULT)
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

    const now = new Date()
    const update = { updatedAt: now.getTime() }
    const cmdName = rawCommand.toUpperCase()

    if (cmdName === 'LED_MODE') {
      const v = String(value || '').toUpperCase()
      if (v === 'AUTO') update.auto_mode = true
      else if (v === 'MANUAL') update.auto_mode = false
      else if (value === true || value === false) update.auto_mode = !!value
    } else if (cmdName === 'ALL_OFF' || cmdName === 'SILENCE_ALL') {
      update.red_led = false; update.yellow_led = false; update.green_led = false; update.buzzer = false
    } else if (cmdName === 'BUZZER_ON') {
      update.buzzer = true
    } else if (cmdName === 'BUZZER_OFF') {
      update.buzzer = false
    } else if (cmdName === 'RESET_ALARM') {
      update.red_led = false; update.buzzer = false
    } else if (/^RED.*(ON|OFF)$/.test(cmdName)) {
      update.red_led = cmdName.endsWith('ON')
    } else if (/^YELLOW.*(ON|OFF)$/.test(cmdName)) {
      update.yellow_led = cmdName.endsWith('ON')
    } else if (/^GREEN.*(ON|OFF)$/.test(cmdName)) {
      update.green_led = cmdName.endsWith('ON')
    } else if (cmdName === 'TEST_BUZZER') {
      update.buzzer = true
    } else if (cmdName === 'SET_PROFILE') {
      update.profile = sanitizeString(String(value || ''), 20).toUpperCase()
    } else if (cmdName === 'SET_SAMPLE_INTERVAL') {
      update.sampleInterval = Math.max(1, Math.min(60, parseInt(value) || 3))
    } else if (cmdName === 'MUTE_BUZZER') {
      update.buzzer = false
      update.mute_duration = Math.max(10, Math.min(3600, parseInt(value) || 300))
    } else if (cmdName === 'START_MONITORING') {
      update.monitoring = true
    } else if (cmdName === 'STOP_MONITORING') {
      update.monitoring = false
    } else if (cmdName === 'SET_FIREBASE_INTERVAL') {
      update.firebaseInterval = Math.max(1, Math.min(60, parseInt(value) || 3))
    } else if (cmdName === 'REBOOT' || cmdName === 'START_CALIBRATION' || cmdName === 'RUN_SELF_TEST' || cmdName === 'GET_SELFTEST') {
      update.last_command = cmdName
    }

    // 1. Dispatch command payload to Firebase Realtime Database
    await setAdminCommand(batteryId, {
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
    return secureErrorResponse(error.message)
  }
}
