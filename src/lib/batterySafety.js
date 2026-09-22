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

// Layer 12: Superset connection, lifecycle and hardware availability states
// layered around the 5 authoritative risk safety states.
export const LIFECYCLE_STATES = {
  INITIALIZING: 'INITIALIZING',
  SELF_TEST: 'SELF_TEST',
  NO_BATTERY: 'NO_BATTERY',
  PROFILE_REQUIRED: 'PROFILE_REQUIRED',
  VALIDATING: 'VALIDATING',
  RECOVERY: 'RECOVERY',
  SENSOR_FAULT: 'SENSOR_FAULT',
  HARDWARE_FAULT: 'HARDWARE_FAULT',
  COMMUNICATION_FAULT: 'COMMUNICATION_FAULT',
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

  // Rate-of-change helpers (computed by firmware or analytics, V/min etc.).
  // Bounded to physically plausible slopes so a corrupt spike cannot trip the
  // predictive layer; out-of-window slopes are dropped, never clamped.
  const rate = (raw, absMax) => {
    const n = Number(raw)
    if (!isFiniteNumber(n) || Math.abs(n) > absMax) return null
    return n
  }
  clean.dV_dt = rate(data.dV_dt ?? data.dVdt ?? data.voltageRate, 60)
  clean.dT_dt = rate(data.dT_dt ?? data.dTdt ?? data.tempRate, 60)
  clean.mq2_rise = rate(data.mq2_rise ?? data.gasRise ?? data.dMq2_dt, 20000)

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

// Engine threshold defaults — these are the firmware-mirroring constants.
// An optional per-call config (from /api/alerts/config) may relax/tighten the
// operational bands; validation windows (RANGES) are never configurable, so
// implausible readings are still rejected no matter what is configured.
// Same-hardware scope: INA219 (V/I/P) + DHT (T/RH) + MQ-2 + MQ-135 only.
// No NTC/ADXL/HX711/leakage inputs are assumed — those stay null/UNKNOWN.
export const DEFAULT_SAFETY_CONFIG = {
  voltage: { warnLow: 10.5, critLow: 10.0, emergLow: 9.5, warnHigh: 14.2, critHigh: 14.4 },
  thermal: { warn: 40, crit: 45, emerg: 55 },
  gas: { warn: 1500, crit: 3000 },
  gasMq135: { warn: 300, crit: 500 },
  current: { chargeMax: 10.0, dischargeMax: 15.0, shortCircuit: 30.0 },
  power: { warn: 150.0, crit: 200.0 },
  rates: { dVdtWarn: 0.5, dVdtCrit: 1.5, dTdtWarn: 2.0, dTdtCrit: 5.0, gasRiseWarn: 400.0, gasRiseCrit: 1000.0 },
  soh: { warn: 80, crit: 60 },
  soc: { warn: 20, crit: 10 },
  resistance: { warn: 50, crit: 100 },
}

const numOr = (field, fallback) => {
  if (field === undefined || field === null) return fallback
  const n = Number(field)
  return isFiniteNumber(n) ? n : fallback
}

// Clamp configured thresholds to the same physical windows used for validation,
// so a bad admin value can never widen a band beyond reality.
const clampThreshold = (key, n) => {
  const { min, max } = RANGES[key] || { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY }
  return Math.min(max, Math.max(min, n))
}

export function normalizeSafetyConfig(cfg = {}) {
  const v = cfg.voltage || {}
  const t = cfg.thermal || {}
  const g = cfg.gas || {}
  const g135 = cfg.gasMq135 || cfg.gas135 || {}
  const c = cfg.current || {}
  const p = cfg.power || {}
  const rt = cfg.rates || {}
  const s = cfg.soh || {}
  const soc = cfg.soc || {}
  const r = cfg.resistance || {}
  const d = DEFAULT_SAFETY_CONFIG
  return {
    voltage: {
      warnLow: clampThreshold('voltage', numOr(v.warnLow, d.voltage.warnLow)),
      critLow: clampThreshold('voltage', numOr(v.critLow, d.voltage.critLow)),
      emergLow: clampThreshold('voltage', numOr(v.emergLow, d.voltage.emergLow)),
      warnHigh: clampThreshold('voltage', numOr(v.warnHigh, d.voltage.warnHigh)),
      critHigh: clampThreshold('voltage', numOr(v.critHigh, d.voltage.critHigh)),
    },
    thermal: {
      warn: clampThreshold('temperature', numOr(t.warn, d.thermal.warn)),
      crit: clampThreshold('temperature', numOr(t.crit, d.thermal.crit)),
      emerg: clampThreshold('temperature', numOr(t.emerg, d.thermal.emerg)),
    },
    gas: {
      warn: clampThreshold('mq2', numOr(g.warn, d.gas.warn)),
      crit: clampThreshold('mq2', numOr(g.crit, d.gas.crit)),
    },
    gasMq135: {
      warn: clampThreshold('mq135', numOr(g135.warn, d.gasMq135.warn)),
      crit: clampThreshold('mq135', numOr(g135.crit, d.gasMq135.crit)),
    },
    current: {
      chargeMax: clampThreshold('current', numOr(c.chargeMax, d.current.chargeMax)),
      dischargeMax: clampThreshold('current', numOr(c.dischargeMax, d.current.dischargeMax)),
      shortCircuit: clampThreshold('current', numOr(c.shortCircuit, d.current.shortCircuit)),
    },
    power: {
      warn: clampThreshold('power', numOr(p.warn, d.power.warn)),
      crit: clampThreshold('power', numOr(p.crit, d.power.crit)),
    },
    rates: {
      dVdtWarn: Math.max(0, numOr(rt.dVdtWarn, d.rates.dVdtWarn)),
      dVdtCrit: Math.max(0, numOr(rt.dVdtCrit, d.rates.dVdtCrit)),
      dTdtWarn: Math.max(0, numOr(rt.dTdtWarn, d.rates.dTdtWarn)),
      dTdtCrit: Math.max(0, numOr(rt.dTdtCrit, d.rates.dTdtCrit)),
      gasRiseWarn: Math.max(0, numOr(rt.gasRiseWarn, d.rates.gasRiseWarn)),
      gasRiseCrit: Math.max(0, numOr(rt.gasRiseCrit, d.rates.gasRiseCrit)),
    },
    soh: { warn: clampThreshold('soh', numOr(s.warn, d.soh.warn)), crit: clampThreshold('soh', numOr(s.crit, d.soh.crit)) },
    soc: { warn: clampThreshold('soc', numOr(soc.warn, d.soc.warn)), crit: clampThreshold('soc', numOr(soc.crit, d.soc.crit)) },
    resistance: { warn: clampThreshold('resistance', numOr(r.warn, d.resistance.warn)), crit: clampThreshold('resistance', numOr(r.crit, d.resistance.crit)) },
  }
}

export function computeSafety(clean = {}, cfg = {}) {
  const violations = []
  const unknown = []

  const v = num(clean.voltage)
  const i = num(clean.current)
  const pwr = num(clean.power ?? (v != null && i != null ? v * i : null))
  const t = num(clean.temperature)
  const bhi = num(clean.bhi)
  const soh = num(clean.soh)
  const soc = num(clean.soc)
  const r = num(clean.resistance)
  const mq2 = num(clean.mq2)
  const mq135 = num(clean.mq135)
  const dVdt = num(clean.dV_dt ?? clean.dVdt ?? clean.voltageRate)
  const dTdt = num(clean.dT_dt ?? clean.dTdt ?? clean.tempRate)
  const gasRise = num(clean.mq2_rise ?? clean.gasRise ?? clean.dMq2_dt)

  const E = normalizeSafetyConfig(cfg)

  let worst = 'SAFE'

  const push = (state, rule) => {
    violations.push({ state, rule })
    if (SEVERITY_RANK[state] > SEVERITY_RANK[worst]) worst = state
  }

  // Deep-discharge emergency (mirrors firmware: voltage < 9.5V => BHI 90).
  const { warnLow, critLow, emergLow, warnHigh, critHigh } = E.voltage
  if (v != null && v < emergLow) push('EMERGENCY', { code: 'voltage_deep_discharge', field: 'voltage', value: `${v}V`, message: 'Deep-discharge voltage detected' })
  else if (v != null && (v < critLow || v > critHigh)) push('CRITICAL', { code: 'voltage_band_violation', field: 'voltage', value: `${v}V`, message: `Voltage outside the ${critLow}..${critHigh}V operating band` })
  else if (v != null && (v < warnLow || v > warnHigh)) push('WARNING', { code: 'voltage_drift', field: 'voltage', value: `${v}V`, message: 'Voltage drifting toward band edge' })

  // Electrical: INA219 charge/discharge overcurrent + short-circuit.
  // Sign convention: positive = discharging, negative = charging.
  const { chargeMax, dischargeMax, shortCircuit } = E.current
  if (i != null && Math.abs(i) >= shortCircuit) push('EMERGENCY', { code: 'short_circuit', field: 'current', value: `${i}A`, message: `Short-circuit signature: |I| >= ${shortCircuit}A` })
  else if (i != null && i >= dischargeMax) push('CRITICAL', { code: 'discharge_overcurrent', field: 'current', value: `${i}A`, message: `Discharge overcurrent above ${dischargeMax}A` })
  else if (i != null && i <= -chargeMax) push('CRITICAL', { code: 'charge_overcurrent', field: 'current', value: `${i}A`, message: `Charge overcurrent beyond ${chargeMax}A` })

  // Over-power (V*I) — same INA219 hardware, no new sensor.
  const { warn: pwrWarn, crit: pwrCrit } = E.power
  const absPwr = pwr != null ? Math.abs(pwr) : null
  if (absPwr != null && absPwr >= pwrCrit) push('CRITICAL', { code: 'over_power', field: 'power', value: `${pwr}W`, message: `Power above ${pwrCrit}W` })
  else if (absPwr != null && absPwr >= pwrWarn) push('WARNING', { code: 'power_elevated', field: 'power', value: `${pwr}W`, message: `Power above ${pwrWarn}W` })

  // Charger / load fault context: voltage edge + current direction agrees.
  if (v != null && i != null && v > warnHigh && i < -1) push('WARNING', { code: 'charger_fault', field: 'voltage', value: `${v}V/${i}A`, message: 'High voltage while charging — check charger regulation' })
  else if (v != null && i != null && v < warnLow && i > 1) push('WARNING', { code: 'load_fault', field: 'voltage', value: `${v}V/${i}A`, message: 'Low voltage under load — check load or cell capacity' })

  // Thermal: firmware sets BHI 95 above 55C (runaway edge) and +30 above 45C.
  const { warn: tempWarn, crit: tempCrit, emerg: tempEmerg } = E.thermal
  if (t != null && t > tempEmerg) push('EMERGENCY', { code: 'thermal_runaway_edge', field: 'temperature', value: `${t}°C`, message: 'Cell temperature at thermal runaway edge' })
  else if (t != null && t > tempCrit) push('CRITICAL', { code: 'over_temperature', field: 'temperature', value: `${t}°C`, message: `Cell temperature exceeds ${tempCrit}°C` })
  else if (t != null && t > tempWarn) push('WARNING', { code: 'temperature_elevated', field: 'temperature', value: `${t}°C`, message: `Cell temperature elevated above ${tempWarn}°C` })

  // Gas: firmware adds BHI weight above 1500 ADC.
  // Layer 19: Sensor Confidence Weighting — suppress false positive criticals during preheat
  const { warn: gasWarn, crit: gasCrit } = E.gas
  const gasConfidence = clean.sensor_confidence?.mq || (clean.gas_warm === false ? 'LOW' : 'HIGH')
  if (gasConfidence === 'LOW') {
    if (mq2 != null && mq2 > gasCrit) {
      push('CAUTION', { code: 'gas_warming_low_confidence', field: 'mq2', value: `${Math.round(mq2)} ADC`, message: 'MQ sensor warming up (LOW confidence) — reading elevated, monitoring' })
    }
  } else {
    if (mq2 != null && mq2 > gasCrit) push('CRITICAL', { code: 'gas_high', field: 'mq2', value: `${Math.round(mq2)} ADC`, message: 'Combustible gas reading critically high' })
    else if (mq2 != null && mq2 > gasWarn) push('WARNING', { code: 'gas_elevated', field: 'mq2', value: `${Math.round(mq2)} ADC`, message: `Combustible gas reading above ${gasWarn} ADC` })
  }

  // MQ-135 VOC/air-quality trend — broad sensor, never claims a specific gas.
  const { warn: aqiWarn, crit: aqiCrit } = E.gasMq135
  if (gasConfidence !== 'LOW') {
    if (mq135 != null && mq135 > aqiCrit) push('CRITICAL', { code: 'air_quality_critical', field: 'mq135', value: `${Math.round(mq135)} ADC`, message: 'VOC/air-quality reading critically high' })
    else if (mq135 != null && mq135 > aqiWarn) push('WARNING', { code: 'air_quality_elevated', field: 'mq135', value: `${Math.round(mq135)} ADC`, message: `VOC/air-quality reading above ${aqiWarn} ADC` })
  }

  // Predictive rate-of-change: rapid escalation before absolute limits trip.
  const { dVdtWarn, dVdtCrit, dTdtWarn, dTdtCrit, gasRiseWarn, gasRiseCrit } = E.rates
  if (dTdt != null && dTdt >= dTdtCrit) push('CRITICAL', { code: 'thermal_escalation_fast', field: 'dT_dt', value: `${dTdt}°C/min`, message: 'Rapid thermal escalation detected' })
  else if (dTdt != null && dTdt >= dTdtWarn) push('WARNING', { code: 'thermal_escalation', field: 'dT_dt', value: `${dTdt}°C/min`, message: 'Temperature rising faster than normal' })
  if (dVdt != null && Math.abs(dVdt) >= dVdtCrit) push('CRITICAL', { code: 'voltage_collapse_fast', field: 'dV_dt', value: `${dVdt}V/min`, message: 'Sudden voltage step detected' })
  else if (dVdt != null && Math.abs(dVdt) >= dVdtWarn) push('WARNING', { code: 'voltage_unstable', field: 'dV_dt', value: `${dVdt}V/min`, message: 'Abnormal voltage rate detected' })
  if (gasRise != null && gasRise >= gasRiseCrit) push('CRITICAL', { code: 'gas_escalation_fast', field: 'mq2_rise', value: `${Math.round(gasRise)} ADC/min`, message: 'Gas level rising rapidly' })
  else if (gasRise != null && gasRise >= gasRiseWarn) push('WARNING', { code: 'gas_escalation', field: 'mq2_rise', value: `${Math.round(gasRise)} ADC/min`, message: 'Gas level trending upward' })

  // Multi-sensor fusion: gas + temperature + voltage correlation.
  // MQ sensors are broad — this flags a *potential* fault, never a named gas.
  const tempHot = t != null && t > tempWarn
  const gasHot = (mq2 != null && mq2 > gasWarn) || (mq135 != null && mq135 > aqiWarn)
  const voltBad = v != null && (v < warnLow || v > warnHigh)
  if (tempHot && gasHot && voltBad) push('EMERGENCY', { code: 'fusion_thermal_gas_voltage', field: 'fusion', value: 'T+gas+V abnormal', message: 'Temperature, gas and voltage all abnormal — potential battery fault' })
  else if (tempHot && gasHot) push('CRITICAL', { code: 'fusion_thermal_gas', field: 'fusion', value: 'T+gas abnormal', message: 'Temperature and gas rising together — inspect pack' })

  // Battery health indices.
  if (bhi != null && bhi >= 90) push('EMERGENCY', { code: 'bhi_emergency', field: 'bhi', value: `${bhi}/100`, message: 'BHI in emergency zone' })
  else if (bhi != null && bhi >= 75) push('CRITICAL', { code: 'bhi_critical', field: 'bhi', value: `${bhi}/100`, message: 'BHI in critical zone' })
  else if (bhi != null && bhi >= 50) push('WARNING', { code: 'bhi_warning', field: 'bhi', value: `${bhi}/100`, message: 'BHI in warning zone' })
  else if (bhi != null && bhi >= 25) push('CAUTION', { code: 'bhi_caution', field: 'bhi', value: `${bhi}/100`, message: 'BHI in caution zone' })

  // Degradation indicators.
  const { warn: sohWarn, crit: sohCrit } = E.soh
  if (soh != null && soh < sohCrit) push('CRITICAL', { code: 'soh_critical', field: 'soh', value: `${soh}%`, message: `SOH below ${sohCrit}%` })
  else if (soh != null && soh < sohWarn) push('WARNING', { code: 'soh_degraded', field: 'soh', value: `${soh}%`, message: `SOH below the ${sohWarn}% replacement threshold` })

  const { warn: socWarn, crit: socCrit } = E.soc
  if (soc != null && soc < socCrit) push('WARNING', { code: 'soc_very_low', field: 'soc', value: `${soc}%`, message: `SOC below ${socCrit}%` })
  else if (soc != null && soc < socWarn) push('CAUTION', { code: 'soc_low', field: 'soc', value: `${soc}%`, message: `SOC below ${socWarn}%` })

  const { warn: resWarn, crit: resCrit } = E.resistance
  if (r != null && r > resCrit) push('CRITICAL', { code: 'resistance_high', field: 'resistance', value: `${r} mΩ`, message: `Internal resistance above ${resCrit} mΩ` })
  else if (r != null && r > resWarn) push('WARNING', { code: 'resistance_elevated', field: 'resistance', value: `${r} mΩ`, message: `Internal resistance above ${resWarn} mΩ` })

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
  const level = gradedResponse(worst)
  return { state: worst, score, violations, unknown, level, semantic: worst === 'UNKNOWN' || worst === 'SAFE' ? 'NORMAL' : worst === 'CAUTION' ? 'CAUTION' : worst === 'WARNING' ? 'WARNING' : 'CRITICAL' }
}

// ---------------------------------------------------------------------------
// 2b. GRADED PROTECTION RESPONSE (same hardware: LEDs + buzzer + advisories)
// Level 0 MONITOR (green) → 1 WARNING (yellow) → 2 ALARM (yellow+buzzer) →
// 3 CRITICAL (red+buzzer+disconnect advisory) → 4 EMERGENCY (red+buzzer+
// disconnect + notify + log). The web layer never drives GPIO directly;
// the ESP32 mirrors these levels locally in led_control.h.
// ---------------------------------------------------------------------------

export const PROTECTION_LEVELS = {
  SAFE: 0,
  CAUTION: 1,
  WARNING: 2,
  CRITICAL: 3,
  EMERGENCY: 4,
  UNKNOWN: 1,
}

export function gradedResponse(state) {
  const level = PROTECTION_LEVELS[state] ?? 1
  const table = {
    0: { level: 0, name: 'MONITOR', led: 'green', buzzer: 'off', action: 'none' },
    1: { level: 1, name: 'WARNING', led: 'yellow', buzzer: 'off', action: 'watch' },
    2: { level: 2, name: 'ALARM', led: 'yellow', buzzer: 'fast_beep', action: 'alert' },
    3: { level: 3, name: 'CRITICAL', led: 'red', buzzer: 'fast_beep', action: 'disconnect_advisory' },
    4: { level: 4, name: 'EMERGENCY', led: 'red', buzzer: 'continuous', action: 'disconnect_notify_log' },
  }
  return table[level] || table[1]
}

// Layer 5: Fault Latching + Manual Reset
export function evaluateLatchedSafety(currentSafetyState, previousLatchedState, isAcknowledged = false) {
  const isTrip = previousLatchedState === 'CRITICAL' || previousLatchedState === 'EMERGENCY'
  const dropsLower = currentSafetyState === 'SAFE' || currentSafetyState === 'CAUTION' || currentSafetyState === 'WARNING'
  if (isTrip && dropsLower && !isAcknowledged) {
    return {
      latchedState: 'RECOVERY',
      requiresManualReset: true,
      message: 'Active safety trip in recovery: manual acknowledgment required before clearing alarm.',
    }
  }
  return {
    latchedState: currentSafetyState,
    requiresManualReset: false,
    message: 'Operating state normal.',
  }
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
      current: num(Number(p.current ?? p.battery?.current)),
      power: num(Number(p.power ?? p.battery?.power)),
      temperature: num(Number(p.temperature ?? p.environment?.temperature)),
      humidity: num(Number(p.humidity ?? p.environment?.humidity)),
      mq2: num(Number(p.mq2 ?? p.gas?.index_mq2 ?? p.gasIndex?.mq2)),
      mq135: num(Number(p.mq135 ?? p.gas?.index_mq135 ?? p.gasIndex?.mq135)),
      bhi: num(Number(p.bhi ?? p.risk?.bhi)),
      soh: num(Number(p.soh ?? p.battery?.soh)),
      soc: num(Number(p.soc ?? p.battery?.soc)),
      resistance: num(Number(p.resistance ?? p.battery?.resistance)),
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
    current: summarize('current'),
    power: summarize('power'),
    temperature: summarize('temperature'),
    humidity: summarize('humidity'),
    mq2: summarize('mq2'),
    mq135: summarize('mq135'),
    bhi: summarize('bhi'),
    soh: summarize('soh'),
    soc: summarize('soc'),
    resistance: summarize('resistance'),
    series,
  }
}

// ---------------------------------------------------------------------------
// 4. TELEMETRY SNAPSHOT FOR THE AUDIT TRAIL (never includes NaN)
// ---------------------------------------------------------------------------

export function telemetrySnapshot(clean = {}) {
  const keys = ['voltage', 'current', 'power', 'temperature', 'humidity', 'soc', 'soh', 'bhi', 'resistance', 'mq2', 'mq135', 'rssi', 'dV_dt', 'dT_dt', 'mq2_rise']
  const out = { ts: clean.ts ?? null }
  for (const k of keys) out[k] = clean[k] != null ? clean[k] : null
  return out
}