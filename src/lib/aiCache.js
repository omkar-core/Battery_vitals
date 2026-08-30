// In-memory cache for AI results keyed on a fingerprint of the meaningful
// telemetry. Prevents redundant Gemini calls when nothing material changed.
// Server-only module (never imported by client components).

const store = new Map()
const DEFAULT_TTL_MS = 5 * 60 * 1000

// Fingerprint: round values to a coarse grid so tiny sensor noise does not
// trigger a fresh (paid) Gemini generation. Missing values collapse to "null".
export function telemetryFingerprint(latest = {}) {
  const round = (v, step) => {
    if (v == null || Number.isNaN(Number(v))) return 'null'
    return Math.round(Number(v) / step) * step
  }

  const snap = {
    voltage: round(latest.voltage ?? latest.battery?.voltage, 0.1),
    current: round(latest.current ?? latest.battery?.current, 0.5),
    temperature: round(latest.temperature ?? latest.environment?.temperature, 0.5),
    humidity: round(latest.humidity ?? latest.environment?.humidity, 2),
    soc: round(latest.soc ?? latest.battery?.soc, 2),
    soh: round(latest.soh ?? latest.battery?.soh, 1),
    bhi: round(latest.bhi ?? latest.risk?.bhi, 1),
    resistance: round(latest.resistance ?? latest.battery?.resistance, 1),
    mq2: round(latest.mq2 ?? latest.gasIndex?.mq2 ?? latest.gas?.index_mq2, 100),
    mq135: round(latest.mq135 ?? latest.gasIndex?.mq135 ?? latest.gas?.index_mq135, 100),
  }

  return Object.keys(snap)
    .sort()
    .map((k) => `${k}:${snap[k]}`)
    .join('|')
}

export function cacheGet(key) {
  if (!key) return null
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > entry.ttl) {
    store.delete(key)
    return null
  }
  // Refresh TTL on active use so a live dashboard keeps a warm cache.
  entry.at = Date.now()
  return entry.value
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return value
  // Blind eviction: keep the map bounded.
  if (store.size > 200) {
    const oldest = store.keys().next().value
    if (oldest) store.delete(oldest)
  }
  store.set(key, { value, at: Date.now(), ttl: ttlMs })
  return value
}

export function cacheClear(key) {
  if (!key) return
  store.delete(key)
}