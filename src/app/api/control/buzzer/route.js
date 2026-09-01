import { NextResponse } from 'next/server'
import { setAdminCommand, getAdminCommand } from '../../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { sanitizeString } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_buzzer_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body?.batteryId || 'BAT001', 30)
    const pattern = sanitizeString(body?.pattern || (body?.enabled ? 'continuous' : 'off'), 20) // 'off', 'continuous', 'fast_beep', 'slow_beep'

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
    return NextResponse.json({ error: 'Failed to dispatch Buzzer command', details: error.message }, { status: 500 })
  }
}
