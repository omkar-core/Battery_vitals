import { NextResponse } from 'next/server'
import { getAdminCommand, getLatestTelemetry } from '../../../../lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const batteryId = searchParams.get('batteryId') || 'BAT001'

    const [cmd, latest] = await Promise.all([
      getAdminCommand(batteryId),
      getLatestTelemetry(batteryId),
    ])

    const hw = latest?.hardware || {}

    return NextResponse.json({
      batteryId,
      auto_mode: cmd?.auto_mode ?? hw?.auto_mode ?? true,
      led_green: cmd?.green_led ?? hw?.led_green ?? true,
      led_yellow: cmd?.yellow_led ?? hw?.led_yellow ?? false,
      led_red: cmd?.red_led ?? hw?.led_red ?? false,
      buzzer: cmd?.buzzer ?? hw?.buzzer ?? false,
      buzzer_mode: cmd?.buzzer_mode || (cmd?.buzzer ? 'continuous' : 'off'),
      lastCommandDispatched: cmd?.updatedAt ? new Date(cmd.updatedAt).toISOString() : null,
      lastTelemetryFrame: latest?.timestamp ? new Date(latest.timestamp * 1000).toISOString() : null,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch control status', details: error.message }, { status: 500 })
  }
}
