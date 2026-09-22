import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../../../lib/rateLimit'
import { requirePermission } from '../../../../../lib/auth'
import { PERMISSIONS } from '../../../../../lib/permissions'
import { handleError } from '../../../../../lib/errorHandler'
import { ValidationError } from '../../../../../lib/errors'
import { DeployProfileSchema } from '../../../../../lib/schemas'
import { setActiveDeployment } from '../../../../../lib/profileStore'
import { profileToEsp32Config } from '../../../../../lib/batteryProfiles'
import { setAdminCommand } from '../../../../../lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

// DEPLOY TO ESP32: re-gates compatibility, stores the active profile, then
// pushes the minimal generic numeric payload to /commands/{deviceId}.
export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`deploy_post_${ip}`, 20, 60000)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    const actor = await requirePermission(request, PERMISSIONS.CONTROL_HARDWARE)

    const body = await request.json().catch(() => ({}))
    const parsed = DeployProfileSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid deploy request', issue?.path?.join('.') || 'body')
    }

    const result = await setActiveDeployment(parsed.data.deviceId, parsed.data.profileId, actor?.id ?? null)
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, compatibility: result.compatibility || null }, { status: 422 })
    }

    const esp32 = profileToEsp32Config(result.profile)
    await setAdminCommand(parsed.data.deviceId, {
      command: 'SET_PROFILE',
      value: result.profile.profileId,
      auto_mode: true,
      profile: esp32,
      profile_id: esp32.profile_id,
      config_version: esp32.config_version,
    })

    return NextResponse.json({ success: true, deviceId: parsed.data.deviceId, profile: result.profile, esp32, compatibility: result.compatibility })
  } catch (error) {
    return handleError(error, request)
  }
}
