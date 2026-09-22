import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'
import { ValidationError } from '../../../../lib/errors'
import { handleError } from '../../../../lib/errorHandler'
import { AlertThresholdConfigSchema } from '../../../../lib/schemas'
import { requirePermission } from '../../../../lib/auth'
import { PERMISSIONS } from '../../../../lib/permissions'
import { resolveEngineConfig } from '../../../../lib/safetyConfig'

export const dynamic = 'force-dynamic'

const DEFAULT_CONFIG = {
  battery: {
    voltage_min: 10.5,
    voltage_max: 14.6,
    current_max: 15.0,
    temperature_max: 45.0,
    soc_critical: 10.0,
  },
  environmental: {
    temperature_max: 40.0,
    humidity_max: 80.0,
    mq2_threshold: 800,
    mq135_threshold: 500,
  },
  notifications: {
    sound_enabled: true,
    email_enabled: false,
    sms_enabled: false,
  },
  updatedAt: new Date().toISOString(),
}

let inMemoryConfig = { ...DEFAULT_CONFIG }

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_cfg_get_${ip}`, 60, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    try {
      const db = await getDB()
      const cfg = await db.collection('settings').findOne({ type: 'alert_thresholds' })
      if (cfg && cfg.config) {
        return NextResponse.json(cfg.config)
      }
    } catch (e) {}

    return NextResponse.json(inMemoryConfig)
  } catch (error) {
    return handleError(error, request)
  }
}

export async function PUT(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_cfg_put_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    // Only operators and admins may change safety thresholds.
    await requirePermission(request, PERMISSIONS.MANAGE_ALERTS)

    const body = await request.json().catch(() => ({}))
    const updated = {
      battery: { ...inMemoryConfig.battery, ...(body.battery || {}) },
      environmental: { ...inMemoryConfig.environmental, ...(body.environmental || {}) },
      notifications: { ...inMemoryConfig.notifications, ...(body.notifications || {}) },
      updatedAt: new Date().toISOString(),
    }

    // Alert tuning schema (VALIDATION.md §4.3): validates any flat threshold keys
    // (`voltage_max`, `voltage_min`, `temp_warning`, `temp_critical`, `mq2_warning`,
    // `mq2_critical`) the client supplies, using the documented physical bounds.
    const FLAT_THRESHOLD_KEYS = ['voltage_max', 'voltage_min', 'temp_warning', 'temp_critical', 'mq2_warning', 'mq2_critical']
    const provided = {}
    for (const k of FLAT_THRESHOLD_KEYS) {
      if (body[k] !== undefined) provided[k] = body[k]
    }
    if (Object.keys(provided).length > 0) {
      const requestedShape = FLAT_THRESHOLD_KEYS.reduce((acc, k) => ((acc[k] = true), acc), {})
      const parsed = AlertThresholdConfigSchema.pick(requestedShape).safeParse(provided)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new ValidationError(issue?.message || 'Invalid alert threshold value', issue?.path?.join('.') || 'body')
      }
    }

    inMemoryConfig = updated

    // Derive the engine threshold config so the deterministic safety engine
    // actually applies these values on subsequent computeSafety() calls.
    const engine = resolveEngineConfig(updated)
    const storedDoc = { config: { ...updated, engine } }

    try {
      const db = await getDB()
      await db.collection('settings').updateOne(
        { type: 'alert_thresholds' },
        { $set: { ...storedDoc, updatedAt: new Date() } },
        { upsert: true }
      )
    } catch (e) {}

    return NextResponse.json({ success: true, config: updated })
  } catch (error) {
    return handleError(error, request)
  }
}
