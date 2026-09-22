import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { handleError } from '../../../../lib/errorHandler'
import { ValidationError } from '../../../../lib/errors'
import { AlertDispatchSchema } from '../../../../lib/schemas'
import { sanitizeString } from '../../../../lib/security'
import { DEFAULT_DISPATCH } from '../../../../lib/dispatch'

export const dynamic = 'force-dynamic'

const KEY = 'alert_dispatch'

// Secrets are always masked on read; they only round-trip through the server.
function maskSetting(config) {
  const token = sanitizeString(config.telegramBotToken, 200)
  return {
    ...config,
    telegramBotToken: token
      ? token.length > 8
        ? `${'*'.repeat(8)}${token.slice(-4)}`
        : '********'
      : '',
  }
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`dispatch_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }
    await requirePermission(request, PERMISSIONS.MANAGE_ALERTS)

    let config = { ...DEFAULT_DISPATCH }
    try {
      const db = await getDB()
      const doc = await db.collection('settings').findOne({ key: KEY })
      if (doc?.config) config = { ...DEFAULT_DISPATCH, ...doc.config }
    } catch (e) {
      console.warn('[settings/dispatch] load failed:', e.message)
    }

    return NextResponse.json({ success: true, config: maskSetting(config) })
  } catch (error) {
    return handleError(error, request)
  }
}

export async function PUT(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`dispatch_put_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requirePermission(request, PERMISSIONS.MANAGE_ALERTS)

    const body = await request.json().catch(() => ({}))
    const parsed = AlertDispatchSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw new ValidationError(issue?.message || 'Invalid dispatch settings', issue?.path?.join('.') || 'body')
    }

    // Preserve an existing Telegram token if the client sent a masked value.
    let config = parsed.data
    if (parsed.data.telegramBotToken && parsed.data.telegramBotToken.startsWith('*') && parsed.data.telegramBotToken.length > 4) {
      try {
        const db = await getDB()
        const doc = await db.collection('settings').findOne({ key: KEY })
        const existing = doc?.config?.telegramBotToken
        if (existing && !existing.startsWith('*')) config = { ...config, telegramBotToken: existing }
      } catch (e) {
        console.warn('[settings/dispatch] existing token lookup failed:', e.message)
      }
    }

    const db = await getDB()
    await db.collection('settings').updateOne(
      { key: KEY },
      { $set: { config, updatedAt: new Date().toISOString() } },
      { upsert: true }
    )
    return NextResponse.json({ success: true, config: maskSetting(config) })
  } catch (error) {
    return handleError(error, request)
  }
}