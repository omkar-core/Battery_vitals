import 'server-only'
import { getDB } from './mongodb'

export const DEMO_BATTERY_ID = 'BAT001'
export const GUEST_USER_ID = 'usr_guest'

export const DEFAULT_DEMO_BATTERY = {
  batteryId: DEMO_BATTERY_ID,
  ownerId: GUEST_USER_ID,
  profileId: 'LIFEPO4_12V_100AH',
  deviceId: 'BAT001',
  name: 'ESP32 Monitored Pack (BAT001)',
  chemistry: 'LiFePO4',
  nominalVoltage: 12.8,
  capacityAh: 100,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: new Date().toISOString(),
}

/**
 * Get all batteries owned by a given user.
 * If user is guest or has no batteries, returns the demo battery.
 */
export async function getUserBatteries(userId) {
  if (!userId || userId === GUEST_USER_ID) {
    return [DEFAULT_DEMO_BATTERY]
  }

  try {
    const db = await getDB()
    const batteries = await db
      .collection('batteries')
      .find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .toArray()

    if (batteries.length === 0) {
      // Seed default battery for newly registered user if needed
      return [
        {
          ...DEFAULT_DEMO_BATTERY,
          batteryId: `BV-USER-${userId.slice(0, 6).toUpperCase()}`,
          ownerId: userId,
          name: 'Primary Battery Pack',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    }

    return batteries.map((b) => {
      const { _id, ...rest } = b
      return rest
    })
  } catch (error) {
    console.warn('[batteryRegistry] Error fetching user batteries, returning demo fallback:', error.message)
    return [DEFAULT_DEMO_BATTERY]
  }
}

/**
 * Get details for a specific battery by ID.
 */
export async function getBatteryById(batteryId) {
  if (!batteryId || batteryId === DEMO_BATTERY_ID) {
    return DEFAULT_DEMO_BATTERY
  }

  try {
    const db = await getDB()
    const battery = await db.collection('batteries').findOne({ batteryId })
    if (!battery) {
      if (batteryId.startsWith('BAT')) return DEFAULT_DEMO_BATTERY
      return null
    }
    const { _id, ...rest } = battery
    return rest
  } catch (error) {
    console.warn('[batteryRegistry] Error fetching battery by ID:', error.message)
    return DEFAULT_DEMO_BATTERY
  }
}

/**
 * Check whether a user owns a specific battery ID.
 * Returns true if ownerId matches or if in public demo mode with BAT001.
 */
export async function validateBatteryOwnership(userId, batteryId) {
  if (!batteryId || batteryId === DEMO_BATTERY_ID || userId === GUEST_USER_ID) {
    return true
  }

  const battery = await getBatteryById(batteryId)
  if (!battery) return false
  return battery.ownerId === userId || battery.ownerId === GUEST_USER_ID
}

/**
 * Register or update a battery owned by a user.
 */
export async function upsertUserBattery(userId, batteryData) {
  if (!userId || userId === GUEST_USER_ID) {
    throw new Error('Guest users cannot register custom batteries')
  }

  const batteryId = batteryData.batteryId || `BV-${Date.now().toString(36).toUpperCase()}`
  const now = new Date().toISOString()

  const record = {
    batteryId,
    ownerId: userId,
    profileId: batteryData.profileId || 'LIFEPO4_12V_100AH',
    deviceId: batteryData.deviceId || batteryId,
    name: batteryData.name || 'Battery Pack',
    chemistry: batteryData.chemistry || 'LiFePO4',
    nominalVoltage: Number(batteryData.nominalVoltage) || 12.8,
    capacityAh: Number(batteryData.capacityAh) || 100,
    updatedAt: now,
  }

  try {
    const db = await getDB()
    await db.collection('batteries').updateOne(
      { batteryId },
      {
        $set: record,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    )
    return record
  } catch (error) {
    console.error('[batteryRegistry] Failed to upsert battery:', error.message)
    throw error
  }
}
