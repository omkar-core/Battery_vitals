'use client'

import { useEffect, useState } from 'react'
import { db } from '../lib/firebase'
import { ref, onValue, get, set } from 'firebase/database'
import { normalizeEsp32Packet } from '../lib/esp32'

export function useFirebase(batteryId = 'BAT001') {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let unsubscribe = null
    let disposed = false

    try {
      const dataRef = ref(db, `live_data/${batteryId}`)

      unsubscribe = onValue(
        dataRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setData(normalizeEsp32Packet(snapshot.val()))
            setConnected(true)
            setError(null)
          } else {
            // Fallback path: check /live_data with a one-time read (get()).
            // Uses `get` instead of stacking nested onValue listeners so we
            // do not register a new listener every time the path is empty.
            get(ref(db, 'live_data'))
              .then((rootSnap) => {
                if (disposed || !rootSnap.exists()) return
                const rootVal = rootSnap.val()
                const val =
                  rootVal && typeof rootVal === 'object' && rootVal[batteryId]
                    ? rootVal[batteryId]
                    : rootVal
                setData(normalizeEsp32Packet(val))
                setConnected(true)
                setError(null)
              })
              .catch((err) => {
                console.error('Firebase live_data fallback read error:', err)
              })
          }
        },
        (err) => {
          console.error('Firebase Realtime Database error:', err)
          setConnected(false)
          setError(err.message)
        }
      )
    } catch (err) {
      console.error('useFirebase setup error:', err)
      setError(err.message)
      setConnected(false)
    }

    return () => {
      disposed = true
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [batteryId])

  const sendFirebaseControl = async (command, value) => {
    try {
      const cmdRef = ref(db, `commands/${batteryId}`)
      const payload = {
        command,
        value: value !== undefined ? value : true,
        ts: Date.now(),
        updatedAt: Date.now(),
      }
      await set(cmdRef, payload)
      return { accepted: true, payload }
    } catch (err) {
      console.error('sendFirebaseControl error:', err)
      return { accepted: false, error: err.message }
    }
  }

  return { data, connected, error, sendCommand: sendFirebaseControl }
}

export default useFirebase