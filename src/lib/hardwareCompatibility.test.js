import { describe, it, expect } from 'vitest'
import {
  evaluateHardwareCompatibility,
  verifyVoltageConsistency,
  COMPATIBILITY_STATES,
  FIXED_HARDWARE_LIMITS,
} from './hardwareCompatibility'

describe('evaluateHardwareCompatibility (Layer 2)', () => {
  const validProfile = {
    series: 4,
    parallel: 1,
    voltage: {
      minOperating: 10.0,
      maxAllowed: 14.6,
    },
    nominalVoltage: 12.8,
    current: {
      maxCharge: 5.0,
      maxDischarge: 10.0,
    },
  }

  it('approves a compliant 12V battery profile as COMPATIBLE', () => {
    const res = evaluateHardwareCompatibility(validProfile)
    expect(res.compatible).toBe(true)
    expect(res.state).toBe(COMPATIBILITY_STATES.COMPATIBLE)
    expect(res.measurement.voltage).toBe(true)
    expect(res.measurement.current).toBe(true)
    expect(res.reasons.length).toBe(0)
  })

  it('rejects an empty or null profile with UNKNOWN_BATTERY_STATE', () => {
    const res = evaluateHardwareCompatibility(null)
    expect(res.compatible).toBe(false)
    expect(res.state).toBe(COMPATIBILITY_STATES.UNKNOWN_BATTERY_STATE)
    expect(res.reasons[0]).toContain('No battery profile provided')
  })

  it('rejects profiles exceeding INA219 25V bus headroom with UNSAFE_CONFIGURATION', () => {
    const highVoltageProfile = {
      ...validProfile,
      series: 8,
      voltage: {
        minOperating: 20.0,
        maxAllowed: 29.2, // > 25.0V safe headroom
      },
    }
    const res = evaluateHardwareCompatibility(highVoltageProfile)
    expect(res.compatible).toBe(false)
    expect(res.state).toBe(COMPATIBILITY_STATES.UNSAFE_CONFIGURATION)
    expect(res.reasons.some((r) => r.includes('exceeds INA219 safe bus headroom'))).toBe(true)
  })

  it('rejects profiles exceeding board 15A rating with UNSAFE_CONFIGURATION', () => {
    const highCurrentProfile = {
      ...validProfile,
      current: {
        maxCharge: 5.0,
        maxDischarge: 30.0, // > 15A
      },
    }
    const res = evaluateHardwareCompatibility(highCurrentProfile)
    expect(res.compatible).toBe(false)
    expect(res.state).toBe(COMPATIBILITY_STATES.UNSAFE_CONFIGURATION)
    expect(res.reasons.some((r) => r.includes('exceeds fixed board shunt'))).toBe(true)
  })

  it('rejects inverted voltage limits (min >= max) with OUT_OF_RANGE_REJECTION', () => {
    const invertedProfile = {
      ...validProfile,
      voltage: {
        minOperating: 15.0,
        maxAllowed: 12.0,
      },
    }
    const res = evaluateHardwareCompatibility(invertedProfile)
    expect(res.compatible).toBe(false)
    expect(res.state).toBe(COMPATIBILITY_STATES.OUT_OF_RANGE_REJECTION)
    expect(res.reasons.some((r) => r.includes('strictly less than'))).toBe(true)
  })

  it('includes advisory notifications on ambient sensing and lack of contactor', () => {
    const res = evaluateHardwareCompatibility(validProfile)
    expect(res.protection.advisory.length).toBeGreaterThan(0)
    expect(res.protection.advisory.some((a) => a.includes('Ambient temperature'))).toBe(true)
    expect(res.protection.advisory.some((a) => a.includes('No physical contactor'))).toBe(true)
  })
})

describe('verifyVoltageConsistency (Layer 2 & Layer 8)', () => {
  const profile = {
    voltage: {
      minOperating: 10.0,
      maxAllowed: 14.6,
    },
  }

  it('returns COMPATIBLE when measured voltage is within declared boundaries', () => {
    const res = verifyVoltageConsistency(13.2, profile)
    expect(res.consistent).toBe(true)
    expect(res.state).toBe(COMPATIBILITY_STATES.COMPATIBLE)
  })

  it('returns PROFILE_MISMATCH when measured voltage exceeds limits plus tolerance', () => {
    const res = verifyVoltageConsistency(18.5, profile)
    expect(res.consistent).toBe(false)
    expect(res.state).toBe(COMPATIBILITY_STATES.PROFILE_MISMATCH)
    expect(res.message).toContain('Profile Mismatch')
  })

  it('returns UNKNOWN_BATTERY_STATE when voltage is invalid or NaN', () => {
    const res = verifyVoltageConsistency(NaN, profile)
    expect(res.consistent).toBe(false)
    expect(res.state).toBe(COMPATIBILITY_STATES.UNKNOWN_BATTERY_STATE)
  })
})
