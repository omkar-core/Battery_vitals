import { initializeApp, getApps, getApp } from 'firebase/app'
import { getDatabase, ref, onValue, set, get, child, update, remove } from 'firebase/database'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDHbJaTX83jCa1w7jhEb29ZmPBkTEXanxY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "batteryvital.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "batteryvital",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "batteryvital.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "219115438864",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:219115438864:web:a78d8566213c32302ddb95",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-T30FYGCZ27",
}

// Initialize Firebase App (ensure single instance)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// Realtime Database instance
export const db = getDatabase(app)

// Auth instance
export const auth = getAuth(app)

/**
 * Helper to subscribe to live battery telemetry at path `/live_data` or `/live_data/[batteryId]`
 */
export function subscribeToLiveData(batteryId = 'BAT001', callback) {
  const dataRef = ref(db, `live_data/${batteryId}`)
  return onValue(
    dataRef,
    (snapshot) => {
      const val = snapshot.val()
      if (val) {
        callback(val)
      } else {
        // Fallback check root /live_data if legacy structure
        const rootRef = ref(db, 'live_data')
        get(rootRef).then((snap) => {
          if (snap.exists()) callback(snap.val())
        }).catch(() => {})
      }
    },
    (err) => {
      console.error('Firebase RTDB subscribe error:', err)
    }
  )
}

/**
 * Helper to write live data
 */
export async function setLiveData(batteryId = 'BAT001', data) {
  const dataRef = ref(db, `live_data/${batteryId}`)
  return set(dataRef, {
    ...data,
    batteryId,
    timestamp: Date.now(),
  })
}

/**
 * Helper to send control commands to ESP32
 */
export async function sendCommand(batteryId = 'BAT001', commandPayload) {
  const cmdRef = ref(db, `commands/${batteryId}`)
  return set(cmdRef, {
    ...commandPayload,
    updatedAt: Date.now(),
  })
}

/**
 * Subscribe to command responses/updates
 */
export function subscribeToCommands(batteryId = 'BAT001', callback) {
  const cmdRef = ref(db, `commands/${batteryId}`)
  return onValue(cmdRef, (snapshot) => {
    callback(snapshot.val())
  })
}

export default app
