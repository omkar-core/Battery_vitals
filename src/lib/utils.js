export function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '--'
  return Number(value).toFixed(digits)
}

export function safetyColor(safety) {
  const s = (safety || 'SAFE').toUpperCase()
  if (s === 'EMERGENCY' || s === 'CRITICAL') return '#FF2D55'
  if (s === 'WARNING') return '#FF6B35'
  if (s === 'CAUTION') return '#FFD60A'
  if (s === 'SENSOR_FAULT') return '#FF6B35'
  return '#00E8A0'
}

export function safetyLabel(safety) {
  const s = (safety || 'SAFE').toUpperCase()
  if (s === 'SENSOR_FAULT') return 'Sensor Fault'
  return s.charAt(0) + s.slice(1).toLowerCase()
}

export function bhiStatus(bhi) {
  if (bhi == null) return { label: 'Unknown', color: '#94A3B8', zone: 'UNKNOWN' }
  if (bhi >= 70) return { label: 'Critical Risk', color: '#FF2D55', zone: 'CRITICAL', desc: 'Dominant risk: High thermal/chemical hazard' }
  if (bhi >= 50) return { label: 'High Warning', color: '#FF6B35', zone: 'WARNING', desc: 'Dominant risk: Elevated degradation/stress' }
  if (bhi >= 20) return { label: 'Moderate Caution', color: '#FFD60A', zone: 'CAUTION', desc: 'Dominant risk: Mild voltage/temp drift' }
  return { label: 'Optimal / Safe', color: '#00E8A0', zone: 'SAFE', desc: 'Normal parameters across all sensors' }
}

export function getConnectionState(timestamp) {
  if (!timestamp) return { state: 'CONNECTING', label: 'Connecting...', color: '#38BDF8', ageSec: null }
  const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
  const ageSec = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (ageSec < 30) {
    return { state: 'LIVE', label: `Live (${ageSec}s ago)`, color: '#00E8A0', ageSec }
  } else if (ageSec < 120) {
    return { state: 'STALE', label: `Stale (${Math.floor(ageSec)}s ago)`, color: '#FFD60A', ageSec }
  } else {
    const mins = Math.floor(ageSec / 60)
    return { state: 'OFFLINE', label: `Offline (${mins}m ago)`, color: '#FF2D55', ageSec }
  }
}

export function formatUptime(seconds) {
  if (seconds == null || isNaN(seconds)) return '--'
  const sec = Math.floor(Number(seconds))
  const days = Math.floor(sec / 86400)
  const hours = Math.floor((sec % 86400) / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${s}s`
  if (minutes > 0) return `${minutes}m ${s}s`
  return `${s}s`
}

export function rssiToBars(rssi) {
  if (rssi == null || isNaN(rssi)) return { bars: 0, label: 'N/A', pct: 0 }
  const r = Number(rssi)
  if (r >= -55) return { bars: 4, label: 'Excellent', pct: 100, color: '#00E8A0' }
  if (r >= -67) return { bars: 3, label: 'Good', pct: 75, color: '#38BDF8' }
  if (r >= -80) return { bars: 2, label: 'Fair', pct: 50, color: '#FFD60A' }
  return { bars: 1, label: 'Weak', pct: 25, color: '#FF2D55' }
}

export function playAlertChime(severity = 'WARNING') {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const isCritical = String(severity).toUpperCase() === 'CRITICAL' || String(severity).toUpperCase() === 'EMERGENCY'
    const now = ctx.currentTime

    if (isCritical) {
      // Urgent double high-frequency beep
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.setValueAtTime(1174.66, now + 0.12)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.35)
    } else {
      // Gentle notification tone
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.setValueAtTime(880, now + 0.08) // A5
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  } catch (e) {
    // AudioContext permission or browser restriction
  }
}

export function exportToCSV(data, filename = 'battery_telemetry.csv') {
  if (!Array.isArray(data) || data.length === 0) return false
  const keys = Object.keys(data[0]).filter((k) => !k.startsWith('_'))
  const header = keys.join(',')
  const rows = data.map((row) =>
    keys
      .map((k) => {
        const val = row[k]
        if (val === null || val === undefined) return ''
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`
        return val
      })
      .join(',')
  )
  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([header, ...rows].join('\n'))
  const link = document.createElement('a')
  link.setAttribute('href', csvContent)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}

export function exportToJSON(data, filename = 'battery_telemetry.json') {
  const jsonContent = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2))
  const link = document.createElement('a')
  link.setAttribute('href', jsonContent)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
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
