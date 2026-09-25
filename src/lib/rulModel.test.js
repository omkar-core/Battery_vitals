import { describe, it, expect } from 'vitest'
import {
  fitDecayCurve,
  attributeUncertainty,
  predictRulWithUncertainty,
  predictRulGaussianProcess,
  detectTelemetryDrift,
  EOL_SOH_THRESHOLD,
} from './rulModel'

describe('rulModel.js — Bootstrap RUL Estimation & Uncertainty Quantification', () => {
  const agingSeries = [
    { cycle: 10, soh: 99.0, resistanceMohm: 58, temperatureMax: 26 },
    { cycle: 25, soh: 96.5, resistanceMohm: 62, temperatureMax: 27 },
    { cycle: 40, soh: 93.8, resistanceMohm: 67, temperatureMax: 28 },
    { cycle: 55, soh: 90.2, resistanceMohm: 74, temperatureMax: 30 },
    { cycle: 70, soh: 86.5, resistanceMohm: 85, temperatureMax: 32 },
  ]

  it('fits exponential decay curve and returns R-squared', () => {
    const fit = fitDecayCurve(agingSeries)
    expect(fit).toBeDefined()
    expect(fit.type).toBe('exponential')
    expect(fit.b).toBeLessThan(0) // Degradation slope
    expect(fit.rSquared).toBeGreaterThan(0.9)
    expect(fit.fitted.length).toBe(agingSeries.length)
  })

  it('predicts RUL with valid percentile ordering P10 <= P50 <= P90', () => {
    const prediction = predictRulWithUncertainty(agingSeries, {
      threshold: 80.0,
      bootstrapN: 100,
    })

    expect(prediction.insufficient_data).toBe(false)
    expect(typeof prediction.p10_cycles).toBe('number')
    expect(typeof prediction.p50_cycles).toBe('number')
    expect(typeof prediction.p90_cycles).toBe('number')

    expect(prediction.p10_cycles).toBeLessThanOrEqual(prediction.p50_cycles)
    expect(prediction.p50_cycles).toBeLessThanOrEqual(prediction.p90_cycles)

    expect(prediction.p10_days).toBeLessThanOrEqual(prediction.p50_days)
    expect(prediction.p50_days).toBeLessThanOrEqual(prediction.p90_days)
  })

  it('outputs sensitivity attribution and dominant sensitivity signal', () => {
    const prediction = predictRulWithUncertainty(agingSeries)
    expect(prediction.dominant_sensitivity).toBeDefined()
    expect(typeof prediction.dominant_sensitivity).toBe('string')
    expect(prediction.attribution).toBeDefined()
    expect(prediction.attribution.internal_resistance_pct).toBeGreaterThan(0)
  })

  it('handles insufficient history gracefully (<3 points)', () => {
    const thinSeries = [{ cycle: 1, soh: 99 }, { cycle: 2, soh: 98 }]
    const res = predictRulWithUncertainty(thinSeries)
    expect(res.insufficient_data).toBe(true)
    expect(res.p50_cycles).toBeNull()
  })

  it('detects when battery has already crossed EOL threshold', () => {
    const deadSeries = [
      { cycle: 80, soh: 82 },
      { cycle: 90, soh: 80.5 },
      { cycle: 100, soh: 78.5 },
    ]
    const res = predictRulWithUncertainty(deadSeries, { threshold: 80.0 })
    expect(res.insufficient_data).toBe(false)
    expect(res.p10_cycles).toBe(0)
    expect(res.p50_cycles).toBe(0)
    expect(res.p90_cycles).toBe(0)
  })

  it('generates projection curve with today boundary and future percentiles', () => {
    const res = predictRulWithUncertainty(agingSeries)
    expect(res.projectionCurve.length).toBeGreaterThan(0)
    const todayPoint = res.projectionCurve.find((p) => p.label === 'Today')
    expect(todayPoint).toBeDefined()
    expect(todayPoint.measured).toBeDefined()

    const futurePoints = res.projectionCurve.filter((p) => p.predicted !== undefined)
    expect(futurePoints.length).toBeGreaterThan(0)
    futurePoints.forEach((p) => {
      expect(p.p10).toBeLessThanOrEqual(p.p90)
    })
  })

  it('predicts RUL with Gaussian Process Regression and maintains P10 <= P50 <= P90', () => {
    const gpRes = predictRulGaussianProcess(agingSeries, { threshold: 80.0 })
    expect(gpRes.insufficient_data).toBe(false)
    expect(gpRes.method).toBe('Gaussian Process Regression (RBF Kernel)')
    expect(gpRes.p10_cycles).toBeGreaterThan(0)
    expect(gpRes.p10_cycles).toBeLessThanOrEqual(gpRes.p50_cycles)
    expect(gpRes.p50_cycles).toBeLessThanOrEqual(gpRes.p90_cycles)
  })

  it('detects domain drift between live telemetry and reference benchmark', () => {
    // Normal 18650-like telemetry
    const normalTelemetry = [
      { voltage: 3.82, temperature: 24.5 },
      { voltage: 3.79, temperature: 24.8 },
      { voltage: 3.75, temperature: 25.1 },
      { voltage: 3.72, temperature: 24.9 },
      { voltage: 3.70, temperature: 25.0 },
    ]
    const normalCheck = detectTelemetryDrift(normalTelemetry)
    expect(normalCheck.hasDrift).toBe(false)
    expect(normalCheck.transferabilityScore).toBe(100)

    // Divergent telemetry: 9V battery with high ambient heat (39°C)
    const divergentTelemetry = [
      { voltage: 8.8, temperature: 40.2 },
      { voltage: 8.5, temperature: 41.5 },
      { voltage: 8.2, temperature: 42.1 },
      { voltage: 7.9, temperature: 43.0 },
      { voltage: 7.6, temperature: 43.5 },
    ]
    const driftedCheck = detectTelemetryDrift(divergentTelemetry)
    expect(driftedCheck.hasDrift).toBe(true)
    expect(driftedCheck.transferabilityScore).toBeLessThan(70)
    expect(driftedCheck.driftReasons.length).toBeGreaterThan(0)
  })
})

