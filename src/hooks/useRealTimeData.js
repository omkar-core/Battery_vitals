'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useFirebase } from './useFirebase'
import { authHeaders as headerAuth } from '../lib/clientToken'

const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 5000

function createTimeoutSignal(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

function resolveBatteryId(provided) {
  if (provided) return provided
  try {
    return localStorage.getItem('bv_active_device') || 'BAT001'
  } catch (e) {
    return 'BAT001'
  }
}

// Battery asset the hook is currently subscribed to, re-exposed so pages/header
// can render the active fleet unit.
const ACTIVE_KEY = 'bv_active_device'

export function useRealTimeData(batteryId) {
  const [activeId, setActiveId] = useState(() => resolveBatteryId(batteryId))
  useEffect(() => {
    setActiveId(resolveBatteryId(batteryId))
  }, [batteryId])

  const { connected: firebaseConnected, data: firebaseData, sendCommand: sendFirebaseCmd } = useFirebase(activeId)
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState('poll')
  const [error, setError] = useState(null)

  // Latest telemetry capture time as an epoch-ms value (or null before first packet),
  // so pages can feed the header connection badge a real timestamp.
  const lastSeen = useMemo(() => {
    const ts = data?.timestamp ?? data?.receivedAt ?? data?.ts
    return ts != null ? Number(ts) : null
  }, [data])

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

  // Drop stale readings when the operator switches fleet units.
  useEffect(() => {
    setData(null)
    setHistory([])
    setMode('poll')
    setConnected(false)
  }, [activeId])

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
          `/api/telemetry?batteryId=${encodeURIComponent(activeId)}&t=${Date.now()}`,
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
  }, [activeId, firebaseConnected])

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
        headers: { 'Content-Type': 'application/json', ...headerAuth() },
        body: JSON.stringify({ ...payload, batteryId: activeId }),
      })
      let body = null
      try { body = await response.json() } catch (e) { /* ignore */ }
      return { requestId, accepted: response.ok, body }
    } catch (e) {
      return { requestId, accepted: false, error: e.message }
    }
  }

  return { data, history, connected, mode, error, lastSeen, sendControl }
}

export default useRealTimeData