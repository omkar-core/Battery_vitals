export function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '--'
  return Number(value).toFixed(digits)
}

export function safetyColor(safety) {
  const s = (safety || 'SAFE').toUpperCase()
  if (s === 'EMERGENCY' || s === 'CRITICAL') return '#FF2D55'
  if (s === 'WARNING') return '#FF6B35'
  if (s === 'CAUTION') return '#FFD60A'
  return '#00E8A0'
}

export function safetyLabel(safety) {
  const s = (safety || 'SAFE')
  return s.charAt(0) + s.slice(1).toLowerCase()
}

export function bhiStatus(bhi) {
  if (bhi == null) return { label: 'Unknown', color: '#94A3B8' }
  if (bhi > 75) return { label: 'Critical', color: '#FF2D55' }
  if (bhi > 55) return { label: 'Warning', color: '#FF6B35' }
  if (bhi > 30) return { label: 'Caution', color: '#FFD60A' }
  return { label: 'Good', color: '#00E8A0' }
}

// Resolve a possibly-nested path (e.g. 'battery.voltage' or 'voltage') from a telemetry object.
export function resolveValue(obj, path) {
  if (!obj || !path) return undefined
  const keys = String(path).split('.')
  let cur = obj
  for (const k of keys) {
    if (cur == null) return undefined
    cur = cur[k]
  }
  return cur
}

// Normalize raw history rows into flat rows with stable top-level keys.
export function normalizeTelemetry(rows, timeKey = 'time') {
  if (!Array.isArray(rows)) return []
  const aliases = {
    voltage: ['battery.voltage', 'voltage'],
    current: ['battery.current', 'current'],
    power: ['battery.power', 'power'],
    soc: ['battery.soc', 'soc'],
    ekfSoc: ['battery.ekfSoc', 'ekfSoc'],
    soh: ['battery.soh', 'soh'],
    resistance: ['battery.resistance', 'resistance'],
    cycles: ['battery.cycles', 'cycles'],
    efficiency: ['battery.efficiency', 'efficiency'],
    rul: ['battery.rul', 'rul'],
    twinError: ['battery.twinError', 'twinError'],
    dVdt: ['battery.dVdt', 'dVdt'],
    temperature: ['environment.temperature', 'temperature'],
    humidity: ['environment.humidity', 'humidity'],
    dTdt: ['environment.dTdt', 'dTdt'],
    gasMq2: ['gas.index_mq2', 'gas_mq2', 'mq2'],
    gasMq135: ['gas.index_mq135', 'gas_mq135', 'mq135'],
    gasRawMq2: ['gas.raw_mq2', 'raw_mq2'],
    gasRawMq135: ['gas.raw_mq135', 'raw_mq135'],
    bhi: ['risk.bhi', 'bhi'],
    rssi: ['network.rssi', 'rssi'],
    requests: ['network.requests', 'requests'],
    heap: ['network.free_heap', 'free_heap', 'heap'],
    uptime: ['network.uptime', 'uptime'],
    errors: ['errors', 'error_count'],
  }

  return rows.map((row) => {
    const out = { time: resolveValue(row, timeKey) ?? Date.now() }
    for (const [key, candidates] of Object.entries(aliases)) {
      let v
      for (const c of candidates) {
        v = resolveValue(row, c)
        if (v != null) break
      }
      out[key] = v
    }
    // keep a reference to the raw battery/risk objects for chips/badges
    out._battery = row.battery || row
    out._risk = row.risk
    out._env = row.environment
    out._gas = row.gas
    out._status = row.status || row._raw
    return out
  })
}
