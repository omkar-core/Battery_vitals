import { getDB } from './mongodb'
import { sanitizeString } from './security'
import { buildProfileFromInput, checkCompatibility } from './batteryProfiles'
import { evaluateHardwareCompatibility } from './hardwareCompatibility'
import { recordAuditLog } from './auditLog'

function toDoc(profile, actor) {
  return {
    ...profile,
    updatedAt: new Date().toISOString(),
    updatedBy: actor || null,
  }
}

export async function listProfiles() {
  const db = await getDB()
  return db.collection('battery_profiles').find({}).sort({ profileId: 1 }).toArray()
}

export async function getProfile(profileId) {
  const db = await getDB()
  return db.collection('battery_profiles').findOne({ profileId: sanitizeString(profileId, 40) })
}

export async function saveProfile(input, actor) {
  const profile = buildProfileFromInput(input)
  const profileId = sanitizeString(
    input.profileId || `BV-${profile.chemistry}-${profile.series}S-${Date.now().toString(36).toUpperCase()}`,
    40,
  ).toUpperCase()
  const version = Math.max(1, Math.floor(Number(input.version) || 1))
  const doc = toDoc({ ...profile, profileId, version }, actor)
  const compatibility = evaluateHardwareCompatibility(doc)
  const db = await getDB()
  await db.collection('battery_profiles').updateOne({ profileId }, { $set: doc }, { upsert: true })

  // Layer 21: Audit Log
  await recordAuditLog({
    entityType: 'PROFILE',
    entityId: profileId,
    action: 'SAVE_PROFILE',
    actor: actor || 'system',
    changes: { profileId, version, compatible: compatibility.compatible, state: compatibility.state },
  })

  return { profile: doc, compatibility }
}

export async function getActiveDeployment(deviceId) {
  const db = await getDB()
  const id = sanitizeString(deviceId || 'BAT001', 10)
  const device = await db.collection('devices').findOne({ deviceId: id })
  const profileId = device?.activeProfileId || null
  const profile = profileId ? await db.collection('battery_profiles').findOne({ profileId }) : null
  return { deviceId: id, profileId, profile, configVersion: device?.activeProfileVersion || null }
}

export async function setActiveDeployment(deviceId, profileId, actor) {
  const db = await getDB()
  const id = sanitizeString(deviceId, 10)
  const pid = sanitizeString(profileId, 40)
  const profile = await db.collection('battery_profiles').findOne({ profileId: pid })
  if (!profile) return { ok: false, error: 'Profile not found' }
  const compatibility = checkCompatibility(profile)
  if (!compatibility.compatible) return { ok: false, error: 'Incompatible profile', compatibility, profile }
  await db.collection('devices').updateOne(
    { deviceId: id },
    { $set: { deviceId: id, activeProfileId: pid, activeProfileVersion: profile.version || 1, updatedAt: new Date().toISOString() } },
    { upsert: true },
  )
  try {
    await db.collection('system_events').insertOne({
      type: 'PROFILE_DEPLOY',
      severity: 'INFO',
      message: `Profile ${pid} deployed to ${id}`,
      details: { deviceId: id, profileId: pid, actor: actor ?? null },
      timestamp: new Date(),
    })
  } catch (e) { /* non-critical */ }
  return { ok: true, compatibility, profile }
}
