import 'server-only'
import { getDB } from './mongodb'

/**
 * Get all batteries owned by a given user.
 * Returns empty array if user has no batteries (no demo fallback).
 */
export async function getUserBatteries(userId) {
  if (!userId) {
    return []
  }

  try {
    const db = await getDB()
    const batteries = await db
      .collection('batteries')
      .find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .toArray()

    return batteries.map((b) => {
      const { _id, ...rest } = b
      return rest
    })
  } catch (error) {
    console.error('[batteryRegistry] Error fetching user batteries:', error.message)
    return []
  }
}

/**
 * Get details for a specific battery by ID.
 * Returns null if not found (no demo fallback).
 */
export async function getBatteryById(batteryId) {
  if (!batteryId) {
    return null
  }

  try {
    const db = await getDB()
    const battery = await db.collection('batteries').findOne({ batteryId })
    if (!battery) {
      return null
    }
    const { _id, ...rest } = battery
    return rest
  } catch (error) {
    console.error('[batteryRegistry] Error fetching battery by ID:', error.message)
    return null
  }
}

/**
 * Check whether a user owns a specific battery ID.
 * Returns false if battery not found or user doesn't own it.
 */
export async function validateBatteryOwnership(userId, batteryId) {
  if (!userId || !batteryId) {
    return false
  }

  const battery = await getBatteryById(batteryId)
  if (!battery) return false
  return battery.ownerId === userId
}

/**
 * Register or update a battery owned by a user.
 * Requires authenticated user (no guest fallback).
 */
export async function upsertUserBattery(userId, batteryData) {
  if (!userId) {
    throw new Error('Authenticated user required to register batteries')
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