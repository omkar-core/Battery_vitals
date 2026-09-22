import { describe, it, expect } from 'vitest';
import {
  estimateSOCVoltage,
  coulombUpdate,
  estimateResistance,
  equivalentFullCycles,
  integrateEnergy,
  slopePerMinute,
  fuseHazardIndex,
  predictFromHistory,
  summarizeExtremes,
} from './batteryAnalytics';

describe('batteryAnalytics — same-hardware deterministic math', () => {
  it('maps pack voltage to SOC on the 10.5..12.6V curve', () => {
    expect(estimateSOCVoltage(12.6)).toBe(100);
    expect(estimateSOCVoltage(10.5)).toBe(0);
    expect(estimateSOCVoltage(11.55)).toBeCloseTo(50, 0);
    expect(estimateSOCVoltage(null)).toBeNull();
  });

  it('integrates coulomb counting without drift beyond 0..100', () => {
    // 1A discharge for 1h on 7Ah pack removes ~14.3% SOC.
    expect(coulombUpdate(80, 1, 3600, 7)).toBeCloseTo(65.7, 0);
    expect(coulombUpdate(5, 10, 7200, 7)).toBe(0);
    expect(coulombUpdate(95, -5, 3600, 7)).toBe(100);
    expect(coulombUpdate(null, 1, 60)).toBeNull();
  });

  it('estimates load-step resistance and guards noise', () => {
    expect(estimateResistance(0.13, 2)).toBeCloseTo(65, 0);
    expect(estimateResistance(0.02, 0.01)).toBeNull();
    expect(estimateResistance(50, 1)).toBeNull();
  });

  it('counts equivalent full cycles from throughput, not plug events', () => {
    expect(equivalentFullCycles(14, 7)).toBe(2);
    expect(equivalentFullCycles(-1)).toBeNull();
  });

  it('integrates energy segments while skipping bad gaps', () => {
    const t0 = Date.now();
    const rows = [
      { timestamp: t0, voltage: 12.6, current: 1 },
      { timestamp: t0 + 3600000, voltage: 12.4, current: 1 },
    ];
    const out = integrateEnergy(rows);
    expect(out.dischargeAh).toBeCloseTo(1, 2);
    expect(out.segments).toBe(1);
  });

  it('computes per-minute slopes for predictive detection', () => {
    const t0 = Date.now();
    const rows = [
      { timestamp: t0, temperature: 30 },
      { timestamp: t0 + 60000, temperature: 33 },
    ];
    expect(slopePerMinute(rows, 'temperature')).toBeCloseTo(3, 2);
    expect(slopePerMinute(rows.slice(0, 1), 'temperature')).toBeNull();
  });

  it('fuses a hazard index into NORMAL..CRITICAL bands', () => {
    expect(fuseHazardIndex({ voltage: 12.6, current: 1, temperature: 25 }).band).toBe('NORMAL');
    expect(fuseHazardIndex({ voltage: 9.2, current: 35, temperature: 60 }).band).toBe('CRITICAL');
    expect(fuseHazardIndex({})).toEqual({ index: null, band: 'UNKNOWN' });
  });

  it('stays honest with insufficient history', () => {
    const r = predictFromHistory([{ voltage: 12.5 }]);
    expect(r.status).toBe('insufficient_data');
    expect(r.message).toMatch(/insufficient data/i);
  });

  it('flags rapid thermal escalation from history', () => {
    const t0 = Date.now();
    const rows = [
      { timestamp: t0, temperature: 30, voltage: 12.5 },
      { timestamp: t0 + 60000, temperature: 32, voltage: 12.5 },
      { timestamp: t0 + 120000, temperature: 36, voltage: 12.5 },
    ];
    const r = predictFromHistory(rows, { dTdtWarn: 2 });
    expect(r.trends.some((t) => t.code === 'thermal_escalation')).toBe(true);
  });

  it('summarizes fault-history extremes', () => {
    const rows = [
      { voltage: 12.6, temperature: 30, current: 1, power: 12 },
      { voltage: 11.9, temperature: 38, current: 5, power: 60 },
    ];
    const e = summarizeExtremes(rows);
    expect(e.minVoltage).toBe(11.9);
    expect(e.maxTemperature).toBe(38);
    expect(e.maxCurrent).toBe(5);
  });
});

describe('batteryAnalytics — Layer 8 Diagnostics (Sag, Oscillation, Inconsistency)', () => {
  it('detects severe voltage sag on sudden current step', async () => {
    const { analyzeVoltageSag } = await import('./batteryAnalytics');
    const rows = [
      { voltage: 12.8, current: 0.1 },
      { voltage: 12.8, current: 0.2 },
      { voltage: 10.5, current: 5.0 }, // 2.3V sag for ~4.8A step = ~0.48 V/A (> 0.25 threshold)
    ];
    const sag = analyzeVoltageSag(rows);
    expect(sag.severity).toBe('SEVERE');
    expect(sag.sagRatio).toBeGreaterThan(0.25);
    expect(sag.message).toContain('Excessive voltage sag');
  });

  it('detects abnormal current oscillation on erratic load switching', async () => {
    const { detectAbnormalCurrentOscillation } = await import('./batteryAnalytics');
    const oscRows = [
      { current: 1.0 },
      { current: 3.5 },
      { current: 0.5 },
      { current: 3.8 },
      { current: 0.2 },
      { current: 4.0 },
    ];
    const res = detectAbnormalCurrentOscillation(oscRows, 6);
    expect(res.oscillating).toBe(true);
    expect(res.directionChanges).toBeGreaterThanOrEqual(2);
    expect(res.message).toContain('Abnormal current oscillation');
  });

  it('flags profile inconsistency when measured OCV differs significantly from nominal', async () => {
    const { checkProfileInconsistency } = await import('./batteryAnalytics');
    // Connecting a 24V pack to a 12V profile:
    const res = checkProfileInconsistency(25.2, 12.8);
    expect(res.inconsistent).toBe(true);
    expect(res.deviationPercent).toBeGreaterThan(30);
    expect(res.message).toContain('Profile Inconsistency');

    // Nominal match:
    const normal = checkProfileInconsistency(13.1, 12.8);
    expect(normal.inconsistent).toBe(false);
  });
});

