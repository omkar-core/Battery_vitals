import { NextResponse } from 'next/server'
import { getDB } from '../../../lib/mongodb'
import { getLatestTelemetry, updateLatestTelemetry } from '../../../lib/firebaseAdmin'
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit'
import { sanitizeString, sanitizeNumber, secureErrorResponse } from '../../../lib/security'
import { telemetryShape } from '../data/route'
import { validateTelemetry, computeSafety } from '../../../lib/batterySafety'
import { ValidationError } from '../../../lib/errors'
import { handleError } from '../../../lib/errorHandler'
import { TelemetryPayloadSchema } from '../../../lib/schemas'
import { TelemetryNotFoundError } from '../../../lib/errors'
import { loadEngineConfig, loadEngineConfigForDevice } from '../../../lib/safetyConfig'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function GET(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`telemetry_get_${ip}`, 120, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { searchParams } = new URL(request.url)
    const batteryId = sanitizeString(searchParams.get('batteryId') || 'BAT001', 30)

    // 1. Try reading from Firebase Realtime Database
    let data = await getLatestTelemetry(batteryId)

    // 2. Fall back to MongoDB if Firebase has no telemetry yet
    if (!data) {
      try {
        const db = await getDB()
        data = await db.collection('live_data').findOne({ batteryId })
      } catch (dbErr) {
        console.warn('MongoDB lookup fallback failed in telemetry GET:', dbErr.message)
      }
    }

    if (!data) {
      throw new TelemetryNotFoundError(batteryId, 'latest')
    }

    return NextResponse.json(telemetryShape(data), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('telemetry get error:', error)
    return handleError(error, request)
  }
}

export async function POST(request) {
  try {
    const ip = getClientIp(request)
    const rateCheck = checkRateLimit(`telemetry_post_${ip}`, 180, 60000)
    if (!rateCheck.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))

    // Layer 21: Device Authentication Guard
    const providedToken = request.headers.get('x-device-token') || body.device_token || body.deviceToken
    const expectedToken = process.env.DEVICE_AUTH_TOKEN || 'bv_dev_sec_7f9a2b1c'
    if (process.env.DEVICE_AUTH_TOKEN && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized device: invalid device authentication token' }, { status: 401 })
    }

    const b = body.battery || body
    const g = body.gas || {}
    const e = body.environment || {}
    const n = body.network || {}

    // Zod gateway validation (VALIDATION.md Â§4.1): the documented flat ingest shape
    // `{ deviceId, voltage, current, temperature, ... }` is typed and range-checked
    // here. The layered ESP32 packet (`{ battery, gas, environment, network }`) is
    // additionally sanitized by the deterministic engine below.
    const isFlatIngest =
      !body.battery &&
      (body.voltage !== undefined || body.current !== undefined || body.temperature !== undefined || body.mq2 !== undefined || body.mq135 !== undefined)
    if (isFlatIngest) {
      const parsed = TelemetryPayloadSchema.safeParse(body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new ValidationError(issue?.message || 'Invalid telemetry payload', issue?.path?.join('.') || 'body')
      }
    }

    const batteryId = sanitizeString(body.batteryId || 'BAT001', 30)
    const now = new Date()

    const safetyMap = { SAFE: 'SAFE', CAUTION: 'CAUTION', WARNING: 'WARNING', CRITICAL: 'CRITICAL', SENSOR_FAULT: 'SAFE', EMERGENCY: 'EMERGENCY' }
    const rawSafety = b.safety ? String(b.safety).toUpperCase() : (body.state || '')
    const safety = rawSafety ? safetyMap[rawSafety] || 'SAFE' : null

    // Validate numeric bounds
    const voltage = sanitizeNumber(b.voltage, 0, 100)
    const current = sanitizeNumber(b.current != null ? (Math.abs(b.current) > 30 ? b.current / 1000 : b.current) : null, -500, 500)
    const power = sanitizeNumber(b.power != null ? (Math.abs(b.power) > 200 ? b.power / 1000 : b.power) : null, -5000, 5000)
    const soc = sanitizeNumber(b.soc, 0, 100)
    const sohValid = b.soh_valid === true || (b.soh_valid !== false && sanitizeNumber(b.resistance, 0, 1000) > 0)
    const soh = sohValid ? sanitizeNumber(b.soh, 0, 100) : null
    const temperature = sanitizeNumber(e.temperature != null ? e.temperature : body.temperature, -40, 150)
    const humidity = sanitizeNumber(e.humidity != null ? e.humidity : body.humidity, 0, 100)
    const mq2 = sanitizeNumber(g.index_mq2 != null ? g.index_mq2 : body.mq2, 0, 10000)
    const mq135 = sanitizeNumber(g.index_mq135 != null ? g.index_mq135 : body.mq135, 0, 10000)
    const bhi = sanitizeNumber(body.risk?.bhi != null ? body.risk.bhi : body.bhi, 0, 100)

    const document = {
      batteryId,
      deviceId: sanitizeString(body.deviceId || 'BV001', 30),
      voltage,
      current,
      power,
      soc,
      soh,
      temperature,
      humidity,
      gasIndex: { mq2, mq135, warm: g.warm != null ? Boolean(g.warm) : body.warm != null ? Boolean(body.warm) : null },
      safety,
      bhi,
      opDirection: sanitizeString((b.op || body.opDirection || '').toUpperCase(), 20),
      resistance: sanitizeNumber(b.resistance, 0, 1000),
      profile: sanitizeString(b.profile, 20),
      outputs: {
        auto: body.outputs?.auto != null ? Boolean(body.outputs.auto) : body.auto_mode != null ? Boolean(body.auto_mode) : null,
        red: body.outputs?.red != null ? Boolean(body.outputs.red) : body.red_led != null ? Boolean(body.red_led) : null,
        yellow: body.outputs?.yellow != null ? Boolean(body.outputs.yellow) : body.yellow_led != null ? Boolean(body.yellow_led) : null,
        green: body.outputs?.green != null ? Boolean(body.outputs.green) : body.green_led != null ? Boolean(body.green_led) : null,
        buzzer: body.outputs?.buzzer != null ? Boolean(body.outputs.buzzer) : body.buzzer != null ? Boolean(body.buzzer) : null,
      },
      network: {
        rssi: sanitizeNumber(n.rssi ?? body.wifi_rssi, -150, 0),
        heap: sanitizeNumber(n.heap ?? body.free_heap, 0, 10000000),
        ip: sanitizeString(n.ip || body.ip || '', 40),
      },
      timestamp: now.getTime(),
      receivedAt: now.toISOString(),
      dV_dt: sanitizeNumber(b.dV_dt ?? body.dV_dt, -60, 60),
      dT_dt: sanitizeNumber(b.dT_dt ?? body.dT_dt, -60, 60),
      mq2_rise: sanitizeNumber(b.mq2_rise ?? body.mq2_rise, -20000, 20000),
      energyWh: sanitizeNumber(b.energyWh ?? body.energyWh, 0, 1000000),
      cycles: sanitizeNumber(b.cycles ?? body.cycles, 0, 100000),
      errors: sanitizeNumber(b.errors ?? body.errors, 0, 4294967295),
    }

    // -------------------------------------------------------------------------
    // DETERMINISTIC SAFETY ENRICHMENT (Gap 7 â€” RULES.md Â§2).
    // Run the physics-based engine and merge safetyState + riskScore into every
    // document that is written to Firebase and MongoDB. Downstream consumers
    // (dashboards, history charts, AI diagnostics) use these pre-computed fields
    // directly instead of re-running the engine independently.
    // -------------------------------------------------------------------------
    const { clean: cleanDoc, issues: validationIssues } = validateTelemetry(document)
    const safetyResult = computeSafety(cleanDoc, await loadEngineConfigForDevice(batteryId).catch(() => loadEngineConfig()))
    document.safetyState = safetyResult.state
    document.riskScore = safetyResult.score
    document.safetyViolations = safetyResult.violations.map((v) => v.rule?.code).filter(Boolean)
    // Pre-connection validation: never assume chemistry from voltage. Without
    // a deployed profile the pack is UNKNOWN_BATTERY; outside the expected
    // band it is PROFILE_MISMATCH and must not look like normal monitoring.
    try {
      const { getActiveDeployment } = await import('../../../lib/profileStore')
      const { validatePreConnection } = await import('../../../lib/batteryProfiles')
      const deployment = await getActiveDeployment(batteryId)
      document.profileId = deployment?.profileId || null
      document.profileVersion = deployment?.configVersion || null
      const pre = validatePreConnection(voltage, deployment?.profile)
      document.profileState = pre.state
      if (!pre.ok) {
        document.safetyViolations = [...(document.safetyViolations || []), pre.state.toLowerCase()]
        document.validationIssues = [...(document.validationIssues || []), { field: 'profile', code: pre.state.toLowerCase() }]
      }
    } catch (e) {
      console.warn('profile pre-connection check failed:', e.message)
    }
    if (validationIssues.some((i) => i.code !== 'ok')) {
      document.validationIssues = validationIssues
        .filter((i) => i.code !== 'ok')
        .map((i) => ({ field: i.field, code: i.code }))
    }
    // -------------------------------------------------------------------------

    // 1. Update Real-Time Layer (Firebase Realtime Database)
    await updateLatestTelemetry(batteryId, document)

    // 2. Persist in MongoDB in background try/catch
    try {
      const db = await getDB()
      await db.collection('live_data').updateOne(
        { batteryId },
        { $set: document },
        { upsert: true }
      )
      await db.collection('readings').insertOne(document)
    } catch (dbErr) {
      console.warn('MongoDB persist in telemetry POST failed:', dbErr.message)
    }

    return NextResponse.json({ success: true, ts: now.getTime(), safetyState: safetyResult.state, riskScore: safetyResult.score })
  } catch (error) {
    console.error('telemetry post error:', error)
    return handleError(error, request)
  }
}
