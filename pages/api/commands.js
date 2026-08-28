import { getDB } from '../../src/lib/mongodb'
import { initMQTTBridge, publishControl } from '../../src/lib/mqtt'

const DEFAULT = { auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method === 'GET') {
    return handleGet(req, res)
  }

  if (req.method === 'POST') {
    return handlePost(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGet(req, res) {
  try {
    const db = await getDB()
    let cmd = await db.collection('commands').findOne({ key: 'default' })
    if (!cmd) cmd = DEFAULT
    return res.json({
      auto_mode: cmd.auto_mode, red_led: cmd.red_led,
      yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer,
    })
  } catch (error) {
    console.error('commands get error:', error)
    return res.json(DEFAULT)
  }
}

async function handlePost(req, res) {
  try {
    const { command, value, requestId } = req.body || {}
    const now = new Date()
    const update = { updatedAt: now }

    const cmdName = String(command || '').toUpperCase()

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
      update.profile = String(value || '').toUpperCase()
    } else if (cmdName === 'SET_SAMPLE_INTERVAL') {
      update.sampleInterval = parseInt(value) || 3
    } else if (cmdName === 'REBOOT' || cmdName === 'START_CALIBRATION' || cmdName === 'RUN_SELF_TEST') {
      update.espresso_command = cmdName
    }

    const db = await getDB()
    await db.collection('commands').updateOne(
      { key: 'default' },
      { $set: update },
      { upsert: true }
    )

    // Best-effort: forward the command to the device over MQTT
    try {
      await initMQTTBridge()
      const batteryId = req.body?.batteryId || 'BAT001'
      publishControl(batteryId, {
        command,
        value,
        requestId,
        ts: Date.now(),
      })
    } catch (e) {
      console.error('MQTT publish command error:', e.message)
    }

    try {
      await db.collection('system_events').insertOne({
        type: 'USER_ACTION', severity: 'INFO',
        message: `Command: ${command} ${value || ''}`,
        details: { command, value, requestId },
        timestamp: now,
      })
    } catch (e) { /* non-critical */ }

    return res.json({ success: true, command, value, ts: now.getTime() })
  } catch (error) {
    console.error('commands post error:', error)
    return res.status(200).json({ success: true, error: error.message })
  }
}
