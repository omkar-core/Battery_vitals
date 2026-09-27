import { describe, it, expect, vi } from 'vitest'
import { getUserBatteries, getBatteryById, validateBatteryOwnership } from './batteryRegistry'
import { formatAIContextPrompt } from './aiContext'
import { logAIAuditRecord } from './aiAudit'

describe('Battery Registry & User Ownership', () => {
  it('returns empty array for unknown user', async () => {
    const batteries = await getUserBatteries('unknown_user')
    expect(batteries).toEqual([])
  })

  it('returns null for non-existent battery', async () => {
    const battery = await getBatteryById('NONEXISTENT')
    expect(battery).toBeNull()
  })

  it('returns false for ownership of non-existent battery', async () => {
    const isOwner = await validateBatteryOwnership('user123', 'NONEXISTENT')
    expect(isOwner).toBe(false)
  })

  it('returns empty array for null userId', async () => {
    const batteries = await getUserBatteries(null)
    expect(batteries).toEqual([])
  })

  it('returns null for null batteryId', async () => {
    const battery = await getBatteryById(null)
    expect(battery).toBeNull()
  })
})

describe('AI Context Engine', () => {
  it('formats AI context prompt string cleanly', () => {
    const mockContext = {
      batteryId: 'BAT001',
      batteryName: 'Test LiFePO4',
      chemistry: 'LiFePO4',
      nominalVoltage: 12.8,
      capacityAh: 100,
      currentTelemetry: {
        voltage: 13.2,
        current: 2.1,
        temperature: 31.4,
        soc: 78,
        soh: 89,
        cycles: 184,
        internalResistance: 0.015,
      },
      deterministicSafetyState: {
        statusLabel: 'SAFE',
        stateCode: 0,
        activeTrips: [],
      },
      historicalTrends: {
        current: { soh: 89, cycles: 184, temperature: 31.4 },
        previous30DaysAgo: { soh: 91, cycles: 162, temperature: 29.5 },
      },
      sensorConfidence: {
        overallConfidence: '100% Verified Hardware',
      },
    }

    const promptText = formatAIContextPrompt(mockContext)
    expect(promptText).toContain('VERIFIED BATTERY CONTEXT')
    expect(promptText).toContain('Battery ID: BAT001')
    expect(promptText).toContain('Safety Rank: SAFE')
    expect(promptText).toContain('SOH: Current 89% vs 30d ago 91%')
  })
})

describe('AI Audit Logger', () => {
  it('creates structured AI audit log entry', async () => {
    const entry = await logAIAuditRecord({
      userId: 'usr_test_123',
      batteryId: 'BAT001',
      endpoint: '/api/ai/chat',
      responseTimeMs: 120,
      deterministicSafetyState: 'SAFE',
    })

    expect(entry).toBeDefined()
    expect(entry.userId).toBe('usr_test_123')
    expect(entry.endpoint).toBe('/api/ai/chat')
    expect(entry.responseTimeMs).toBe(120)
    expect(entry.timestamp).toBeDefined()
  })

  it('throws error when userId is missing', async () => {
    await expect(logAIAuditRecord({
      batteryId: 'BAT001',
      endpoint: '/api/ai/chat',
    })).rejects.toThrow('userId is required')
  })

  it('throws error when batteryId is missing', async () => {
    await expect(logAIAuditRecord({
      userId: 'usr_test_123',
      endpoint: '/api/ai/chat',
    })).rejects.toThrow('batteryId is required')
  })
})