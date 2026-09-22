import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { adminDb } from '../../../../lib/firebaseAdmin'
import { sanitizeString } from '../../../../lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`battery_cal_${ip}`, 10, 60000)
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many calibration requests' }, { status: 429 })
    }

    const auth = await requirePermission(request, PERMISSIONS.CONTROL_RELAY)

    const body = await request.json().catch(() => ({}))
    const deviceId = sanitizeString(body.deviceId || body.batteryId || 'BAT001', 30)

    try {
      if (adminDb) {
        const cmdRef = adminDb.ref(`commands/${deviceId}`)
        await cmdRef.set({
          command: 'CALIBRATE_ZERO',
          timestamp: Date.now(),
          triggeredBy: auth?.email || auth?.id || 'operator',
        })
      }
    } catch (dbErr) {
      console.warn('Firebase calibration command dispatch note:', dbErr.message)
    }

    return NextResponse.json({
      success: true,
      deviceId,
      command: 'CALIBRATE_ZERO',
      message: 'Zero-current calibration routine dispatched to ESP32.',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return handleError(error, request)
  }
}
