// Deterministic battery analytics — same-hardware scope only.
// Inputs: INA219 (V/I/P) + DHT (T/RH) + MQ-2 + MQ-135 history already
// validated by batterySafety.js. No new sensors assumed, no AI, no guesses:
// every helper returns null / "insufficient_data" when history is too thin.

const finite = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export const PACK = { vEmpty: 10.5, vFull: 12.6, nominalAh: 7.0 }

// Linear SOC from pack voltage (matches ESP32 firmware curve).
// Optional `pack` override: { vEmpty, vFull } from the active profile.
export function estimateSOCVoltage(voltage, pack) {
  const v = finite(voltage)
  if (v == null) return null
  const vFull = finite(pack?.vFull) ?? PACK.vFull
  const vEmpty = finite(pack?.vEmpty) ?? PACK.vEmpty
  if (vFull <= vEmpty) return null
  if (v >= vFull) return 100
  if (v <= vEmpty) return 0
  return Math.round(((v - vEmpty) / (vFull - vEmpty)) * 1000) / 10
}

// Coulomb-counting correction: soc + (charge integrated / capacity).
// currentA: positive = discharging. dtSec: elapsed seconds.
export function coulombUpdate(prevSoc, currentA, dtSec, capacityAh = PACK.nominalAh) {
  const s = finite(prevSoc)
  const i = finite(currentA)
  const dt = finite(dtSec)
  const cap = finite(capacityAh)
  if (s == null || i == null || dt == null || cap == null || cap <= 0 || dt <= 0) return null
  return clamp(s - (i * (dt / 3600) / cap) * 100, 0, 100)
}

// Load-step internal resistance: R = |dV / dI| in milliohms.
// Returns null when the current step is too small to trust (noise guard).
export function estimateResistance(dV, dI) {
  const dv = finite(dV)
  const di = finite(dI)
  if (dv == null || di == null || Math.abs(di) < 0.05) return null
  const mohm = (Math.abs(dv) / Math.abs(di)) * 1000
  if (!Number.isFinite(mohm) || mohm < 0 || mohm > 1000) return null
  return Math.round(mohm * 10) / 10
}

export function resistanceFromStep(before, after) {
  if (!before || !after) return null
  return estimateResistance(
    Number(after.voltage ?? after.v) - Number(before.voltage ?? before.v),
    Number(after.current ?? after.i) - Number(before.current ?? before.i),
  )
}

// Equivalent full cycles (energy-throughput method, not plug-count).
export function equivalentFullCycles(cumulativeChargeAh, nominalAh = PACK.nominalAh) {
  const cum = finite(cumulativeChargeAh)
  const nom = finite(nominalAh)
  if (cum == null || nom == null || nom <= 0 || cum < 0) return null
  return Math.floor((cum / nom) * 10) / 10
}

// Integrate amp-hours + watt-hours from a time-ordered series.
// Row shape: { time|timestamp|ts, voltage, current, power }.
export function integrateEnergy(rows = []) {
  let chargeAh = 0
  let dischargeAh = 0
  let energyWh = 0
  let counted = 0
  for (let k = 1; k < rows.length; k += 1) {
    const a = rows[k - 1]
    const b = rows[k]
    const ta = new Date(a.time ?? a.timestamp ?? a.ts ?? a.receivedAt).getTime()
    const tb = new Date(b.time ?? b.timestamp ?? b.ts ?? b.receivedAt).getTime()
    const i = finite(b.current ?? b.battery?.current)
    const v = finite(b.voltage ?? b.battery?.voltage)
    if (!Number.isFinite(ta) || !Number.isFinite(tb) || i == null) continue
    const dtH = (tb - ta) / 3600000
    if (!(dtH > 0) || dtH > 24) continue
    const ah = i * dtH
    if (ah > 0) dischargeAh += ah
    else chargeAh += Math.abs(ah)
    const p = finite(b.power ?? b.battery?.power) ?? (v != null ? v * i : null)
    if (p != null) energyWh += p * dtH
    counted += 1
  }
  const r2 = (n) => Math.round(n * 100) / 100
  return { chargeAh: r2(chargeAh), dischargeAh: r2(dischargeAh), throughputAh: r2(chargeAh + dischargeAh), energyWh: r2(energyWh), segments: counted }
}

// Slope per minute between first and last valid sample of `key`.
export function slopePerMinute(rows = [], key) {
  const pts = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      t: new Date(r.time ?? r.timestamp ?? r.ts ?? r.receivedAt).getTime(),
      v: finite(r[key] ?? r.battery?.[key] ?? r.environment?.[key] ?? r.gas?.[`index_${key}`]),
    }))
    .filter((p) => Number.isFinite(p.t) && p.v != null)
  if (pts.length < 2) return null
  const first = pts[0]
  const last = pts[pts.length - 1]
  const dtMin = (last.t - first.t) / 60000
  if (!(dtMin > 0)) return null
  return (last.v - first.v) / dtMin
}

// Multi-parameter hazard fusion for the SAME sensors (0-100 + band).
// Weights: voltage 30 / current 15 / temperature 25 / gas 20 / resistance 10.
// Optional `cfg` for profile-derived voltage/current bands:
// { vEmerg: [lo,hi], vCrit: [lo,hi], vWarn: [lo,hi], vCaution: [lo,hi],
//   iShort, iMax, iWarn, iCaution }
// Falls back to the same hardcoded 12V defaults when no profile is active.
export function fuseHazardIndex(input = {}, cfg = {}) {
  const parts = []
  const v = finite(input.voltage)
  const i = finite(input.current)
  const t = finite(input.temperature)
  const mq2 = finite(input.mq2)
  const mq135 = finite(input.mq135)
  const r = finite(input.resistance)

  // Voltage bands from active profile or fallback defaults
  const vEmergLo = finite(cfg.vEmergLo) ?? 9.5
  const vEmergHi = finite(cfg.vEmergHi) ?? 14.6
  const vCritLo = finite(cfg.vCritLo) ?? 10.0
  const vCritHi = finite(cfg.vCritHi) ?? 14.4
  const vWarnLo = finite(cfg.vWarnLo) ?? 10.5
  const vWarnHi = finite(cfg.vWarnHi) ?? 14.2
  const vCautionLo = finite(cfg.vCautionLo) ?? 11.0
  const vCautionHi = finite(cfg.vCautionHi) ?? 14.0

  if (v != null) {
    let s = 0
    if (v < vEmergLo || v > vEmergHi) s = 100
    else if (v < vCritLo || v > vCritHi) s = 75
    else if (v < vWarnLo || v > vWarnHi) s = 45
    else if (v < vCautionLo || v > vCautionHi) s = 15
    parts.push({ w: 30, s })
  }
  if (i != null) {
    const a = Math.abs(i)
    const iShort = finite(cfg.iShort) ?? 30
    const iMax = finite(cfg.iMax) ?? 15
    const iWarn = finite(cfg.iWarn) ?? 10
    const iCaution = finite(cfg.iCaution) ?? 5
    parts.push({ w: 15, s: a >= iShort ? 100 : a >= iMax ? 75 : a >= iWarn ? 45 : a >= iCaution ? 15 : 0 })
  }
  if (t != null) {
    parts.push({ w: 25, s: t > 55 ? 100 : t > 45 ? 75 : t > 40 ? 45 : t > 35 ? 15 : 0 })
  }
  if (mq2 != null || mq135 != null) {
    const g2 = mq2 != null ? (mq2 > 3000 ? 100 : mq2 > 1500 ? 55 : mq2 > 800 ? 20 : 0) : 0
    const g135 = mq135 != null ? (mq135 > 500 ? 100 : mq135 > 300 ? 55 : mq135 > 150 ? 20 : 0) : 0
    parts.push({ w: 20, s: Math.max(g2, g135) })
  }
  if (r != null) {
    parts.push({ w: 10, s: r > 100 ? 100 : r > 50 ? 55 : r > 30 ? 20 : 0 })
  }
  if (parts.length === 0) return { index: null, band: 'UNKNOWN' }
  const wSum = parts.reduce((a, p) => a + p.w, 0)
  const index = Math.round(parts.reduce((a, p) => a + p.w * p.s, 0) / wSum)
  const band = index <= 20 ? 'NORMAL' : index <= 40 ? 'WATCH' : index <= 60 ? 'WARNING' : index <= 80 ? 'HIGH_RISK' : 'CRITICAL'
  return { index, band }
}

// Deterministic trend predictions from history. Honest by construction:
// fewer than 3 usable points yields `insufficient_data`, never a failure date.
export function predictFromHistory(rows = [], cfg = {}) {
  const n = Array.isArray(rows) ? rows.length : 0
  if (n < 3) {
    return { status: 'insufficient_data', message: 'insufficient data to establish RUL trend', trends: [] }
  }
  const dTdt = slopePerMinute(rows, 'temperature')
  const dVdt = slopePerMinute(rows, 'voltage')
  const dMq2 = slopePerMinute(rows, 'mq2')
  const warnT = cfg.dTdtWarn ?? 2.0
  const warnV = cfg.dVdtWarn ?? 0.5
  const warnG = cfg.gasRiseWarn ?? 400.0
  const trends = []
  if (dTdt != null && dTdt >= warnT) {
    trends.push({ code: 'thermal_escalation', severity: dTdt >= warnT * 2.5 ? 'CRITICAL' : 'WARNING', slope: `${dTdt.toFixed(2)}°C/min`, message: 'Temperature rising faster than normal — check ventilation/load before the absolute limit trips' })
  }
  if (dVdt != null && Math.abs(dVdt) >= warnV) {
    trends.push({ code: dVdt < 0 ? 'voltage_collapse' : 'voltage_surge', severity: Math.abs(dVdt) >= warnV * 3 ? 'CRITICAL' : 'WARNING', slope: `${dVdt.toFixed(3)}V/min`, message: 'Abnormal voltage rate — possible high load, weak cell, or charger issue' })
  }
  if (dMq2 != null && dMq2 >= warnG) {
    trends.push({ code: 'gas_escalation', severity: 'WARNING', slope: `${Math.round(dMq2)} ADC/min`, message: 'Gas reading trending upward — ventilate and inspect; sensor is broad, not gas-specific' })
  }
  return { status: trends.length ? 'attention' : 'stable', message: trends.length ? 'Deterministic trend flags raised' : 'No rapid-escalation trend in window', trends, slopes: { dTdt, dVdt, dMq2 } }
}

// Fault-history extremes for the event log (max T/I/P, min V).
export function summarizeExtremes(rows = []) {
  const pick = (key, mode) => {
    const vals = rows
      .map((r) => finite(r[key] ?? r.battery?.[key] ?? r.environment?.[key]))
      .filter((x) => x != null)
    if (!vals.length) return null
    return mode === 'min' ? Math.min(...vals) : Math.max(...vals)
  }
  return {
    count: Array.isArray(rows) ? rows.length : 0,
    maxTemperature: pick('temperature', 'max'),
    minVoltage: pick('voltage', 'min'),
    maxVoltage: pick('voltage', 'max'),
    maxCurrent: pick('current', 'max'),
    maxPower: pick('power', 'max'),
  }
}

// ── Layer 8 Analytics: Voltage-Sag, Current Oscillation, Profile Inconsistency ──

/**
 * Correlate a discharge current step against the resulting voltage dip over a window.
 */
export function analyzeVoltageSag(arg1, arg2, arg3, arg4) {
  let vB, vA, iB, iA
  if (Array.isArray(arg1) && arg1.length >= 2) {
    const r0 = arg1[0]
    const r1 = arg1[arg1.length - 1]
    vB = finite(r0.voltage ?? r0.battery?.voltage)
    vA = finite(r1.voltage ?? r1.battery?.voltage)
    iB = finite(r0.current ?? r0.battery?.current)
    iA = finite(r1.current ?? r1.battery?.current)
  } else {
    vB = finite(arg1)
    vA = finite(arg2)
    iB = finite(arg3)
    iA = finite(arg4)
  }

  if (vB == null || vA == null || iB == null || iA == null) return null

  const dI = iA - iB // Positive = increased discharge load
  const dV = vB - vA // Positive = voltage dropped under load

  if (dI < 0.2) return null // Need meaningful current step (>200mA)

  const sagRatio = dV / dI // V drop per Amp of load step
  let severity = 'NORMAL'
  if (sagRatio > 0.4) severity = 'SEVERE'
  else if (sagRatio > 0.2) severity = 'ELEVATED'

  return {
    sagV: Math.round(dV * 1000) / 1000,
    currentStepA: Math.round(dI * 1000) / 1000,
    sagRatio: Math.round(sagRatio * 1000) / 1000,
    severity,
    message: severity === 'SEVERE'
      ? `Excessive voltage sag: ${dV.toFixed(2)}V drop for ${dI.toFixed(2)}A load step (${sagRatio.toFixed(2)} V/A)`
      : severity === 'ELEVATED'
      ? `Elevated voltage sag: ${dV.toFixed(2)}V drop for ${dI.toFixed(2)}A load step`
      : 'Normal voltage response under load step',
  }
}

/**
 * Detect abnormal current oscillation (fast chattering / unstable regulator).
 */
export function detectAbnormalCurrentOscillation(rows = [], windowSize = 6) {
  const pts = (Array.isArray(rows) ? rows : []).slice(-windowSize)
  if (pts.length < windowSize) return { oscillating: false, directionChanges: 0 }

  const currents = pts
    .map((r) => finite(r.current ?? r.battery?.current))
    .filter((x) => x != null)

  if (currents.length < 4) return { oscillating: false, directionChanges: 0 }

  let directionChanges = 0
  for (let i = 2; i < currents.length; i++) {
    const diff1 = currents[i - 1] - currents[i - 2]
    const diff2 = currents[i] - currents[i - 1]
    if ((diff1 > 0.3 && diff2 < -0.3) || (diff1 < -0.3 && diff2 > 0.3)) {
      directionChanges++
    }
  }

  const oscillating = directionChanges >= 2
  return {
    oscillating,
    directionChanges,
    message: oscillating
      ? `Abnormal current oscillation: ${directionChanges} sharp reversals detected over ${pts.length} frames`
      : 'Current waveform stable',
  }
}

/**
 * Verify open-circuit voltage consistency against profile's declared nominal voltage.
 */
export function checkProfileInconsistency(measuredVoltage, nominalVoltage, tolerancePct = 30) {
  const v = finite(measuredVoltage)
  const vNom = finite(nominalVoltage)

  if (v == null || vNom == null || vNom <= 0) return { inconsistent: false, reason: 'insufficient_data' }

  const diff = Math.abs(v - vNom)
  const pct = (diff / vNom) * 100

  const inconsistent = pct > tolerancePct
  return {
    inconsistent,
    measuredVoltage: v,
    nominalVoltage: vNom,
    deltaV: Math.round(diff * 100) / 100,
    deviationPercent: Math.round(pct * 10) / 10,
    message: inconsistent
      ? `Profile Inconsistency: measured OCV (${v}V) deviates by ${pct.toFixed(1)}% from declared nominal (${vNom}V). Check pack series count.`
      : 'Measured voltage aligns with profile nominal voltage',
  }
}

