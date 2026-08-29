'use client'
import { useEffect, useState } from 'react'
import { useFirebase } from './useFirebase'

const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 5000

function createTimeoutSignal(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

// Real-time data hook: uses Firebase Realtime Database stream, with HTTP fallback.
export function useRealTimeData(batteryId = 'BAT001') {
  const { connected: firebaseConnected, data: firebaseData, sendCommand: sendFirebaseCmd } = useFirebase(batteryId)
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState('poll')
  const [error, setError] = useState(null)

  // Firebase real-time stream path
  useEffect(() => {
    if (firebaseConnected && firebaseData) {
      setMode('firebase')
      setConnected(true)
      setError(null)
      setHistory((h) => [...h, { time: Date.now(), ...firebaseData }].slice(-50))
      setData((prev) => ({ ...prev, ...firebaseData }))
    }
  }, [firebaseConnected, firebaseData])

  // HTTP polling fallback (only while Firebase RTDB stream has no data)
  useEffect(() => {
    if (firebaseConnected) return undefined

    let active = true
    let timer = null
    let timed = null

    async function fetchData() {
      timed = createTimeoutSignal(POLL_TIMEOUT_MS)
      try {
        const resp = await fetch(
          `/api/telemetry?batteryId=${encodeURIComponent(batteryId)}&t=${Date.now()}`,
          { signal: timed.signal }
        )
        if (!resp.ok) throw new Error('HTTP ' + resp.status)
        const d = await resp.json()
        if (active && d && d.message !== 'No data yet') {
          setData(d)
          setConnected(true)
          setError(null)
          setMode((m) => (m === 'firebase' ? m : 'poll'))
          setHistory((h) => [...h, { time: Date.now(), ...d }].slice(-50))
        }
      } catch (e) {
        if (active) {
          setConnected(false)
          setError(e.name === 'AbortError' ? 'Telemetry request timed out' : e.message)
        }
      } finally {
        if (timed) timed.clear()
      }
    }

    fetchData()
    timer = setInterval(fetchData, POLL_INTERVAL_MS)

    return () => {
      active = false
      if (timer) clearInterval(timer)
      if (timed) timed.clear()
    }
  }, [batteryId, firebaseConnected])

  const sendControl = async (command, value) => {
    const requestId = Math.random().toString(16).slice(2, 10)
    const payload = {
      command,
      value: value !== undefined ? value : command.toLowerCase().includes('on'),
      requestId,
    }
    
    // Direct write to Firebase Realtime Database
    if (firebaseConnected) {
      await sendFirebaseCmd(command, value)
    }

    // Also dispatch to API endpoint for MongoDB audit event logging
    try {
      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, batteryId }),
      })
      let body = null
      try { body = await response.json() } catch (e) { /* ignore */ }
      return { requestId, accepted: response.ok, body }
    } catch (e) {
      return { requestId, accepted: false, error: e.message }
    }
  }

  return { data, history, connected, mode, error, sendControl }
}

export default useRealTimeData