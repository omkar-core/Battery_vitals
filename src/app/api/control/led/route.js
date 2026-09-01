import { NextResponse } from 'next/server'
import { setAdminCommand, getAdminCommand } from '../../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_led_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body?.batteryId || 'BAT001', 30)
    const { green, yellow, red, mode } = body

    const existing = (await getAdminCommand(batteryId)) || {}
    const update = {
      ...existing,
      auto_mode: mode === 'auto' ? true : false,
      green_led: green !== undefined ? Boolean(green) : existing.green_led ?? true,
      yellow_led: yellow !== undefined ? Boolean(yellow) : existing.yellow_led ?? false,
      red_led: red !== undefined ? Boolean(red) : existing.red_led ?? false,
      updatedAt: Date.now(),
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
    return NextResponse.json({ error: 'Failed to dispatch LED command', details: error.message }, { status: 500 })
  }
}
