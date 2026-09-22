import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { ValidationError } from '../../../../lib/errors'
import { BatteryProfileSchema } from '../../../../lib/schemas'
import { listProfiles, saveProfile } from '../../../../lib/profileStore'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`profiles_get_${ip}`, 60, 60000)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)
    const profiles = await listProfiles()
    return NextResponse.json({ success: true, count: profiles.length, profiles: profiles.map((p) => ({ ...p, _id: String(p._id) })) })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rate = checkRateLimit(`profiles_post_${ip}`, 20, 60000)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    const actor = await requirePermission(request, PERMISSIONS.EDIT_SETTINGS)

    const body = await request.json().catch(() => ({}))
    const parsed = BatteryProfileSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid battery profile', issue?.path?.join('.') || 'body')
    }

    const { profile, compatibility } = await saveProfile(parsed.data, actor?.id ?? null)
    const status = compatibility.compatible ? 200 : 422
    return NextResponse.json(
      { success: compatibility.compatible, profile, compatibility, warning: compatibility.compatible ? undefined : 'Profile stored but NOT deployable — resolve compatibility first' },
      { status },
    )
  } catch (error) {
    return handleError(error, request)
  }
}
