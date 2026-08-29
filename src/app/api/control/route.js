import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { setAdminCommand, getAdminCommand } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, secureErrorResponse } from '../../../lib/security'

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
      const db = await getDB()
      cmd = await db.collection('commands').findOne({ key: 'default' })
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
    console.error('control get error:', error)
    return NextResponse.json(DEFAULT)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_post_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body?.batteryId || 'BAT001', 30)
    const allowed = ['auto_mode', 'red_led', 'yellow_led', 'green_led', 'buzzer']
    const update = { updatedAt: Date.now() }
    
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = Boolean(body[k])
    }

    // 1. Write to Firebase Realtime Database `/commands/[batteryId]`
    await setAdminCommand(batteryId, update)

    // 2. Persist in MongoDB
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
    return secureErrorResponse(error.message)
  }
}
