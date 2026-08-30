// Deterministic, physics-based battery safety + validation engine.
// No generative AI is used here. This layer is the authoritative truth that
// the intelligence engine may interpret but never override.

export const SAFETY_STATES = {
  UNKNOWN: 'UNKNOWN',
  SAFE: 'SAFE',
  CAUTION: 'CAUTION',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  EMERGENCY: 'EMERGENCY',
}

// Severity ordering for state aggregation (highest wins).
export const SEVERITY_RANK = {
  SAFE: 0,
  CAUTION: 1,
  WARNING: 2,
  CRITICAL: 3,
  EMERGENCY: 4,
}

// Chemistry-agnostic plausible bounds matching the ESP32 packet schema
// (anomalous values outside these windows are flagged, never passed to AI).
const RANGES = {
  voltage: { min: 0.5, max: 100.0 },
  current: { min: -500.0, max: 500.0 },
  power: { min: -5000.0, max: 5000.0 },
  temperature: { min: -40.0, max: 150.0 },
  humidity: { min: 0.0, max: 100.0 },
  soc: { min: 0.0, max: 100.0 },
  soh: { min: 0.0, max: 100.0 },
  bhi: { min: 0.0, max: 100.0 },
  resistance: { min: 0.0, max: 1000.0 },
  mq2: { min: 0.0, max: 10000.0 },
  mq135: { min: 0.0, max: 10000.0 },
  rssi: { min: -150.0, max: 0.0 },
}

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v)
const num = (v) => (isFiniteNumber(v) ? v : null)

// ---------------------------------------------------------------------------
// 1. VALIDATION  (detects NaN / Infinity / impossible values / stale packets)
// ---------------------------------------------------------------------------

export function validateTelemetry(data = {}) {
  const issues = []
  const clean = {}

  for (const key of Object.keys(RANGES)) {
    const raw = data[key]
    if (raw === undefined || raw === null || raw === '') continue

    const value = Number(raw)
    if (!isFiniteNumber(value)) {
      issues.push({ code: 'invalid_number', field: key, message: `${key} is not a finite number`, severity: 'warning' })
      clean[key] = null
      continue
    }

    const { min, max } = RANGES[key]
    if (value < min || value > max) {
      issues.push({ code: 'out_of_range', field: key, message: `${key} = ${value} is outside the plausible ${min}..${max} window`, severity: 'warning' })
    }
    clean[key] = value
  }

  const gas = data.gasIndex || data.gas || {}
  const mq2Raw = data.mq2 ?? gas.index_mq2 ?? gas.mq2
  const mq135Raw = data.mq135 ?? gas.index_mq135 ?? gas.mq135
  clean.mq2 = num(Number(mq2Raw))
  clean.mq135 = num(Number(mq135Raw))

  // Keep sensor-health flags for the safety engine.
  clean.ina_ok = typeof data.ina_ok === 'boolean' ? data.ina_ok : null
  clean.dht_ok = typeof data.dht_ok === 'boolean' ? data.dht_ok : null

  // Staleness: flag packets whose timestamp is unreasonably old/future.
  const rawTs = data.timestamp ?? data.ts ?? data.receivedAt
  if (rawTs != null) {
    const ts = Number(new Date(rawTs).getTime())
    if (isFiniteNumber(ts) && ts > 0) {
      const ageMs = Date.now() - ts
      if (ageMs > 10 * 60 * 1000) {
        issues.push({ code: 'stale_telemetry', field: 'timestamp', message: `Telemetry is ${Math.round(ageMs / 60000)} minutes old`, severity: 'warning' })
        clean.stale = true
      } else {
        clean.stale = false
      }
      clean.ts = ts
    }
  }

  if (issues.length === 0) issues.push({ code: 'ok', field: '_', message: 'All reported telemetry values passed validation', severity: 'info' })

  return { valid: issues.every((i) => i.code === 'ok' || i.code === 'stale_telemetry'), issues, clean }
}

// ---------------------------------------------------------------------------
// 2. DETERMINISTIC SAFETY STATE  (mirrors ESP32 firmware thresholds)
// ---------------------------------------------------------------------------

export function computeSafety(clean = {}) {
  const violations = []
  const unknown = []

  const v = num(clean.voltage)
  const t = num(clean.temperature)
  const bhi = num(clean.bhi)
  const soh = num(clean.soh)
  const soc = num(clean.soc)
  const r = num(clean.resistance)
  const mq2 = num(clean.mq2)

  let worst = 'SAFE'

  const push = (state, rule) => {
    violations.push({ state, rule })
    if (SEVERITY_RANK[state] > SEVERITY_RANK[worst]) worst = state
  }

  // Deep-discharge emergency (mirrors firmware: voltage < 9.5V => BHI 90).
  if (v != null && v < 9.5) push('EMERGENCY', { code: 'voltage_deep_discharge', field: 'voltage', value: `${v}V`, message: 'Deep-discharge voltage detected' })
  else if (v != null && (v < 10.0 || v > 14.4)) push('CRITICAL', { code: 'voltage_band_violation', field: 'voltage', value: `${v}V`, message: 'Voltage outside the 10.0..14.4V operating band' })
  else if (v != null && (v < 10.5 || v > 14.2)) push('WARNING', { code: 'voltage_drift', field: 'voltage', value: `${v}V`, message: 'Voltage drifting toward band edge' })

  // Thermal: firmware sets BHI 95 above 55C (runaway edge) and +30 above 45C.
  if (t != null && t > 55) push('EMERGENCY', { code: 'thermal_runaway_edge', field: 'temperature', value: `${t}°C`, message: 'Cell temperature at thermal runaway edge' })
  else if (t != null && t > 45) push('CRITICAL', { code: 'over_temperature', field: 'temperature', value: `${t}°C`, message: 'Cell temperature exceeds 45°C' })
  else if (t != null && t > 40) push('WARNING', { code: 'temperature_elevated', field: 'temperature', value: `${t}°C`, message: 'Cell temperature elevated above 40°C' })

  // Gas: firmware adds BHI weight above 1500 ADC.
  if (mq2 != null && mq2 > 3000) push('CRITICAL', { code: 'gas_high', field: 'mq2', value: `${Math.round(mq2)} ADC`, message: 'Combustible gas reading critically high' })
  else if (mq2 != null && mq2 > 1500) push('WARNING', { code: 'gas_elevated', field: 'mq2', value: `${Math.round(mq2)} ADC`, message: 'Combustible gas reading above 1500 ADC' })

  // Battery health indices.
  if (bhi != null && bhi >= 90) push('EMERGENCY', { code: 'bhi_emergency', field: 'bhi', value: `${bhi}/100`, message: 'BHI in emergency zone' })
  else if (bhi != null && bhi >= 75) push('CRITICAL', { code: 'bhi_critical', field: 'bhi', value: `${bhi}/100`, message: 'BHI in critical zone' })
  else if (bhi != null && bhi >= 50) push('WARNING', { code: 'bhi_warning', field: 'bhi', value: `${bhi}/100`, message: 'BHI in warning zone' })
  else if (bhi != null && bhi >= 25) push('CAUTION', { code: 'bhi_caution', field: 'bhi', value: `${bhi}/100`, message: 'BHI in caution zone' })

  // Degradation indicators.
  if (soh != null && soh < 60) push('CRITICAL', { code: 'soh_critical', field: 'soh', value: `${soh}%`, message: 'SOH below 60%' })
  else if (soh != null && soh < 80) push('WARNING', { code: 'soh_degraded', field: 'soh', value: `${soh}%`, message: 'SOH below the 80% replacement threshold' })

  if (soc != null && soc < 10) push('WARNING', { code: 'soc_very_low', field: 'soc', value: `${soc}%`, message: 'SOC below 10%' })
  else if (soc != null && soc < 20) push('CAUTION', { code: 'soc_low', field: 'soc', value: `${soc}%`, message: 'SOC below 20%' })

  if (r != null && r > 100) push('CRITICAL', { code: 'resistance_high', field: 'resistance', value: `${r} mΩ`, message: 'Internal resistance above 100 mΩ' })
  else if (r != null && r > 50) push('WARNING', { code: 'resistance_elevated', field: 'resistance', value: `${r} mΩ`, message: 'Internal resistance above 50 mΩ' })

  // Sensor fault takes precedence (mirrors firmware).
  const inaOk = clean.ina_ok
  const dhtOk = clean.dht_ok
  if (inaOk === false && dhtOk === false) {
    push('CRITICAL', { code: 'sensor_fault', field: 'sensors', value: 'ina_ok=false, dht_ok=false', message: 'No valid power path or ambient sensor read' })
  }

  // Honesty: if the essential safety sensors never reported, we say UNKNOWN.
  const essentialMissing = ['voltage', 'temperature', 'bhi'].filter((k) => clean[k] == null)
  if (essentialMissing.length >= 2 && worst === 'SAFE') {
    worst = 'UNKNOWN'
    unknown.push(...essentialMissing)
  }

  const score = estimateRiskScore(violations, bhi)
  return { state: worst, score, violations, unknown, semantic: worst === 'UNKNOWN' || worst === 'SAFE' ? 'NORMAL' : worst === 'CAUTION' ? 'CAUTION' : worst === 'WARNING' ? 'WARNING' : 'CRITICAL' }
}

function estimateRiskScore(violations, bhi) {
  const weight = { CAUTION: 15, WARNING: 35, CRITICAL: 60, EMERGENCY: 85 }
  let score = 0
  for (const v of violations) score = Math.max(score, weight[v.state] || 0)

  if (bhi != null) score = Math.max(score, Math.round((bhi / 100) * 90))
  if (score === 0 && violations.length > 0) score = 10
  return Math.min(100, Math.max(0, score))
}

// ---------------------------------------------------------------------------
// 3. DETERMINISTIC HISTORY STATISTICS  (math in code, not in AI)
// ---------------------------------------------------------------------------

export function summarizeHistory(rows = [], maxPoints = 20) {
  const points = (Array.isArray(rows) ? rows : []).slice(-maxPoints)
  if (points.length === 0) return { count: 0, window: 'none', series: [] }

  const series = points.map((p) => {
    const ts = p.timestamp ?? p.time ?? p.ts ?? p.receivedAt
    return {
      time: ts != null ? new Date(ts).getTime() : null,
      voltage: num(Number(p.voltage ?? p.battery?.voltage)),
      temperature: num(Number(p.temperature ?? p.environment?.temperature)),
      bhi: num(Number(p.bhi ?? p.risk?.bhi)),
      soh: num(Number(p.soh ?? p.battery?.soh)),
      soc: num(Number(p.soc ?? p.battery?.soc)),
    }
  })

  const summarize = (key) => {
    const vals = series.map((s) => s[key]).filter((x) => x != null)
    if (vals.length === 0) return null
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return { count: vals.length, min: Math.round(min * 100) / 100, max: Math.round(max * 100) / 100, avg: Math.round(avg * 100) / 100, latest: vals[vals.length - 1] }
  }

  return {
    count: points.length,
    voltage: summarize('voltage'),
    temperature: summarize('temperature'),
    bhi: summarize('bhi'),
    soh: summarize('soh'),
    soc: summarize('soc'),
    series,
  }
}

// ---------------------------------------------------------------------------
// 4. TELEMETRY SNAPSHOT FOR THE AUDIT TRAIL (never includes NaN)
// ---------------------------------------------------------------------------

export function telemetrySnapshot(clean = {}) {
  const keys = ['voltage', 'current', 'power', 'temperature', 'humidity', 'soc', 'soh', 'bhi', 'resistance', 'mq2', 'mq135', 'rssi']
  const out = { ts: clean.ts ?? null }
  for (const k of keys) out[k] = clean[k] != null ? clean[k] : null
  return out
}