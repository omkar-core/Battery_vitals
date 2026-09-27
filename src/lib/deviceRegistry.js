import { getDB } from './mongodb'
import { sanitizeString, sanitizeNumber } from './security'

export async function listDevices() {
  const db = await getDB()
  const devices = await db.collection('devices').find({}).sort({ deviceId: 1 }).toArray()
  return devices.map((d) => ({
    deviceId: d.deviceId,
    name: d.name || d.deviceId,
    location: d.location || '',
    chemistry: d.chemistry || 'LiFePO4',
    nominalVoltage: d.nominalVoltage || 12.8,
    activeProfileId: d.activeProfileId || null,
    createdAt: d.createdAt,
  }))
}

export async function registerDevice(data) {
  const db = await getDB()
  const deviceId = sanitizeString(data.deviceId, 10)
  const doc = {
    deviceId,
    name: sanitizeString(data.name || deviceId, 60),
    location: sanitizeString(data.location || '', 80),
    chemistry: sanitizeString(data.chemistry || 'LiFePO4', 30),
    nominalVoltage: sanitizeNumber(data.nominalVoltage, 3.2, 48),
    createdAt: new Date().toISOString(),
  }
  await db.collection('devices').updateOne({ deviceId }, { $set: doc }, { upsert: true })
  return doc
}