import { describe, it, expect } from 'vitest'
import {
  capacityThresholdBaseline,
  linearTrendBaseline,
  exponentialTrendBaseline,
  runAllBaselines,
  normalizeHistory,
} from './baselines'

describe('baselines.js — Benchmark Strawman Baselines', () => {
  const linearDecay = [
    { cycle: 1, soh: 100 },
    { cycle: 10, soh: 98 },
    { cycle: 20, soh: 96 },
    { cycle: 30, soh: 94 },
    { cycle: 40, soh: 92 },
    { cycle: 50, soh: 90 },
  ]

  it('normalizes numeric arrays and object arrays', () => {
    const rawNumbers = [100, 95, 90]
    const norm1 = normalizeHistory(rawNumbers)
    expect(norm1).toEqual([
      { cycle: 1, soh: 100 },
      { cycle: 2, soh: 95 },
      { cycle: 3, soh: 90 },
    ])

    const objects = [{ cycle: 10, soh: 99 }, { cycle: 5, soh: 100 }]
    const norm2 = normalizeHistory(objects)
    expect(norm2[0].cycle).toBe(5)
    expect(norm2[1].cycle).toBe(10)
  })

  it('linearTrendBaseline computes correct remaining cycles to SOH=80%', () => {
    // OLS slope through the points yields failure at cycle ~99, so 49 remaining from cycle 50.
    const rul = linearTrendBaseline(linearDecay, 80)
    expect(rul).toBe(49)
  })

  it('capacityThresholdBaseline extrapolates from recent observations', () => {
    const rul = capacityThresholdBaseline(linearDecay, 80)
    // Between cycle 40 and 50, dSOH is -2 over 10 cycles (-0.2/cycle). (90-80)/0.2 = 50 cycles
    expect(rul).toBe(50)
  })

  it('exponentialTrendBaseline handles non-linear acceleration', () => {
    const expDecay = [
      { cycle: 10, soh: 98 },
      { cycle: 20, soh: 95 },
      { cycle: 30, soh: 91 },
      { cycle: 40, soh: 86 },
    ]
    const rul = exponentialTrendBaseline(expDecay, 80)
    expect(typeof rul).toBe('number')
    expect(rul).toBeGreaterThan(0)
    expect(rul).toBeLessThan(30)
  })

  it('returns 0 when battery is already at or below EOL threshold', () => {
    const deadBattery = [
      { cycle: 1, soh: 85 },
      { cycle: 2, soh: 79 },
    ]
    expect(capacityThresholdBaseline(deadBattery, 80)).toBe(0)
    expect(linearTrendBaseline(deadBattery, 80)).toBe(0)
    expect(exponentialTrendBaseline(deadBattery, 80)).toBe(0)
  })

  it('returns null when insufficient history is provided', () => {
    expect(capacityThresholdBaseline([100])).toBeNull()
    expect(linearTrendBaseline([])).toBeNull()
    expect(exponentialTrendBaseline(null)).toBeNull()
  })

  it('runAllBaselines returns all three estimates simultaneously', () => {
    const res = runAllBaselines(linearDecay, 80)
    expect(res.capacityThreshold).toBeDefined()
    expect(res.linearTrend).toBeDefined()
    expect(res.exponentialTrend).toBeDefined()
  })
})
