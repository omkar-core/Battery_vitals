import { describe, it, expect } from 'vitest';
import { validateTelemetry, computeSafety, gradedResponse, SAFETY_STATES } from './batterySafety';

describe('batterySafety — Validation & Clamping', () => {
  it('should flag and sanitize out-of-range voltages', () => {
    const { clean, issues } = validateTelemetry({ voltage: -5.2 });
    expect(clean.voltage).toBe(-5.2);
    expect(issues.some(i => i.code === 'out_of_range')).toBe(true);
  });

  it('should strip non-finite numbers like NaN and Infinity', () => {
    const { clean, issues } = validateTelemetry({ voltage: NaN, current: Infinity });
    expect(clean.voltage).toBeNull();
    expect(clean.current).toBeNull();
    expect(issues.some(i => i.code === 'invalid_number')).toBe(true);
  });

  it('should flag packets older than 10 minutes as stale', () => {
    const elevenMinutesAgo = Date.now() - (11 * 60 * 1000);
    const { clean, issues } = validateTelemetry({ timestamp: elevenMinutesAgo });
    expect(clean.stale).toBe(true);
    expect(issues.some(i => i.code === 'stale_telemetry')).toBe(true);
  });
});

describe('batterySafety — Deterministic Trip Bounds', () => {
  it('should trigger EMERGENCY when cell temperature exceeds 55°C', () => {
    const result = computeSafety({ temperature: 56.5 });
    expect(result.state).toBe(SAFETY_STATES.EMERGENCY);
    expect(result.violations.some(v => v.rule.code === 'thermal_runaway_edge')).toBe(true);
  });

  it('should trigger CRITICAL on deep discharge below 10.0V', () => {
    const result = computeSafety({ voltage: 9.8 });
    expect(result.state).toBe(SAFETY_STATES.CRITICAL);
  });

  it('should trigger EMERGENCY on catastrophic discharge below 9.5V', () => {
    const result = computeSafety({ voltage: 9.2 });
    expect(result.state).toBe(SAFETY_STATES.EMERGENCY);
  });

  it('should report UNKNOWN if essential channels are missing', () => {
    const result = computeSafety({});
    expect(result.state).toBe(SAFETY_STATES.UNKNOWN);
    expect(result.unknown).toContain('voltage');
    expect(result.unknown).toContain('temperature');
  });

  it('should honor a custom thermal threshold without changing defaults', () => {
    const result = computeSafety({ temperature: 42 }, { thermal: { warn: 40, crit: 45, emerg: 55 }, voltage: {} });
    expect(result.state).toBe(SAFETY_STATES.WARNING);
    expect(result.violations.some((v) => v.rule.code === 'temperature_elevated')).toBe(true);
  });

  it('should escalate to EMERGENCY when config lowers the thermal emergency bound', () => {
    const result = computeSafety({ temperature: 46 }, { thermal: { warn: 35, crit: 40, emerg: 45 }, voltage: {} });
    expect(result.state).toBe(SAFETY_STATES.EMERGENCY);
  });

  it('should keep the default EMERGENCY bound (55°C) when no config is supplied', () => {
    const result = computeSafety({ temperature: 50 });
    expect(result.state).not.toBe(SAFETY_STATES.EMERGENCY);
    expect(result.state).toBe(SAFETY_STATES.CRITICAL);
  });

  it('should clamp rogue config values into RANGES so a band cannot be silently widened', () => {
    const result = computeSafety({ voltage: 9.2 }, { voltage: { warnLow: 0, critLow: 0, emergLow: 0 }, thermal: {} });
    expect(result.state).not.toBe(SAFETY_STATES.EMERGENCY);
    expect(result.violations.length).toBe(0);
  });
});

describe('batterySafety — Same-hardware electrical protection (INA219)', () => {
  it('should trigger CRITICAL on discharge overcurrent above 15A', () => {
    const result = computeSafety({ voltage: 12.4, temperature: 25, current: 16.5 });
    expect(result.state).toBe(SAFETY_STATES.CRITICAL);
    expect(result.violations.some(v => v.rule.code === 'discharge_overcurrent')).toBe(true);
  });

  it('should trigger CRITICAL on charge overcurrent beyond -10A', () => {
    const result = computeSafety({ voltage: 12.4, temperature: 25, current: -12 });
    expect(result.state).toBe(SAFETY_STATES.CRITICAL);
    expect(result.violations.some(v => v.rule.code === 'charge_overcurrent')).toBe(true);
  });

  it('should trigger EMERGENCY on short-circuit signature above 30A', () => {
    const result = computeSafety({ voltage: 11.8, temperature: 25, current: 34 });
    expect(result.state).toBe(SAFETY_STATES.EMERGENCY);
    expect(result.violations.some(v => v.rule.code === 'short_circuit')).toBe(true);
  });

  it('should trigger CRITICAL on over-power above 200W', () => {
    const result = computeSafety({ voltage: 12.5, temperature: 25, current: 17, power: 212.5 });
    expect(result.state).toBe(SAFETY_STATES.CRITICAL);
    expect(result.violations.some(v => v.rule.code === 'over_power' || v.rule.code === 'discharge_overcurrent')).toBe(true);
  });

  it('should flag MQ-135 air-quality elevation without claiming a named gas', () => {
    const result = computeSafety({ voltage: 12.4, temperature: 25, mq135: 620 });
    expect(result.violations.some(v => v.rule.code === 'air_quality_critical')).toBe(true);
  });

  it('should escalate to CRITICAL on gas+temperature fusion', () => {
    const result = computeSafety({ voltage: 12.4, temperature: 42, mq2: 1800 });
    expect(result.state).toBe(SAFETY_STATES.CRITICAL);
    expect(result.violations.some(v => v.rule.code === 'fusion_thermal_gas')).toBe(true);
  });

  it('should escalate to EMERGENCY on gas+temperature+voltage fusion', () => {
    const result = computeSafety({ voltage: 14.5, temperature: 42, mq2: 1800 });
    expect(result.state).toBe(SAFETY_STATES.EMERGENCY);
    expect(result.violations.some(v => v.rule.code === 'fusion_thermal_gas_voltage')).toBe(true);
  });

  it('should flag rapid thermal escalation before the absolute limit trips', () => {
    const result = computeSafety({ voltage: 12.4, temperature: 36, dT_dt: 3.5 });
    expect(result.violations.some(v => v.rule.code === 'thermal_escalation')).toBe(true);
  });

  it('should flag sudden voltage collapse from dV/dt', () => {
    const result = computeSafety({ voltage: 12.1, temperature: 25, dV_dt: -2.0 });
    expect(result.violations.some(v => v.rule.code === 'voltage_collapse_fast')).toBe(true);
  });

  it('should map states to graded protection levels 0-4', () => {
    expect(gradedResponse('SAFE').level).toBe(0);
    expect(gradedResponse('CAUTION').level).toBe(1);
    expect(gradedResponse('WARNING').level).toBe(2);
    expect(gradedResponse('CRITICAL').level).toBe(3);
    expect(gradedResponse('EMERGENCY').level).toBe(4);
  });

  it('should expose the protection level on computeSafety', () => {
    const result = computeSafety({ voltage: 9.2 });
    expect(result.level.level).toBe(4);
  });
});

describe('batterySafety — Layer 5: Fault Latching & Manual Reset', () => {
  it('latches in RECOVERY when a CRITICAL trip dips below threshold without manual acknowledgment', async () => {
    const { evaluateLatchedSafety } = await import('./batterySafety');
    const res = evaluateLatchedSafety('SAFE', 'CRITICAL', false);
    expect(res.latchedState).toBe('RECOVERY');
    expect(res.requiresManualReset).toBe(true);
    expect(res.message).toContain('Active safety trip in recovery');
  });

  it('clears to SAFE once manual acknowledgment is received', async () => {
    const { evaluateLatchedSafety } = await import('./batterySafety');
    const res = evaluateLatchedSafety('SAFE', 'CRITICAL', true);
    expect(res.latchedState).toBe('SAFE');
    expect(res.requiresManualReset).toBe(false);
  });

  it('preserves active EMERGENCY state without transitioning to recovery', async () => {
    const { evaluateLatchedSafety } = await import('./batterySafety');
    const res = evaluateLatchedSafety('EMERGENCY', 'EMERGENCY', false);
    expect(res.latchedState).toBe('EMERGENCY');
    expect(res.requiresManualReset).toBe(false);
  });
});