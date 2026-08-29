'use client'

import { useEffect, useState, useRef } from 'react'
import { db } from '../lib/firebase'
import { ref, onValue, set } from 'firebase/database'

export function useFirebase(batteryId = 'BAT001') {
  const [data, setData] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let unsubscribe = null

    try {
      const dataRef = ref(db, `live_data/${batteryId}`)
      
      unsubscribe = onValue(
        dataRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val()
            setData(val)
            setConnected(true)
            setError(null)
          } else {
            // Check fallback path /live_data if single object format
            const rootRef = ref(db, 'live_data')
            onValue(rootRef, (rootSnap) => {
              if (rootSnap.exists()) {
                setData(rootSnap.val())
                setConnected(true)
                setError(null)
              }
            }, { onlyOnce: true })
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
