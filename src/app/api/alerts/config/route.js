import { NextResponse } from 'next/server'
import { getDB } from '../../../../lib/mongodb'
import { checkRateLimit, getClientIp } from '../../../../lib/rateLimit'

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
    try {
      const db = await getDB()
      const cfg = await db.collection('settings').findOne({ type: 'alert_thresholds' })
      if (cfg && cfg.config) {
        return NextResponse.json(cfg.config)
      }
    } catch (e) {}

    return NextResponse.json(inMemoryConfig)
  } catch (error) {
    return NextResponse.json(DEFAULT_CONFIG)
  }
}

export async function PUT(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`alerts_cfg_put_${ip}`, 30, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const updated = {
      battery: { ...inMemoryConfig.battery, ...(body.battery || {}) },
      environmental: { ...inMemoryConfig.environmental, ...(body.environmental || {}) },
      notifications: { ...inMemoryConfig.notifications, ...(body.notifications || {}) },
      updatedAt: new Date().toISOString(),
    }

    inMemoryConfig = updated

    try {
      const db = await getDB()
      await db.collection('settings').updateOne(
        { type: 'alert_thresholds' },
        { $set: { config: updated, updatedAt: new Date() } },
        { upsert: true }
      )
    } catch (e) {}

    return NextResponse.json({ success: true, config: updated })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update alert config', details: error.message }, { status: 500 })
  }
}
