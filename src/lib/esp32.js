// Shared normalization for raw ESP32 telemetry packets.
//
// The ESP32 firmware writes a flat packet directly to Firebase RTDB
// (`live_data/BAT001`). That packet differs from the API document shape:
//   - `current` is in milliamps (mA)
//   - `power` is in milliwatts (mW)
//   - `timestamp` is `millis()` UPTIME, not an epoch timestamp
//   - `state`, `op`, `mq2`, `mq135`, `wifi_rssi`, `free_heap` are top-level
//
// This module converts those packets into the shape every route and page
// expects, without inventing any values that the device did not report.

const NUMBER_FIELDS = [
  'voltage',
  'soc',
  'soh',
  'bhi',
  'temperature',
  'humidity',
  'cycles',
  'energyWh',
  'phase',
  'resistance',
  'dV_dt',
  'dT_dt',
  'errors',
]

const SAFETY_MAP = {
  SAFE: 'SAFE',
  CAUTION: 'CAUTION',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  EMERGENCY: 'EMERGENCY',
  SENSOR_FAULT: 'SENSOR_FAULT',
}

function isRawEsp32Packet(p) {
  if (!p || typeof p !== 'object') return false
  // API-shaped documents carry nested battery/gas objects and have no raw markers
  if (p.battery && typeof p.battery === 'object') return false
  if (p.gasIndex && typeof p.gasIndex === 'object') return false
  // Raw ESP32 packets always carry these firmware fields
  return (
    p.state !== undefined ||
    p.op !== undefined ||
    p.mq2 !== undefined ||
    p.mq135 !== undefined ||
    (p.wifi_rssi !== undefined && p.free_heap !== undefined)
  )
}

function num(v) {
  if (v == null || v === '' || isNaN(Number(v))) return null
  return Number(v)
}

function mapState(s) {
  const key = String(s || '').toUpperCase()
  return SAFETY_MAP[key] || null
}

export function normalizeEsp32Packet(packet, { now = Date.now() } = {}) {
  if (!isRawEsp32Packet(packet)) return packet

  const p = packet
  const rawCurrent = num(p.current)
  const rawPower = num(p.power)
  const uptimeMs = num(p.timestamp)
  const voltage = num(p.voltage)
  const soc = num(p.soc)
  // SOH is only trusted when it is genuinely derived from a live resistance
  // measurement under load. The firmware boot default (100%) must never be
  // presented as real telemetry. New firmware reports `soh_valid`; legacy
  // frames are treated as measured only when a positive resistance is present.
  const rawSoh = num(p.soh)
  const sohMeasured =
    p.soh_valid === true ||
    (p.soh_valid === false ? false : num(p.resistance) > 0)
  const soh = sohMeasured && rawSoh != null ? rawSoh : null
  const bhi = num(p.bhi)
  const temperature = num(p.temperature)
  const humidity = num(p.humidity)
  const safety = mapState(p.state || p.safety)
  const op = String(p.op || '').toUpperCase()

  const battery = { voltage }

  for (const f of NUMBER_FIELDS) {
    if (p[f] !== undefined) battery[f] = num(p[f])
  }

  battery.current = rawCurrent != null ? rawCurrent / 1000 : null
  battery.power = rawPower != null ? rawPower / 1000 : null
  battery.soc = soc
  battery.soh = soh
  battery.safety = safety
  battery.op = op || null

  // Strip the raw firmware keys so a normalized document is never treated as
  // a raw packet again (keeps the transform idempotent).
  const out = {
    batteryId: p.batteryId || 'BAT001',
    deviceId: p.deviceId || null,
    voltage,
    current: battery.current,
    power: battery.power,
    soc,
    soh,
    bhi,
    temperature,
    humidity,
    safety: safety || null,
    opDirection: op || null,
    resistance: num(p.resistance),
    profile: p.profile || null,
    firmware: p.firmware || null,
    mac: p.mac || null,
    cycles: num(p.cycles),
    energyWh: num(p.energyWh),
    timestamp: now,
    receivedAt: new Date(now).toISOString(),
    ts: now,
    uptimeMs,
    uptime: uptimeMs != null ? Math.floor(uptimeMs / 1000) : null,
    ina_ok: p.ina_ok !== undefined ? !!p.ina_ok : null,
    dht_ok: p.dht_ok !== undefined ? !!p.dht_ok : null,
    errors: num(p.errors) ?? null,
    gasIndex: {
      mq2: num(p.mq2),
      mq135: num(p.mq135),
      warm: p.gas_warm !== undefined ? !!p.gas_warm : null,
    },
    network: {
      rssi: num(p.wifi_rssi ?? p.rssi),
      heap: num(p.free_heap ?? p.heap),
    },
    outputs: {
      auto: p.auto_mode !== undefined ? !!p.auto_mode : null,
      red: p.red_led !== undefined ? !!p.red_led : null,
      yellow: p.yellow_led !== undefined ? !!p.yellow_led : null,
      green: p.green_led !== undefined ? !!p.green_led : null,
      buzzer: p.buzzer !== undefined ? !!p.buzzer : null,
    },
    battery,
    environment: {
      temperature,
      humidity,
    },
    gas: {
      index_mq2: num(p.mq2),
      index_mq135: num(p.mq135),
    },
    risk: {
      bhi,
    },
  }

  return out
}