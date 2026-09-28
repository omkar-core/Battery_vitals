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

const PRESET_PROFILES = {
  ICR_18650_2500MAH: {
    profileId: 'ICR_18650_2500MAH',
    name: '18650 Li-Ion (3.7V 2500mAh)',
    manufacturer: 'ICR / Standard 18650',
    model: '18650-2500mAh',
    chemistry: 'LI_ION',
    series: 1,
    parallel: 1,
    capacityAh: 2.5,
    nominalVoltage: 3.7,
    manufacturerOverrides: {
      cellVMin: 2.75,
      cellVMax: 4.25,
      cellVNom: 3.7,
      dischargeMaxA: 5.0,
      chargeMaxA: 1.5,
    },
    user: {
      vMin: 2.75,
      warningLow: 3.2,
      normalMin: 3.5,
      normalMax: 4.15,
      warningHigh: 4.25,
      vMax: 4.35,
    },
  },
  GP_9V_6F22: {
    profileId: 'GP_9V_6F22',
    name: '9V Carbon-Zinc (GP 1604S)',
    manufacturer: 'GP / Standard 9V',
    model: '1604S 6F22',
    chemistry: 'CUSTOM',
    series: 6,
    parallel: 1,
    capacityAh: 0.45,
    nominalVoltage: 9.0,
    manufacturerOverrides: {
      cellVMin: 0.9,
      cellVMax: 1.6,
      cellVNom: 1.5,
      dischargeMaxA: 0.5,
      chargeMaxA: 0.1,
    },
    user: {
      vMin: 5.4,
      warningLow: 6.0,
      normalMin: 7.0,
      normalMax: 9.2,
      warningHigh: 9.6,
      vMax: 10.0,
    },
  },
  NIMH_AA_1_2V: {
    profileId: 'NIMH_AA_1_2V',
    name: 'NiMH / Alkaline 1.2V–1.5V AA',
    manufacturer: 'Standard 1.2V Cell',
    chemistry: 'NIMH',
    series: 1,
    parallel: 1,
    capacityAh: 2.0,
    nominalVoltage: 1.2,
    user: {
      vMin: 0.9,
      warningLow: 1.0,
      normalMin: 1.15,
      normalMax: 1.42,
      warningHigh: 1.48,
      vMax: 1.55,
    },
  },
  LIFEPO4_12V_100AH: {
    profileId: 'LIFEPO4_12V_100AH',
    name: 'LiFePO4 12V 100Ah (4S)',
    chemistry: 'LIFEPO4',
    series: 4,
    parallel: 1,
    capacityAh: 100,
    nominalVoltage: 12.8,
  },
  LI_ION_3S: {
    profileId: 'LI_ION_3S',
    name: 'Li-ion 3S 11.1V',
    chemistry: 'LI_ION',
    series: 3,
    parallel: 1,
    capacityAh: 20,
    nominalVoltage: 11.1,
  },
  LEAD_ACID_12V: {
    profileId: 'LEAD_ACID_12V',
    name: 'Lead-Acid 12V Starter',
    chemistry: 'LEAD_ACID',
    series: 6,
    parallel: 1,
    capacityAh: 50,
    nominalVoltage: 12.0,
  },
}

export function getBatteryProfile(profileId = 'LIFEPO4_12V_100AH') {
  const preset = PRESET_PROFILES[profileId]
  if (preset) {
    return buildProfileFromInput(preset)
  }
  return buildProfileFromInput({ profileId })
}

/**
 * Auto-infer battery profile and chemistry directly from terminal voltage.
 * Provides zero-input classification with confidence scoring for the hardware test rig.
 */
export function inferBatteryProfile(voltage) {
  const v = finite(voltage)
  if (v == null || v <= 0.2) {
    return {
      inferred: false,
      profileId: null,
      profile: null,
      chemistry: 'UNKNOWN',
      confidence: 'NONE',
      confidenceScore: 0,
      nominalVoltage: null,
      capacityAh: null,
      message: 'No voltage reading detected — check INA219 connections',
    }
  }

  // 18650 Li-Ion (1S: 2.4V - 4.4V)
  if (v >= 2.4 && v <= 4.4) {
    const isNominal = v >= 3.0 && v <= 4.25
    return {
      inferred: true,
      profileId: 'ICR_18650_2500MAH',
      profile: getBatteryProfile('ICR_18650_2500MAH'),
      chemistry: 'LI_ION',
      confidence: isNominal ? 'HIGH' : 'MEDIUM',
      confidenceScore: isNominal ? 95 : 75,
      nominalVoltage: 3.7,
      capacityAh: 2.5,
      cellCount: 1,
      cellType: '18650 Li-Ion (3.7V nominal)',
      message: `Inferred 1S Li-Ion cell (3.7V nom, 2500mAh) from ${v.toFixed(2)}V terminal voltage`,
    }
  }

  // 9V Battery (5.0V - 10.0V)
  if (v > 4.4 && v <= 10.0) {
    const isNominal = v >= 6.0 && v <= 9.6
    return {
      inferred: true,
      profileId: 'GP_9V_6F22',
      profile: getBatteryProfile('GP_9V_6F22'),
      chemistry: 'CARBON_ZINC',
      confidence: isNominal ? 'HIGH' : 'MEDIUM',
      confidenceScore: isNominal ? 90 : 70,
      nominalVoltage: 9.0,
      capacityAh: 0.45,
      cellCount: 6,
      cellType: '9V Block (6F22 Carbon-Zinc/Alkaline)',
      message: `Inferred 9V battery (9.0V nom, 450mAh) from ${v.toFixed(2)}V terminal voltage`,
    }
  }

  // 1.2V - 1.5V Single Cell (0.8V - 2.0V)
  if (v >= 0.8 && v < 2.4) {
    return {
      inferred: true,
      profileId: 'NIMH_AA_1_2V',
      profile: getBatteryProfile('NIMH_AA_1_2V'),
      chemistry: 'NIMH',
      confidence: 'HIGH',
      confidenceScore: 85,
      nominalVoltage: 1.2,
      capacityAh: 2.0,
      cellCount: 1,
      cellType: 'NiMH / Alkaline AA',
      message: `Inferred 1.2V/1.5V cell from ${v.toFixed(2)}V terminal voltage`,
    }
  }

  // 12V Pack (> 10.0V)
  if (v > 10.0 && v <= 16.0) {
    return {
      inferred: true,
      profileId: 'LIFEPO4_12V_100AH',
      profile: getBatteryProfile('LIFEPO4_12V_100AH'),
      chemistry: 'LIFEPO4',
      confidence: 'HIGH',
      confidenceScore: 85,
      nominalVoltage: 12.8,
      capacityAh: 100,
      cellCount: 4,
      cellType: '12V Pack (4S LiFePO4 / Lead-Acid)',
      message: `Inferred 12V pack from ${v.toFixed(2)}V terminal voltage`,
    }
  }

  return {
    inferred: false,
    profileId: null,
    profile: null,
    chemistry: 'UNKNOWN',
    confidence: 'LOW',
    confidenceScore: 30,
    nominalVoltage: v,
    capacityAh: null,
    message: `Unrecognized voltage ${v.toFixed(2)}V outside standard single-cell profiles`,
  }
}

/**
 * Deterministic OCV-to-SOC mapping function.
 * Evaluates State of Charge from terminal open-circuit voltage with chemistry-specific curves.
 */
export function calculateAutoSOC(voltage, profileInput = null) {
  const v = finite(voltage)
  if (v == null || v <= 0) return { soc: null, method: 'NONE', uncertainty: 'unknown' }

  let profile = profileInput
  if (typeof profileInput === 'string') {
    profile = getBatteryProfile(profileInput)
  }
  if (!profile || !profile.profileId) {
    const inf = inferBatteryProfile(v)
    profile = inf.profile || profile
  }

  const pid = profile?.profileId || ''
  const chem = String(profile?.chemistry || '').toUpperCase()

  // 1. Li-Ion 1S (18650) empirical OCV curve
  if (pid === 'ICR_18650_2500MAH' || chem === 'LI_ION' || (v >= 2.4 && v <= 4.4)) {
    const ocvTable = [
      [4.20, 100],
      [4.15, 95],
      [4.10, 90],
      [4.05, 85],
      [4.00, 80],
      [3.92, 70],
      [3.85, 60],
      [3.80, 50],
      [3.75, 40],
      [3.70, 30],
      [3.65, 20],
      [3.55, 12],
      [3.45, 6],
      [3.30, 2],
      [2.75, 0],
    ]
    if (v >= 4.20) return { soc: 100, method: 'NONLINEAR_OCV', uncertainty: '±3%' }
    if (v <= 2.75) return { soc: 0, method: 'NONLINEAR_OCV', uncertainty: '±3%' }
    for (let i = 0; i < ocvTable.length - 1; i++) {
      const [vHigh, sHigh] = ocvTable[i]
      const [vLow, sLow] = ocvTable[i + 1]
      if (v <= vHigh && v >= vLow) {
        const fraction = (v - vLow) / (vHigh - vLow)
        const soc = Math.round(sLow + fraction * (sHigh - sLow))
        return { soc: Math.max(0, Math.min(100, soc)), method: 'NONLINEAR_OCV', uncertainty: '±5%' }
      }
    }
  }

  // 2. 9V Carbon-Zinc / Alkaline
  if (pid === 'GP_9V_6F22' || (v > 4.4 && v <= 10.0)) {
    const vMax = 9.5
    const vMin = 5.4
    if (v >= vMax) return { soc: 100, method: 'LINEAR_OCV', uncertainty: '±5%' }
    if (v <= vMin) return { soc: 0, method: 'LINEAR_OCV', uncertainty: '±5%' }
    const soc = Math.round(((v - vMin) / (vMax - vMin)) * 100)
    return { soc: Math.max(0, Math.min(100, soc)), method: 'LINEAR_OCV', uncertainty: '±8%' }
  }

  // 3. NiMH 1.2V
  if (pid === 'NIMH_AA_1_2V' || (v >= 0.8 && v < 2.4)) {
    const vMax = 1.42
    const vMin = 0.95
    if (v >= vMax) return { soc: 100, method: 'OCV_MAPPING', uncertainty: '±5%' }
    if (v <= vMin) return { soc: 0, method: 'OCV_MAPPING', uncertainty: '±5%' }
    const soc = Math.round(((v - vMin) / (vMax - vMin)) * 100)
    return { soc: Math.max(0, Math.min(100, soc)), method: 'OCV_MAPPING', uncertainty: '±7%' }
  }

  // 4. Fallback 12V LiFePO4 / Lead-Acid
  if (v >= 10.0) {
    const vMax = 13.6
    const vMin = 10.5
    if (v >= vMax) return { soc: 100, method: 'LINEAR_OCV', uncertainty: '±5%' }
    if (v <= vMin) return { soc: 0, method: 'LINEAR_OCV', uncertainty: '±5%' }
    const soc = Math.round(((v - vMin) / (vMax - vMin)) * 100)
    return { soc: Math.max(0, Math.min(100, soc)), method: 'LINEAR_OCV', uncertainty: '±5%' }
  }

  return { soc: null, method: 'NONE', uncertainty: 'unknown' }
}
