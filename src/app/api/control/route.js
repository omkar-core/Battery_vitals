import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { initMQTTBridge, publishControlState } from '../../../lib/mqtt'

const DEFAULT = { auto_mode: true, red_led: false, yellow_led: false, green_led: true, buzzer: false }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET() {
  try {
    const db = await getDB()
    let cmd = await db.collection('commands').findOne({ key: 'default' })
    if (!cmd) cmd = DEFAULT
    return NextResponse.json({
      auto_mode: cmd.auto_mode, red_led: cmd.red_led,
      yellow_led: cmd.yellow_led, green_led: cmd.green_led, buzzer: cmd.buzzer,
    })
  } catch (error) {
    console.error('control get error:', error)
    return NextResponse.json(DEFAULT)
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
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
        body?.batteryId || 'BAT001'
      )
    } catch (e) {
      console.error('MQTT publish control error:', e.message)
    }

    return NextResponse.json({ success: true, commands: saved })
  } catch (error) {
    console.error('control post error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
