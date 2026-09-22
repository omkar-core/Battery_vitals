import { NextResponse } from 'next/server'
import { getAdminCommand, getLatestTelemetry } from '../../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`control_status_get_${ip}`, 120, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'

    const [cmd, latest] = await Promise.all([
      getAdminCommand(batteryId),
      getLatestTelemetry(batteryId),
    ])

    const hw = latest?.outputs || latest?.hardware || {}

    const greenOn = cmd?.green_led ?? hw?.green ?? hw?.led_green ?? false
    const yellowOn = cmd?.yellow_led ?? hw?.yellow ?? hw?.led_yellow ?? false
    const redOn = cmd?.red_led ?? hw?.red ?? hw?.led_red ?? false
    const buzzer = cmd?.buzzer ?? hw?.buzzer ?? false
    const autoMode = cmd?.auto_mode ?? hw?.auto ?? false

    const lastTelemetryRaw = latest?.timestamp ?? latest?.ts
    const lastTelemetryFrame = lastTelemetryRaw
      ? lastTelemetryRaw > 1e12
        ? new Date(lastTelemetryRaw).toISOString()
        : new Date(lastTelemetryRaw * 1000).toISOString()
      : null

    return NextResponse.json({
      batteryId,
      auto_mode: autoMode,
      led_green: greenOn,
      led_yellow: yellowOn,
      led_red: redOn,
      buzzer,
      buzzer_mode: cmd?.buzzer_mode || (buzzer ? 'continuous' : 'off'),
      lastCommandDispatched: cmd?.updatedAt ? new Date(cmd.updatedAt).toISOString() : null,
      lastTelemetryFrame,
    })
  } catch (error) {
    return handleError(error, request)
  }
}