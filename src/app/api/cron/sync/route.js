import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { handleError } from '../../../../lib/errorHandler'
import { runFirebaseToMongoSync } from '../../../../lib/dataSync'
import { sanitizeString } from '../../../../lib/security'
import { AuthenticationError } from '../../../../lib/errors'

export const dynamic = 'force-dynamic'

// Scheduled job (vercel.json cron) that batches Firebase snapshots into MongoDB.
// Guarded by the CRON_SECRET that the scheduler (or cron.zone) passes via the
// `Authorization: Bearer` header or `?key=` query parameter.
export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`cron_sync_${ip}`, 6, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const secret = process.env.CRON_SECRET
    if (!secret) {
      console.warn('[cron/sync] CRON_SECRET not configured; endpoint disabled.')
      return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
    }

    const authHeader = request.headers.get('authorization') || ''
    const { searchParams } = new URL(request.url)
    const provided =
      authHeader.startsWith('Bearer ') ? authHeader.slice(7) :
      searchParams.get('key') || ''
    if (!provided || provided !== secret) {
      throw new AuthenticationError('Invalid cron secret')
    }

    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)
    const result = await runFirebaseToMongoSync({ batteryId })
    return NextResponse.json(result)
  } catch (error) {
    return handleError(error, request)
  }
}