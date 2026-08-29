import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { getAuth } from 'firebase-admin/auth'
import { normalizeEsp32Packet } from './esp32'

function getAdminApp() {
  try {
    const existingApps = getApps()
    if (existingApps.length > 0) {
      return existingApps[0]
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'batteryvital'
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@batteryvital.iam.gserviceaccount.com'
    
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    if (privateKey) {
      // Strip surrounding quotes if wrapped in quotes on Render / Vercel
      privateKey = privateKey.trim()
      if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1)
      }
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
  } catch (err) {
    console.error('Firebase Admin App initialization error:', err.message)
    return null
  }
}

const adminApp = getAdminApp()
export const adminDb = adminApp ? getDatabase(adminApp) : null
export const adminAuth = adminApp ? getAuth(adminApp) : null

/**
 * Fetch latest telemetry for a battery from Firebase RTDB safely.
 * Raw ESP32 packets (mA/mW + millis()-uptime timestamp) are normalized here
 * so every API route receives consistent units and real epoch timestamps.
 */
export async function getLatestTelemetry(batteryId = 'BAT001') {
  if (!adminDb) return null
  try {
    const snapshot = await adminDb.ref(`live_data/${batteryId}`).once('value')
    if (snapshot.exists()) {
      return normalizeEsp32Packet(snapshot.val())
    }
    const rootSnapshot = await adminDb.ref('live_data').once('value')
    if (rootSnapshot.exists()) {
      const rootVal = rootSnapshot.val()
      const val = rootVal && typeof rootVal === 'object' && rootVal[batteryId]
        ? rootVal[batteryId]
        : rootVal
      return val && typeof val === 'object'
        ? normalizeEsp32Packet({ ...val, batteryId })
        : null
    }
    return null
  } catch (err) {
    console.error('getLatestTelemetry Admin error:', err.message)
    return null
  }
}

/**
 * Write telemetry data to Firebase RTDB safely
 */
export async function updateLatestTelemetry(batteryId = 'BAT001', data) {
  if (!adminDb) return false
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
 * Write control command to Firebase RTDB for ESP32 polling/listener safely
 */
export async function setAdminCommand(batteryId = 'BAT001', commandPayload) {
  if (!adminDb) return false
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
 * Read control commands safely
 */
export async function getAdminCommand(batteryId = 'BAT001') {
  if (!adminDb) return null
  try {
    const snapshot = await adminDb.ref(`commands/${batteryId}`).once('value')
    return snapshot.exists() ? snapshot.val() : null
  } catch (err) {
    console.error('getAdminCommand Admin error:', err.message)
    return null
  }
}

/**
 * Write alert to Firebase RTDB `/alerts` safely
 */
export async function pushAdminAlert(alertPayload) {
  if (!adminDb) return null
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
