import { describe, it, expect } from 'vitest'
import { normalizeEsp32Packet } from './esp32'
import { TelemetryPayloadSchema, LEDControlSchema, BuzzerControlSchema } from './schemas'
import { validateTelemetry, computeSafety, SAFETY_STATES } from './batterySafety'

describe('ESP32 Firmware Payload Normalization & Compatibility (ESP32_RULES.md §3)', () => {
  const sampleRawEsp32Packet = {
    batteryId: 'BAT001',
    deviceId: 'BV001',
    firmware: 'v13.0',
    mac: '24:6F:28:1A:2B:3C',
    voltage: 12.64,
    current: 2450.0,    // 2450 mA
    power: 30968.0,     // 30968 mW
    temperature: 26.4,
    humidity: 52.0,
    mq2: 320,
    mq135: 110,
    soc: 85,
    soh: 98,
    soh_valid: true,
    bhi: 8,
    resistance: 14.2,
    state: 'SAFE',
    op: 'DISCHARGE',
    ina_ok: true,
    dht_ok: true,
    gas_warm: true,
    wifi_rssi: -64,
    free_heap: 218450,
    auto_mode: true,
    red_led: false,
    yellow_led: false,
    green_led: true,
    buzzer: false,
    timestamp: 128450, // uptime ms
  }

  it('normalizes mA to A and mW to W correctly according to specification', () => {
    const normalized = normalizeEsp32Packet(sampleRawEsp32Packet)

    expect(normalized.current).toBeCloseTo(2.45, 2)
    expect(normalized.power).toBeCloseTo(30.968, 2)
    expect(normalized.battery.current).toBeCloseTo(2.45, 2)
    expect(normalized.battery.power).toBeCloseTo(30.968, 2)
  })

  it('preserves valid measured SOH when soh_valid is true', () => {
    const normalized = normalizeEsp32Packet(sampleRawEsp32Packet)
    expect(normalized.soh).toBe(98)
    expect(normalized.battery.soh).toBe(98)
  })

  it('suppresses unmeasured default SOH when soh_valid is false', () => {
    const uncalibrated = { ...sampleRawEsp32Packet, soh: 100, soh_valid: false, resistance: 0 }
    const normalized = normalizeEsp32Packet(uncalibrated)
    expect(normalized.soh).toBeNull()
    expect(normalized.battery.soh).toBeNull()
  })

  it('normalizes uptime ms into human-readable uptime seconds and attaches epoch timestamp', () => {
    const normalized = normalizeEsp32Packet(sampleRawEsp32Packet)
    expect(normalized.uptimeMs).toBe(128450)
    expect(normalized.uptime).toBe(128)
    expect(typeof normalized.timestamp).toBe('number')
    expect(normalized.timestamp).toBeGreaterThan(0)
  })

  it('correctly maps outputs and hardware states', () => {
    const normalized = normalizeEsp32Packet(sampleRawEsp32Packet)
    expect(normalized.outputs.auto).toBe(true)
    expect(normalized.outputs.green).toBe(true)
    expect(normalized.outputs.red).toBe(false)
    expect(normalized.outputs.yellow).toBe(false)
    expect(normalized.outputs.buzzer).toBe(false)
  })
})

describe('ESP32 REST Gateway Validation (Zod Schemas - ESP32_RULES.md §3.3)', () => {
  it('validates a conformant flat ingest payload', () => {
    const payload = {
      deviceId: 'BAT001',
      voltage: 12.6,
      current: 2.1,
      temperature: 25.5,
      humidity: 50.0,
      mq2: 350,
      mq135: 120,
      ina_ok: true,
      dht_ok: true,
    }

    const result = TelemetryPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects voltages below 0.5V (disconnected probe rule)', () => {
    const payload = {
      deviceId: 'BAT001',
      voltage: 0.2, // Below 0.5V
      current: 1.0,
      temperature: 25.0,
    }

    const result = TelemetryPayloadSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('rejects invalid device IDs', () => {
    const payload = {
      deviceId: 'invalid id with spaces!!',
      voltage: 12.0,
      current: 1.0,
      temperature: 25.0,
    }

    const result = TelemetryPayloadSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('validates LED and Buzzer actuator command schemas', () => {
    expect(LEDControlSchema.safeParse({ deviceId: 'BAT001', led: 'green', state: true }).success).toBe(true)
    expect(LEDControlSchema.safeParse({ deviceId: 'BAT001', led: 'purple', state: true }).success).toBe(false)

    expect(BuzzerControlSchema.safeParse({ deviceId: 'BAT001', mode: 'fast_beep' }).success).toBe(true)
    expect(BuzzerControlSchema.safeParse({ deviceId: 'BAT001', mode: 'invalid_mode' }).success).toBe(false)
  })
})

describe('ESP32 Deterministic Safety Engine Synchronization (ESP32_RULES.md §5)', () => {
  it('matches firmware CRITICAL trip when voltage < 10.0V', () => {
    const { clean } = validateTelemetry({ voltage: 9.8, temperature: 25.0, bhi: 10 })
    const safety = computeSafety(clean)
    expect(safety.state).toBe(SAFETY_STATES.CRITICAL)
    expect(safety.violations.some((v) => v.rule.code === 'voltage_band_violation')).toBe(true)
  })

  it('matches firmware EMERGENCY trip on deep discharge < 9.5V', () => {
    const { clean } = validateTelemetry({ voltage: 9.3, temperature: 25.0, bhi: 10 })
    const safety = computeSafety(clean)
    expect(safety.state).toBe(SAFETY_STATES.EMERGENCY)
    expect(safety.violations.some((v) => v.rule.code === 'voltage_deep_discharge')).toBe(true)
  })

  it('matches firmware EMERGENCY trip on thermal runaway edge > 55°C', () => {
    const { clean } = validateTelemetry({ voltage: 12.6, temperature: 56.0, bhi: 10 })
    const safety = computeSafety(clean)
    expect(safety.state).toBe(SAFETY_STATES.EMERGENCY)
    expect(safety.violations.some((v) => v.rule.code === 'thermal_runaway_edge')).toBe(true)
  })

  it('triggers SENSOR_FAULT / CRITICAL if both INA and DHT report failure', () => {
    const { clean } = validateTelemetry({ voltage: 12.6, temperature: 25.0, ina_ok: false, dht_ok: false })
    const safety = computeSafety(clean)
    expect(safety.state).toBe(SAFETY_STATES.CRITICAL)
    expect(safety.violations.some((v) => v.rule.code === 'sensor_fault')).toBe(true)
  })
})
