import { generateValidationReport } from '../src/lib/validation/runValidation.js'

console.log('Running Battery Vital Hold-Out Benchmark Validation Protocol...')
const { results, reportPath } = generateValidationReport()
console.log(`Validation completed successfully!`)
console.log(`Report written to: ${reportPath}`)
console.log(`Results:`)
console.log(`  Battery Vital RUL Model MAE: ${results.metrics.rulModel.mae} cycles`)
console.log(`  Battery Vital P10-P90 Coverage: ${results.metrics.rulModel.coveragePct}%`)
console.log(`  Linear Baseline MAE: ${results.metrics.linearTrend.mae} cycles`)
console.log(`  Exponential Baseline MAE: ${results.metrics.exponentialTrend.mae} cycles`)
console.log(`  Capacity Threshold Baseline MAE: ${results.metrics.capacityThreshold.mae} cycles`)
