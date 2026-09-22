import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { requirePermission } from '../../../lib/auth'
import { PERMISSIONS } from '../../../lib/permissions'
import { handleError } from '../../../lib/errorHandler'
import { ValidationError } from '../../../lib/errors'
import { DeviceSchema } from '../../../lib/schemas'
import { listDevices, registerDevice } from '../../../lib/deviceRegistry'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`devices_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    await requirePermission(request, PERMISSIONS.VIEW_TELEMETRY)

    const devices = await listDevices()
    return NextResponse.json({ success: true, devices })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`devices_post_${ip}`, 20, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    await requirePermission(request, PERMISSIONS.CONTROL_HARDWARE)

    const body = await request.json().catch(() => ({}))
    const parsed = DeviceSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid device data', issue?.path?.join('.') || 'body')
    }

    const device = await registerDevice(parsed.data)
    return NextResponse.json({ success: true, device })
  } catch (error) {
    return handleError(error, request)
  }
}