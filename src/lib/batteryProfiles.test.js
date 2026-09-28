import { describe, it, expect } from 'vitest';
import {
  buildProfileFromInput,
  profileToEngineConfig,
  profileToEsp32Config,
  checkCompatibility,
  validatePreConnection,
  unknownBatteryState,
  inferBatteryProfile,
  calculateAutoSOC,
} from './batteryProfiles';
import { BatteryProfileSchema, DeployProfileSchema } from './schemas';

describe('batteryProfiles — fixed hardware + deployable profile (no voltage guessing)', () => {
  it('derives a 3S Li-ion band from chemistry defaults', () => {
    const p = buildProfileFromInput({ chemistry: 'LI_ION', series: 3, parallel: 1, capacityAh: 3 });
    expect(p.voltage.minOperating).toBeCloseTo(9.0, 1);
    expect(p.voltage.maxAllowed).toBeCloseTo(12.6, 1);
    expect(p.current.maxDischarge).toBe(5.0);
    expect(p.current.maxCharge).toBe(1.5);
  });

  it('gives manufacturer specs precedence over chemistry defaults', () => {
    const p = buildProfileFromInput({
      chemistry: 'LI_ION', series: 3, capacityAh: 3,
      manufacturer: { dischargeMaxA: 8, chargeMaxA: 2 },
      user: { dischargeMaxA: 6 },
    });
    expect(p.current.maxDischarge).toBe(8);
    expect(p.current.maxCharge).toBe(2);
  });

  it('falls back to user values when no manufacturer spec exists', () => {
    const p = buildProfileFromInput({ chemistry: 'LI_ION', series: 3, user: { dischargeMaxA: 4 } });
    expect(p.current.maxDischarge).toBe(4);
  });

  it('maps a profile to the deterministic engine config shape', () => {
    const p = buildProfileFromInput({ chemistry: 'LI_ION', series: 3, capacityAh: 3 });
    const e = profileToEngineConfig(p);
    expect(e.voltage.critLow).toBeCloseTo(9.43, 1);
    expect(e.voltage.warnLow).toBeCloseTo(9.9, 0);
    expect(e.current.dischargeMax).toBe(5.0);
  });

  it('emits a minimal generic ESP32 payload (no chemistry logic)', () => {
    const p = buildProfileFromInput({ chemistry: 'LI_ION', series: 3, capacityAh: 3 });
    const esp = profileToEsp32Config({ ...p, profileId: 'BV-LIION-3S-001', version: 7 });
    expect(esp).toMatchObject({ profile_id: 'BV-LIION-3S-001', config_version: 7, voltage_max: 12.6, voltage_min: 9.0 });
  });

  it('passes compatibility for a 3S pack inside the INA219 envelope', () => {
    const p = buildProfileFromInput({ chemistry: 'LI_ION', series: 3, capacityAh: 3 });
    const c = checkCompatibility(p);
    expect(c.compatible).toBe(true);
    expect(c.measurement.voltage).toBe(true);
  });

  it('rejects packs above INA219 headroom and over-rated current', () => {
    const bigV = buildProfileFromInput({ chemistry: 'LI_ION', series: 8, capacityAh: 5 });
    expect(checkCompatibility(bigV).compatible).toBe(false);
    const bigI = buildProfileFromInput({ chemistry: 'LI_ION', series: 3, manufacturer: { dischargeMaxA: 30 } });
    const c = checkCompatibility(bigI);
    expect(c.compatible).toBe(false);
    expect(c.reasons.join(' ')).toMatch(/rating/i);
  });

  it('validates pre-connection: ready inside band, mismatch outside', () => {
    const p = buildProfileFromInput({ chemistry: 'LI_ION', series: 3, capacityAh: 3 });
    expect(validatePreConnection(11.8, p).state).toBe('READY');
    const bad = validatePreConnection(18.4, p);
    expect(bad.state).toBe('PROFILE_MISMATCH');
    expect(bad.ok).toBe(false);
  });

  it('never assumes a battery without a profile (unknown mode)', () => {
    expect(validatePreConnection(11.8, null).state).toBe('UNKNOWN_BATTERY');
    expect(unknownBatteryState().state).toBe('UNKNOWN_BATTERY');
    expect(validatePreConnection(null, null).state).toBe('NO_READING');
  });

  it('validates profile and deploy schemas', () => {
    expect(BatteryProfileSchema.safeParse({ name: '3S pack', chemistry: 'LI_ION', series: 3 }).success).toBe(true);
    expect(BatteryProfileSchema.safeParse({ name: 'x', chemistry: 'LI_ION', series: 99 }).success).toBe(false);
    expect(DeployProfileSchema.safeParse({ deviceId: 'BAT001', profileId: 'BV-X' }).success).toBe(true);
    expect(DeployProfileSchema.safeParse({ deviceId: 'bad id!', profileId: 'BV-X' }).success).toBe(false);
  });

  it('accurately auto-infers battery chemistry and profile from terminal voltage', () => {
    const cell18650 = inferBatteryProfile(3.85);
    expect(cell18650.inferred).toBe(true);
    expect(cell18650.profileId).toBe('ICR_18650_2500MAH');
    expect(cell18650.chemistry).toBe('LI_ION');
    expect(cell18650.confidence).toBe('HIGH');
    expect(cell18650.nominalVoltage).toBe(3.7);

    const batt9v = inferBatteryProfile(8.8);
    expect(batt9v.inferred).toBe(true);
    expect(batt9v.profileId).toBe('GP_9V_6F22');
    expect(batt9v.chemistry).toBe('CARBON_ZINC');
    expect(batt9v.confidence).toBe('HIGH');
    expect(batt9v.nominalVoltage).toBe(9.0);

    const cellNimh = inferBatteryProfile(1.3);
    expect(cellNimh.inferred).toBe(true);
    expect(cellNimh.profileId).toBe('NIMH_AA_1_2V');
    expect(cellNimh.chemistry).toBe('NIMH');
  });

  it('computes empirical OCV State of Charge across supported cell chemistries', () => {
    const socFull18650 = calculateAutoSOC(4.18, 'ICR_18650_2500MAH');
    expect(socFull18650.soc).toBeGreaterThanOrEqual(95);

    const socNominal18650 = calculateAutoSOC(3.80, 'ICR_18650_2500MAH');
    expect(socNominal18650.soc).toBe(50);

    const socCutoff18650 = calculateAutoSOC(2.70, 'ICR_18650_2500MAH');
    expect(socCutoff18650.soc).toBe(0);

    const soc9v = calculateAutoSOC(8.5, 'GP_9V_6F22');
    expect(soc9v.soc).toBeGreaterThan(60);
    expect(soc9v.soc).toBeLessThan(90);
  });
});
