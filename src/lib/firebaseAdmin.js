import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { getAuth } from 'firebase-admin/auth'

function getAdminApp() {
  const existingApps = getApps()
  if (existingApps.length > 0) {
    return existingApps[0]
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'batteryvital'
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@batteryvital.iam.gserviceaccount.com'
  
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app/'

  if (privateKey && clientEmail) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL,
    })
  } else {
    return initializeApp({
      projectId,
      databaseURL,
    })
  }
}

const adminApp = getAdminApp()
export const adminDb = getDatabase(adminApp)
export const adminAuth = getAuth(adminApp)

/**
 * Fetch latest telemetry for a battery from Firebase RTDB
 */
export async function getLatestTelemetry(batteryId = 'BAT001') {
  try {
    const snapshot = await adminDb.ref(`live_data/${batteryId}`).once('value')
    if (snapshot.exists()) {
      return snapshot.val()
    }
    const rootSnapshot = await adminDb.ref('live_data').once('value')
    if (rootSnapshot.exists()) {
      return rootSnapshot.val()
    }
    return null
  } catch (err) {
    console.error('getLatestTelemetry Admin error:', err.message)
    return null
  }
}

/**
 * Write telemetry data to Firebase RTDB
 */
export async function updateLatestTelemetry(batteryId = 'BAT001', data) {
  try {
    await adminDb.ref(`live_data/${batteryId}`).update({
      ...data,
      batteryId,
      timestamp: Date.now(),
    })
    return true
  } catch (err) {
    console.error('updateLatestTelemetry Admin error:', err.message)
    return false
  }
}

/**
 * Write control command to Firebase RTDB for ESP32 polling/listener
 */
export async function setAdminCommand(batteryId = 'BAT001', commandPayload) {
  try {
    await adminDb.ref(`commands/${batteryId}`).set({
      ...commandPayload,
      updatedAt: Date.now(),
    })
    return true
  } catch (err) {
    console.error('setAdminCommand Admin error:', err.message)
    return false
  }
}

/**
 * Read control commands
 */
export async function getAdminCommand(batteryId = 'BAT001') {
  try {
    const snapshot = await adminDb.ref(`commands/${batteryId}`).once('value')
    return snapshot.exists() ? snapshot.val() : null
  } catch (err) {
    console.error('getAdminCommand Admin error:', err.message)
    return null
  }
}

/**
 * Write alert to Firebase RTDB `/alerts`
 */
export async function pushAdminAlert(alertPayload) {
  try {
    const newAlertRef = adminDb.ref('alerts').push()
    await newAlertRef.set({
      ...alertPayload,
      id: newAlertRef.key,
      timestamp: Date.now(),
    })
    return newAlertRef.key
  } catch (err) {
    console.error('pushAdminAlert Admin error:', err.message)
    return null
  }
}

export default adminApp
