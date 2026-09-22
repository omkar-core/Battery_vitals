// Hardware Compatibility Engine (Layer 2)
// Pure function validating submitted battery profile against the fixed physical
// hardware envelope of the Battery Vital node (INA219 + DHT11 + MQ-2 + MQ-135).

export const COMPATIBILITY_STATES = {
  COMPATIBLE: 'COMPATIBLE',
  UNSAFE_CONFIGURATION: 'UNSAFE_CONFIGURATION',
  UNKNOWN_BATTERY_STATE: 'UNKNOWN_BATTERY_STATE',
  PROFILE_MISMATCH: 'PROFILE_MISMATCH',
  OUT_OF_RANGE_REJECTION: 'OUT_OF_RANGE_REJECTION',
}

export const FIXED_HARDWARE_LIMITS = {
  // INA219 I2C high-side sensor bus limits
  ina219MaxBusVoltage: 26.0,   // Volts absolute maximum
  ina219MinBusVoltage: 0.0,
  ina219VoltageHeadroom: 1.0,  // Margin for charging transients & overshoot
  ina219SafeMaxVoltage: 25.0,  // 26.0 - 1.0V headroom
  boardMaxCurrentA: 15.0,      // Max continuous power path / shunt rating
  boardMaxPowerW: 200.0,

  // DHT11 / DHT22 limits (ambient)
  dhtMinTemp: -20.0,
  dhtMaxTemp: 60.0,

  // Microcontroller ADC envelope (ADC1 pins 34 & 35)
  adcMaxVoltage: 3.3,
  adcMinVoltage: 0.0,

  // Hardware capabilities
  hasCellLevelSensing: false, // Ambient only; no per-cell NTCs on fixed board
  hasHardwareCutoff: false,   // No high-current MOSFET/contactor on fixed board
}

const isFiniteNumber = (val) => typeof val === 'number' && Number.isFinite(val)

/**
 * Validate a candidate battery profile against the fixed hardware limits.
 * Pure function: deterministic, side-effect free.
 *
 * @param {object} profile - Submitted battery profile
 * @param {object} hardware - Hardware envelope (defaults to FIXED_HARDWARE_LIMITS)
 * @returns {{ compatible: boolean, state: string, measurement: object, protection: object, reasons: string[] }}
 */
export function evaluateHardwareCompatibility(profile, hardware = FIXED_HARDWARE_LIMITS) {
  const reasons = []
  const measurement = { voltage: false, current: false, sensors: true }
  const protection = { voltage: false, current: false, advisory: [] }

  if (!profile || typeof profile !== 'object') {
    return {
      compatible: false,
      state: COMPATIBILITY_STATES.UNKNOWN_BATTERY_STATE,
      measurement,
      protection,
      reasons: ['No battery profile provided — configuration required before operation.'],
    }
  }

  // 1. Check basic series & parallel geometry
  const series = Number(profile.series)
  const parallel = Number(profile.parallel)
  if (!isFiniteNumber(series) || series < 1 || series > 16) {
    reasons.push('Series cell count must be between 1 and 16.')
  }
  if (!isFiniteNumber(parallel) || parallel < 1 || parallel > 8) {
    reasons.push('Parallel cell count must be between 1 and 8.')
  }

  // 2. Voltage checks
  const vMax = Number(profile.voltage?.maxAllowed ?? profile.vMax)
  const vMin = Number(profile.voltage?.minOperating ?? profile.vMin)
  const vNom = Number(profile.nominalVoltage ?? profile.nominalV)

  if (!isFiniteNumber(vMax) || !isFiniteNumber(vMin)) {
    return {
      compatible: false,
      state: COMPATIBILITY_STATES.OUT_OF_RANGE_REJECTION,
      measurement,
      protection,
      reasons: ['Voltage limits (minOperating and maxAllowed) must be valid finite numbers.'],
    }
  }

  if (vMin <= 0 || vMax <= 0) {
    return {
      compatible: false,
      state: COMPATIBILITY_STATES.OUT_OF_RANGE_REJECTION,
      measurement,
      protection,
      reasons: ['Battery voltages must be positive.'],
    }
  }

  if (vMin >= vMax) {
    return {
      compatible: false,
      state: COMPATIBILITY_STATES.OUT_OF_RANGE_REJECTION,
      measurement,
      protection,
      reasons: [`Minimum operating voltage (${vMin}V) must be strictly less than maximum allowed (${vMax}V).`],
    }
  }

  // Check against physical INA219 ceiling
  if (vMax > hardware.ina219SafeMaxVoltage) {
    reasons.push(
      `Configured maximum voltage (${vMax}V) exceeds INA219 safe bus headroom (${hardware.ina219SafeMaxVoltage}V, factoring 1V safety buffer).`
    )
  } else {
    measurement.voltage = true
    protection.voltage = true
  }

  // 3. Current limits
  const maxDischarge = Number(profile.current?.maxDischarge ?? profile.dischargeMaxA)
  const maxCharge = Number(profile.current?.maxCharge ?? profile.chargeMaxA)

  if (!isFiniteNumber(maxDischarge) || !isFiniteNumber(maxCharge) || maxDischarge <= 0 || maxCharge <= 0) {
    reasons.push('Current limits (maxCharge and maxDischarge) must be positive finite values.')
  } else if (maxDischarge > hardware.boardMaxCurrentA || maxCharge > hardware.boardMaxCurrentA) {
    reasons.push(
      `Current limit (${Math.max(maxDischarge, maxCharge)}A) exceeds fixed board shunt and trace rating (${hardware.boardMaxCurrentA}A).`
    )
  } else {
    measurement.current = true
    protection.current = true
  }

  // 4. Advisories on hardware constraints
  if (!hardware.hasCellLevelSensing) {
    protection.advisory.push('Ambient temperature sensing only: fixed DHT cannot measure internal cell core temperature.')
  }
  if (!hardware.hasHardwareCutoff) {
    protection.advisory.push('No physical contactor/relay: trips generate alerts and audible/visual alarms, but cannot sever load path.')
  }

  const compatible = measurement.voltage && measurement.current && reasons.length === 0
  const state = compatible
    ? COMPATIBILITY_STATES.COMPATIBLE
    : reasons.some((r) => r.includes('exceeds'))
    ? COMPATIBILITY_STATES.UNSAFE_CONFIGURATION
    : COMPATIBILITY_STATES.OUT_OF_RANGE_REJECTION

  return {
    compatible,
    state,
    measurement,
    protection,
    reasons,
  }
}

/**
 * Verify pre-connection voltage vs active profile before monitoring is permitted.
 */
export function verifyVoltageConsistency(measuredVoltage, profile, toleranceV = 1.0) {
  const v = Number(measuredVoltage)
  if (!isFiniteNumber(v)) {
    return {
      consistent: false,
      state: COMPATIBILITY_STATES.UNKNOWN_BATTERY_STATE,
      message: 'No valid voltage reading available from INA219.',
    }
  }

  const vMin = Number(profile?.voltage?.minOperating ?? profile?.vMin)
  const vMax = Number(profile?.voltage?.maxAllowed ?? profile?.vMax)

  if (!isFiniteNumber(vMin) || !isFiniteNumber(vMax)) {
    return {
      consistent: false,
      state: COMPATIBILITY_STATES.UNKNOWN_BATTERY_STATE,
      message: 'Active profile has incomplete voltage limits.',
    }
  }

  if (v < vMin - toleranceV || v > vMax + toleranceV) {
    return {
      consistent: false,
      state: COMPATIBILITY_STATES.PROFILE_MISMATCH,
      message: `Profile Mismatch: measured ${v}V is outside declared operating range [${vMin - toleranceV}V .. ${vMax + toleranceV}V].`,
    }
  }

  return {
    consistent: true,
    state: COMPATIBILITY_STATES.COMPATIBLE,
    message: `Measured voltage ${v}V is consistent with profile band.`,
  }
}
