// Battery profiles: Fixed Hardware + Battery Profile + Web Config + ESP32 Runtime.
// The ESP32 never guesses chemistry from voltage (12.1V is NOT proof of a 12V
// pack). The user selects a profile; the webapp compatibility-gates it; the
// ESP32 applies the deployed numeric limits generically. No battery-specific
// if/else lives in firmware — only `measured vs activeProfile.limit` checks.

export const CHEMISTRIES = ['LI_ION', 'LIFEPO4', 'LEAD_ACID', 'NIMH', 'CUSTOM']

// Fixed edge hardware envelope. INA219 bus ≈ 0–26V; current rating depends on
// the board shunt/power path, so it is configurable per deployment.
export const HARDWARE_ENVELOPE = {
  inaMaxBusVoltage: 26.0,
  inaMinBusVoltage: 0.0,
  maxCurrentA: 15.0,
  maxPowerW: 200.0,
  sensors: ['INA219', 'DHT', 'MQ2', 'MQ135'],
  cellTempSensing: false, // DHT is ambient-only; no NTC on fixed hardware
  cutoffHardware: false, // GPIO alone cannot break a high-current path
}

// Conservative chemistry defaults (V per CELL unless noted). Manufacturer or
// user values always win over these; these are a fallback, not a datasheet.
export const CHEMISTRY_DEFAULTS = {
  LI_ION: { cellVMin: 3.0, cellVMax: 4.2, cellVNom: 3.7, chargeMaxA: 1.5, dischargeMaxA: 5.0, chargeTempMax: 45, dischargeTempMax: 60, chargeTempMin: 0, dischargeTempMin: -20 },
  LIFEPO4: { cellVMin: 2.8, cellVMax: 3.65, cellVNom: 3.2, chargeMaxA: 3.0, dischargeMaxA: 10.0, chargeTempMax: 45, dischargeTempMax: 60, chargeTempMin: 0, dischargeTempMin: -20 },
  LEAD_ACID: { cellVMin: 1.75, cellVMax: 2.45, cellVNom: 2.0, chargeMaxA: 2.0, dischargeMaxA: 10.0, chargeTempMax: 40, dischargeTempMax: 50, chargeTempMin: -10, dischargeTempMin: -20 },
  NIMH: { cellVMin: 1.0, cellVMax: 1.45, cellVNom: 1.2, chargeMaxA: 1.0, dischargeMaxA: 3.0, chargeTempMax: 40, dischargeTempMax: 50, chargeTempMin: 0, dischargeTempMin: -20 },
  CUSTOM: { cellVMin: 3.0, cellVMax: 4.2, cellVNom: 3.7, chargeMaxA: 1.0, dischargeMaxA: 1.0, chargeTempMax: 40, dischargeTempMax: 50, chargeTempMin: 0, dischargeTempMin: -20 },
}

const finite = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function chemistryDefaults(chemistry) {
  const key = String(chemistry || 'CUSTOM').toUpperCase()
  return CHEMISTRY_DEFAULTS[key] || CHEMISTRY_DEFAULTS.CUSTOM
}

// Precedence: manufacturer spec > user-confirmed > chemistry default > fallback.
// Input: { chemistry, series, parallel, capacityAh, manufacturer spec overrides,
//   user thresholds }. Output: normalized profile with derived pack voltages.
export function buildProfileFromInput(input = {}) {
  const chemistry = CHEMISTRIES.includes(String(input.chemistry || '').toUpperCase())
    ? String(input.chemistry).toUpperCase()
    : 'CUSTOM'
  const d = chemistryDefaults(chemistry)
  const series = Math.max(1, Math.min(16, Math.floor(Number(input.series) || 1)))
  const parallel = Math.max(1, Math.min(8, Math.floor(Number(input.parallel) || 1)))
  const m = input.manufacturer || {}
  const u = input.user || {}

  const pick = (mKey, uKey, chemKey) => {
    const mv = finite(m[mKey])
    if (mv != null) return mv
    const uv = finite(u[uKey])
    if (uv != null) return uv
    return d[chemKey]
  }

  const cellVMin = pick('cellVMin', 'cellVMin', 'cellVMin')
  const cellVMax = pick('cellVMax', 'cellVMax', 'cellVMax')
  const cellVNom = finite(m.cellVNom ?? u.cellVNom) ?? d.cellVNom
  const chargeMaxA = pick('chargeMaxA', 'chargeMaxA', 'chargeMaxA')
  const dischargeMaxA = pick('dischargeMaxA', 'dischargeMaxA', 'dischargeMaxA')

  const vMin = cellVMin * series
  const vMax = cellVMax * series
  const vNom = cellVNom * series
  // Operating bands derived from pack floor/ceiling with chemistry-agnostic
  // 6%/12% guard margins; explicit user/manufacturer bands override them.
  const span = Math.max(0.1, vMax - vMin)
  const voltage = {
    minOperating: finite(m.vMin ?? u.vMin) ?? round2(vMin),
    warningLow: finite(m.warningLow ?? u.warningLow) ?? round2(vMin + span * 0.12),
    normalMin: finite(m.normalMin ?? u.normalMin) ?? round2(vMin + span * 0.25),
    normalMax: finite(m.normalMax ?? u.normalMax) ?? round2(vMax - span * 0.1),
    warningHigh: finite(m.warningHigh ?? u.warningHigh) ?? round2(vMax - span * 0.03),
    maxAllowed: finite(m.vMax ?? u.vMax) ?? round2(vMax),
  }

  return {
    profileId: String(input.profileId || '').slice(0, 40) || undefined,
    name: String(input.name || `${chemistry} ${series}S${parallel}P`).slice(0, 80),
    manufacturer: String(m.manufacturer || input.manufacturerName || '').slice(0, 60),
    model: String(m.model || '').slice(0, 60),
    chemistry,
    series,
    parallel,
    nominalVoltage: round2(finite(input.nominalVoltage) ?? vNom),
    capacityAh: finite(input.capacityAh) ?? null,
    voltage,
    current: { maxCharge: chargeMaxA, maxDischarge: dischargeMaxA, warning: round2(dischargeMaxA * 0.8) },
    temperature: {
      chargeMin: finite(m.chargeTempMin ?? u.chargeTempMin) ?? d.chargeTempMin,
      chargeMax: finite(m.chargeTempMax ?? u.chargeTempMax) ?? d.chargeTempMax,
      dischargeMin: finite(m.dischargeTempMin ?? u.dischargeTempMin) ?? d.dischargeTempMin,
      dischargeMax: finite(m.dischargeTempMax ?? u.dischargeTempMax) ?? d.dischargeTempMax,
    },
    version: Math.max(1, Math.floor(Number(input.version) || 1)),
  }
}

const round2 = (n) => Math.round(Number(n) * 100) / 100

// Map a profile to the deterministic engine config (batterySafety.js shape).
export function profileToEngineConfig(profile) {
  if (!profile) return {}
  const v = profile.voltage || {}
  const c = profile.current || {}
  const t = profile.temperature || {}
  return {
    voltage: {
      emergLow: v.minOperating != null ? v.minOperating - 0.5 : undefined,
      critLow: v.warningLow,
      warnLow: v.normalMin,
      warnHigh: v.normalMax,
      critHigh: v.warningHigh,
    },
    current: { chargeMax: c.maxCharge, dischargeMax: c.maxDischarge },
    thermal: { warn: t.dischargeMax != null ? t.dischargeMax - 20 : undefined, crit: t.dischargeMax != null ? t.dischargeMax - 15 : undefined },
  }
}

// Minimal numeric payload the ESP32 applies generically (no chemistry logic).
export function profileToEsp32Config(profile) {
  if (!profile) return null
  return {
    profile_id: profile.profileId || 'UNSET',
    config_version: profile.version || 1,
    voltage_max: profile.voltage?.maxAllowed ?? null,
    voltage_min: profile.voltage?.minOperating ?? null,
    charge_current_max: profile.current?.maxCharge ?? null,
    discharge_current_max: profile.current?.maxDischarge ?? null,
    temp_charge_max: profile.temperature?.chargeMax ?? null,
    temp_discharge_max: profile.temperature?.dischargeMax ?? null,
    nominal_voltage: profile.nominalVoltage ?? null,
    capacity_ah: profile.capacityAh ?? null,
  }
}

// Compatibility gate: measurement AND protection checks must BOTH pass before
// DEPLOY is allowed. Returns { compatible, measurement, protection, reasons[] }.
export function checkCompatibility(profile, hardware = HARDWARE_ENVELOPE) {
  const reasons = []
  const measurement = { voltage: false, current: false, sensors: true }
  const protection = { voltage: false, current: false, cutoff: true }

  const vMax = finite(profile?.voltage?.maxAllowed)
  const vMin = finite(profile?.voltage?.minOperating)
  const iMax = Math.max(finite(profile?.current?.maxDischarge) || 0, finite(profile?.current?.maxCharge) || 0)

  if (vMax == null || vMin == null || !(vMax > vMin)) {
    reasons.push('Profile voltage band is invalid (maxAllowed must exceed minOperating)')
  } else if (vMax > (hardware.inaMaxBusVoltage ?? 26) - 1) {
    // 1V headroom for charging overshoot + measurement margin.
    reasons.push(`Expected ${vMax}V exceeds INA219 bus headroom (~${hardware.inaMaxBusVoltage}V minus margin)`)
  } else {
    measurement.voltage = true
  }

  if (!(iMax > 0)) {
    reasons.push('Profile current limits are missing')
  } else if (iMax > (hardware.maxCurrentA ?? 15)) {
    reasons.push(`Expected ${iMax}A exceeds this board shunt/power-path rating (${hardware.maxCurrentA}A)`)
  } else {
    measurement.current = true
  }

  // Protection honesty: this fixed hardware senses ambient temp only and has
  // no rated high-current cutoff — flag as advisory, never block monitoring.
  if (!hardware.cellTempSensing) {
    reasons.push('Advisory: ambient DHT sensing only — mount NTCs on cells for true thermal protection')
  }
  if (!hardware.cutoffHardware) {
    reasons.push('Advisory: no rated charge/discharge cutoff on this board — ESP32 trips are alarms, not power breaks')
  }
  protection.voltage = measurement.voltage
  protection.current = measurement.current

  const compatible = measurement.voltage && measurement.current
  return { compatible, measurement, protection, reasons }
}

// Pre-connection validation: measured voltage must sit inside the deployed
// expected band (plus tolerance) or monitoring must NOT start as normal.
export function validatePreConnection(measuredVoltage, profile, toleranceV = 1.0) {
  const v = finite(measuredVoltage)
  const lo = finite(profile?.voltage?.minOperating)
  const hi = finite(profile?.voltage?.maxAllowed)
  if (v == null) return { state: 'NO_READING', ok: false, message: 'No voltage reading — check INA219 wiring' }
  if (lo == null || hi == null) return { state: 'UNKNOWN_BATTERY', ok: false, message: 'No valid profile deployed — configuration required, battery NOT assumed' }
  if (v < lo - toleranceV || v > hi + toleranceV) {
    return { state: 'PROFILE_MISMATCH', ok: false, message: `Profile mismatch: expected ${lo}–${hi}V, measured ${v}V. Monitoring not started — check profile and wiring` }
  }
  return { state: 'READY', ok: true, message: 'Voltage within expected profile band' }
}

export function unknownBatteryState() {
  return { state: 'UNKNOWN_BATTERY', ok: false, message: 'Battery detected but no valid profile deployed — configuration required' }
}
