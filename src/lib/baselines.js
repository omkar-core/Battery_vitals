/**
 * src/lib/baselines.js
 *
 * Deterministic naive baseline models for battery Remaining Useful Life (RUL) prediction.
 * Specifically required by the competition brief:
 * "compare with simple capacity-threshold or trend-based baselines"
 *
 * Each baseline takes cycle-indexed SOH history and returns a point estimate of remaining
 * cycles until End-of-Life (EOL), defined by default as SOH < 80%.
 */

/**
 * Normalizes input cycle history into [{ cycle, soh }].
 * Supports array of numbers [soh0, soh1, ...] or array of objects [{ cycle, soh }].
 */
export function normalizeHistory(sohHistory = []) {
  if (!Array.isArray(sohHistory) || sohHistory.length === 0) return []

  return sohHistory
    .map((item, idx) => {
      if (typeof item === 'number' && Number.isFinite(item)) {
        return { cycle: idx + 1, soh: item }
      }
      if (item && typeof item === 'object') {
        const cycle = Number(item.cycle ?? item.x ?? idx + 1)
        const soh = Number(item.soh ?? item.capacity_pct ?? item.y)
        if (Number.isFinite(cycle) && Number.isFinite(soh)) {
          return { cycle, soh }
        }
      }
      return null
    })
    .filter(Boolean)
    .sort((a, b) => a.cycle - b.cycle)
}

/**
 * 1. Capacity Threshold Baseline
 * Finds the cycle where SOH crosses the threshold via simple linear interpolation
 * between the nearest observed points, or extrapolates from the last two observations.
 * Returns single number: predicted RUL in cycles from the latest observed cycle.
 */
export function capacityThresholdBaseline(sohHistory = [], threshold = 80.0) {
  const data = normalizeHistory(sohHistory)
  if (data.length < 2) return null

  const currentCycle = data[data.length - 1].cycle
  const currentSoh = data[data.length - 1].soh

  // Already at or below EOL threshold
  if (currentSoh <= threshold) {
    return 0
  }

  // Check if threshold was crossed in observed history
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1]
    const curr = data[i]
    if (prev.soh >= threshold && curr.soh < threshold) {
      // Linear interpolation between the two points
      const fraction = (prev.soh - threshold) / (prev.soh - curr.soh)
      const crossingCycle = prev.cycle + fraction * (curr.cycle - prev.cycle)
      return Math.max(0, Math.round(crossingCycle - currentCycle))
    }
  }

  // Not yet crossed: extrapolate using slope between last 2 points
  const p1 = data[data.length - 2]
  const p2 = data[data.length - 1]
  const dSoh = p2.soh - p1.soh
  const dCycle = p2.cycle - p1.cycle

  if (dSoh >= 0 || dCycle <= 0) {
    // Non-degrading or noisy upward tick between last 2 points: fallback to full series average slope
    const first = data[0]
    const totalDsoh = p2.soh - first.soh
    const totalDcycle = p2.cycle - first.cycle
    if (totalDsoh >= 0 || totalDcycle <= 0) return null
    const slope = totalDsoh / totalDcycle
    const cyclesToThreshold = (threshold - currentSoh) / slope
    return Math.max(0, Math.round(cyclesToThreshold))
  }

  const slope = dSoh / dCycle
  const cyclesToThreshold = (threshold - currentSoh) / slope
  return Math.max(0, Math.round(cyclesToThreshold))
}

/**
 * 2. Linear Trend Baseline
 * Ordinary Least-Squares (OLS) regression line through all observed (cycle, SOH) points,
 * extrapolated to threshold. Single number, no uncertainty.
 */
export function linearTrendBaseline(sohHistory = [], threshold = 80.0) {
  const data = normalizeHistory(sohHistory)
  if (data.length < 2) return null

  const currentCycle = data[data.length - 1].cycle
  const currentSoh = data[data.length - 1].soh

  if (currentSoh <= threshold) return 0

  const n = data.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (let i = 0; i < n; i++) {
    const x = data[i].cycle
    const y = data[i].soh
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-9) return null

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // Degradation requires negative slope
  if (slope >= 0) return null

  const failureCycle = (threshold - intercept) / slope
  const rulCycles = failureCycle - currentCycle

  return Math.max(0, Math.round(rulCycles))
}

/**
 * 3. Exponential Trend Baseline
 * Fits an exponential decay curve SOH(c) = a * exp(b * c) via log-linear regression:
 * ln(SOH) = ln(a) + b * c. Extrapolates to SOH = threshold.
 * Batteries typically degrade faster over time (knee effect).
 * Single number, no uncertainty.
 */
export function exponentialTrendBaseline(sohHistory = [], threshold = 80.0) {
  const data = normalizeHistory(sohHistory).filter((d) => d.soh > 0)
  if (data.length < 2) return null

  const currentCycle = data[data.length - 1].cycle
  const currentSoh = data[data.length - 1].soh

  if (currentSoh <= threshold) return 0

  const n = data.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (let i = 0; i < n; i++) {
    const x = data[i].cycle
    const y = Math.log(data[i].soh)
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-9) return null

  const b = (n * sumXY - sumX * sumY) / denom
  const lnA = (sumY - b * sumX) / n

  // Degradation requires negative decay rate b
  if (b >= 0) return null

  const targetLn = Math.log(threshold)
  const failureCycle = (targetLn - lnA) / b
  const rulCycles = failureCycle - currentCycle

  return Math.max(0, Math.round(rulCycles))
}

/**
 * Run all three baselines together on a series.
 */
export function runAllBaselines(sohHistory = [], threshold = 80.0) {
  return {
    capacityThreshold: capacityThresholdBaseline(sohHistory, threshold),
    linearTrend: linearTrendBaseline(sohHistory, threshold),
    exponentialTrend: exponentialTrendBaseline(sohHistory, threshold),
  }
}
