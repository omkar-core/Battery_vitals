import { describe, it, expect } from 'vitest'
import {
  loadNasaDataset,
  executeBenchmarkValidation,
  formatValidationReportMarkdown,
} from './validation/runValidation'

describe('validation/runValidation.js — Hold-Out Prognostics Benchmark', () => {
  it('loads the NASA PCoE battery aging dataset fixtures', () => {
    const cells = loadNasaDataset()
    expect(cells.length).toBeGreaterThanOrEqual(4)
    const b5 = cells.find((c) => c.cellId === 'B0005')
    expect(b5).toBeDefined()
    expect(b5.cycles.length).toBe(168)
    expect(b5.failureCycle).toBeGreaterThan(50)
  })

  it('executes hold-out validation across unseen cells and cycles', () => {
    const results = executeBenchmarkValidation()
    expect(results).toBeDefined()
    expect(results.evaluations.length).toBeGreaterThan(0)

    const m = results.metrics
    expect(m.rulModel).toBeDefined()
    expect(m.rulModel.mae).toBeGreaterThan(0)
    expect(m.rulModel.coveragePct).toBeGreaterThan(0)

    expect(m.linearTrend).toBeDefined()
    expect(m.exponentialTrend).toBeDefined()
    expect(m.capacityThreshold).toBeDefined()
    expect(m.gaussianProcess).toBeDefined()
    expect(m.gaussianProcess.mae).toBeGreaterThan(0)
    expect(results.domainDrift).toBeDefined()
    expect(results.domainDrift.transferabilityScore).toBeGreaterThanOrEqual(0)

    // Battery Vital model should beat the exponential baseline and linear baseline
    expect(m.rulModel.mae).toBeLessThan(m.exponentialTrend.mae)
    expect(m.rulModel.mae).toBeLessThan(m.linearTrend.mae)
  })

  it('formats validation results into standardized markdown report', () => {
    const results = executeBenchmarkValidation()
    const md = formatValidationReportMarkdown(results)
    expect(typeof md).toBe('string')
    expect(md).toContain('# VALIDATION_REPORT.md')
    expect(md).toContain('Battery Vital RUL Model')
    expect(md).toContain('Per-Cell Error Breakdown')
    expect(md).toContain('Multi-Signal Ablation Study')
  })
})
