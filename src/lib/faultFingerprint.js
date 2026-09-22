// Layer 11: Fault Management, Fingerprinting & Recurrence Counting
// Creates deterministic, bucketed fingerprints for alerts so repetitive trips
// (e.g. overtemperature at ~46°C recurring 5 times) are grouped with a recurrence counter (x5)
// and share the same cached AI explanation.

const bucketValue = (val, bucketSize = 1.0) => {
  const num = Number(val)
  if (!Number.isFinite(num)) return 'na'
  return String(Math.round(num / bucketSize) * bucketSize)
}

/**
 * Generate a deterministic fingerprint string for an alert or violation.
 * e.g. "over_temperature_CRITICAL_46"
 */
export function generateFaultFingerprint(alert = {}) {
  const code = String(alert.code || alert.type || 'unknown_fault').toLowerCase()
  const severity = String(alert.severity || alert.state || 'WARNING').toUpperCase()

  let bucket = 'std'
  const val = Number(alert.value ?? alert.metricValue ?? alert.reading)

  if (Number.isFinite(val)) {
    if (code.includes('volt')) {
      bucket = bucketValue(val, 0.2) // Nearest 0.2V
    } else if (code.includes('temp')) {
      bucket = bucketValue(val, 1.0) // Nearest 1°C
    } else if (code.includes('current')) {
      bucket = bucketValue(val, 0.5) // Nearest 0.5A
    } else if (code.includes('gas') || code.includes('mq')) {
      bucket = bucketValue(val, 100) // Nearest 100 ADC
    } else {
      bucket = bucketValue(val, 1.0)
    }
  }

  return `${code}_${severity}_${bucket}`
}

/**
 * Group an array of alerts by fault fingerprint, tracking recurrence count and time window.
 */
export function groupFaultsByFingerprint(alerts = []) {
  const map = new Map()

  for (const a of alerts) {
    const fp = generateFaultFingerprint(a)
    const existing = map.get(fp)
    if (existing) {
      existing.count += 1
      existing.lastOccurred = a.timestamp || a.createdAt || existing.lastOccurred
      existing.instances.push(a)
    } else {
      map.set(fp, {
        fingerprint: fp,
        code: a.code || a.type || 'fault',
        title: a.title || a.message || a.code,
        message: a.message,
        severity: a.severity || a.state || 'WARNING',
        count: 1,
        firstOccurred: a.timestamp || a.createdAt || new Date().toISOString(),
        lastOccurred: a.timestamp || a.createdAt || new Date().toISOString(),
        instances: [a],
      })
    }
  }

  return Array.from(map.values())
}

/**
 * Correlate faults that fired within the same short window (e.g. 60 seconds).
 */
export function correlateWindowFaults(alerts = [], windowMs = 60000) {
  if (!Array.isArray(alerts) || alerts.length <= 1) return []

  const sorted = [...alerts].sort((a, b) => {
    const ta = new Date(a.timestamp || a.createdAt || 0).getTime()
    const tb = new Date(b.timestamp || b.createdAt || 0).getTime()
    return ta - tb
  })

  const groups = []
  let currentGroup = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = new Date(currentGroup[0].timestamp || currentGroup[0].createdAt || 0).getTime()
    const currTime = new Date(sorted[i].timestamp || sorted[i].createdAt || 0).getTime()

    if (Math.abs(currTime - prevTime) <= windowMs) {
      currentGroup.push(sorted[i])
    } else {
      if (currentGroup.length > 1) groups.push(currentGroup)
      currentGroup = [sorted[i]]
    }
  }

  if (currentGroup.length > 1) groups.push(currentGroup)
  return groups
}
