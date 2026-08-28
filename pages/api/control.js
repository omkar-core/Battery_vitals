import { getDB } from '../../src/lib/mongodb'
import { initMQTTBridge, publishControlState } from '../../src/lib/mqtt'

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
    console.error('control get error:', error)
    return res.json(DEFAULT)
  }
}

async function handlePost(req, res) {
  try {
    const body = req.body || {}
    const db = await getDB()
    const allowed = ['auto_mode', 'red_led', 'yellow_led', 'green_led', 'buzzer']
    const update = { updatedAt: new Date() }
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = !!body[k]
    }
    await db.collection('commands').updateOne(
      { key: 'default' },
      { $set: update },
      { upsert: true }
    )
    const saved = await db.collection('commands').findOne({ key: 'default' })

    // Best-effort: push the control state out over MQTT so the device applies it immediately
    try {
      await initMQTTBridge()
      publishControlState(
        {
          auto_mode: !!saved.auto_mode,
          red_led: !!saved.red_led,
          yellow_led: !!saved.yellow_led,
          green_led: !!saved.green_led,
          buzzer: !!saved.buzzer,
        },
        req.body?.batteryId || 'BAT001'
      )
    } catch (e) {
      console.error('MQTT publish control error:', e.message)
    }

    return res.json({ success: true, commands: saved })
  } catch (error) {
    console.error('control post error:', error)
    return res.status(500).json({ error: error.message })
  }
}
