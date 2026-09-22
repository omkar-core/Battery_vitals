import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { sanitizeString } from '../../../../lib/security'
import { getActiveDeployment } from '../../../../lib/profileStore'
import { profileToEngineConfig, profileToEsp32Config, checkCompatibility } from '../../../../lib/batteryProfiles'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`active_get_${ip}`, 60, 60000)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)

    const { searchParams } = new URL(request.url)
    const deviceId = sanitizeString(searchParams.get('deviceId') || searchParams.get('batteryId') || 'BAT001', 10)
    const deployment = await getActiveDeployment(deviceId)
    if (!deployment.profile) {
      return NextResponse.json({ deviceId, profileId: null, profile: null, engine: {}, esp32: null, compatibility: null, state: 'UNKNOWN_BATTERY', message: 'No valid profile deployed — configuration required, battery NOT assumed' })
    }
    return NextResponse.json({
      deviceId,
      profileId: deployment.profileId,
      profile: deployment.profile,
      engine: profileToEngineConfig(deployment.profile),
      esp32: profileToEsp32Config(deployment.profile),
      compatibility: checkCompatibility(deployment.profile),
      state: 'READY',
    })
  } catch (error) {
    return handleError(error, request)
  }
}
