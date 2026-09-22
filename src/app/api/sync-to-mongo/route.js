import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { handleError } from '../../../lib/errorHandler'
import { runFirebaseToMongoSync } from '../../../lib/dataSync'
import { sanitizeString } from '../../../lib/security'

export const dynamic = 'force-dynamic'

// Manual one-shot sync trigger. Requires CONTROL_HARDWARE (an actor is present
// on the web side); the automated path is /api/cron/sync guarded by CRON_SECRET.
export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`sync_mongo_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { requirePermission } = await import('../../../lib/auth')
    const { PERMISSIONS } = await import('../../../lib/permissions')
    await requirePermission(request, PERMISSIONS.CONTROL_HARDWARE)

    const body = await request.json().catch(() => ({}))
    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)

    const result = await runFirebaseToMongoSync({ batteryId })
    return NextResponse.json(result)
  } catch (error) {
    return handleError(error, request)
  }
}