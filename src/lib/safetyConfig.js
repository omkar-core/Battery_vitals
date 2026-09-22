import { getDB } from './mongodb'
import { DEFAULT_SAFETY_CONFIG, normalizeSafetyConfig } from './batterySafety'

// Loads operator-configured safety thresholds (saved via /api/alerts/config)
// and translates the friendly stored shape into the engine's threshold config.
// When no config has ever been saved, the firmware-mirroring defaults apply, so
// behavior is identical to the pre-configuration engine.

const numOr = (v, fallback) => (v === undefined || v === null || Number.isNaN(Number(v)) ? fallback : Number(v))

export function resolveEngineConfig(stored = {}) {
  const b = stored?.battery || {}
  const e = stored?.environmental || {}
  const d = DEFAULT_SAFETY_CONFIG

  const voltageMax = numOr(b.voltage_max, null)
  const tempMax = numOr(e.temperature_max, null)
  const mq2Threshold = numOr(e.mq2_threshold, null)

  return {
    voltage: {
      warnLow: numOr(b.voltage_min, d.voltage.warnLow),
      critLow: 10.0,
      emergLow: 9.5,
      warnHigh: voltageMax != null ? Math.max(11, voltageMax - 0.2) : d.voltage.warnHigh,
      critHigh: voltageMax != null ? Math.max(11, voltageMax) : d.voltage.critHigh,
    },
    thermal: {
      warn: tempMax != null ? Math.max(30, tempMax - 5) : d.thermal.warn,
      crit: tempMax != null ? Math.max(35, tempMax) : d.thermal.crit,
      emerg: d.thermal.emerg,
    },
    gas: {
      warn: mq2Threshold != null ? Math.max(500, Math.round(mq2Threshold * 1.875)) : d.gas.warn,
      crit: mq2Threshold != null ? Math.max(800, Math.round(mq2Threshold * 3.75)) : d.gas.crit,
    },
    soh: d.soh,
    soc: d.soc,
    resistance: d.resistance,
    gasMq135: d.gasMq135,
    current: d.current,
    power: d.power,
    rates: d.rates,
  }
}

// Memoized (10s) so lockout/analysis routes do not hammer MongoDB on every hit.
let cached = null
let cachedAt = 0

// Per-device loader: active battery profile wins over the legacy global
// alert thresholds; global config remains the fallback. Precedence:
// manufacturer spec > user profile > chemistry default > engine default.
export async function loadEngineConfigForDevice(deviceId) {
  try {
    const { getActiveDeployment } = await import('./profileStore')
    const { profileToEngineConfig } = await import('./batteryProfiles')
    const deployment = await getActiveDeployment(deviceId || 'BAT001')
    if (deployment?.profile) {
      const mapped = profileToEngineConfig(deployment.profile)
      const global = await loadEngineConfig()
      return normalizeSafetyConfig(deepMerge(global, mapped))
    }
  } catch (e) {
    console.warn('[safetyConfig] profile load failed, using global config:', e.message)
  }
  return loadEngineConfig()
}

function deepMerge(base = {}, over = {}) {
  const out = { ...base }
  for (const k of Object.keys(over)) {
    const o = over[k]
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      out[k] = { ...(base[k] || {}) }
      for (const sk of Object.keys(o)) {
        if (o[sk] !== undefined) out[k][sk] = o[sk]
      }
    } else if (o !== undefined) out[k] = o
  }
  return out
}

export async function loadEngineConfig() {
  const now = Date.now()
  if (cached && now - cachedAt < 10000) return cached

  let engineConfig = null
  try {
    const db = await getDB()
    const doc = await db.collection('settings').findOne({ type: 'alert_thresholds' })
    if (doc?.config?.engine) {
      engineConfig = normalizeSafetyConfig(doc.config.engine)
    }
  } catch (e) {
    console.warn('[safetyConfig] load failed, using engine defaults:', e.message)
  }
  cached = engineConfig || { ...DEFAULT_SAFETY_CONFIG }
  cachedAt = now
  return cached
}