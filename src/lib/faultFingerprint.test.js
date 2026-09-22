import { describe, it, expect } from 'vitest'
import {
  generateFaultFingerprint,
  groupFaultsByFingerprint,
  correlateWindowFaults,
} from './faultFingerprint'

describe('faultFingerprint (Layer 11)', () => {
  it('generates consistent, bucketed deterministic fingerprints', () => {
    const alert1 = { type: 'over_temperature', severity: 'CRITICAL', value: 46.1 }
    const alert2 = { type: 'over_temperature', severity: 'CRITICAL', value: 45.9 }
    const alert3 = { type: 'over_voltage', severity: 'CRITICAL', value: 15.2 }

    const fp1 = generateFaultFingerprint(alert1)
    const fp2 = generateFaultFingerprint(alert2)
    const fp3 = generateFaultFingerprint(alert3)

    // Both ~46°C bucket to the same fingerprint
    expect(fp1).toBe(fp2)
    expect(fp1).toContain('over_temperature_CRITICAL_46')
    expect(fp3).not.toBe(fp1)
  })

  it('groups repeated alerts into a single entry with recurrence counter', () => {
    const alerts = [
      { type: 'over_temperature', severity: 'CRITICAL', value: 46.0, timestamp: '2026-09-22T10:00:00Z', message: 'Temp 46C' },
      { type: 'over_temperature', severity: 'CRITICAL', value: 46.2, timestamp: '2026-09-22T10:05:00Z', message: 'Temp 46.2C' },
      { type: 'over_temperature', severity: 'CRITICAL', value: 45.8, timestamp: '2026-09-22T10:10:00Z', message: 'Temp 45.8C' },
      { type: 'low_voltage', severity: 'WARNING', value: 10.1, timestamp: '2026-09-22T10:12:00Z', message: 'Low V' },
    ]

    const grouped = groupFaultsByFingerprint(alerts)
    expect(grouped.length).toBe(2)

    const overTempGroup = grouped.find((g) => g.code === 'over_temperature')
    expect(overTempGroup).toBeDefined()
    expect(overTempGroup.count).toBe(3)
    expect(overTempGroup.instances.length).toBe(3)
  })

  it('correlates multiple distinct faults occurring within the same time window', () => {
    const t0 = new Date('2026-09-22T12:00:00Z').getTime()
    const alerts = [
      { type: 'voltage_sag', timestamp: new Date(t0).toISOString() },
      { type: 'over_current', timestamp: new Date(t0 + 15000).toISOString() }, // 15s later -> same window
      { type: 'low_temp', timestamp: new Date(t0 + 120000).toISOString() }, // 2 min later -> separate window
    ]

    const correlated = correlateWindowFaults(alerts, 60000)
    expect(correlated.length).toBe(1)
    expect(correlated[0].length).toBe(2)
    expect(correlated[0][0].type).toBe('voltage_sag')
    expect(correlated[0][1].type).toBe('over_current')
  })
})
