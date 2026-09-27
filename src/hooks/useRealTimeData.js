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
  const resolvedId = resolveBatteryId(batteryId)
  const [activeId, setActiveId] = useState(() => resolvedId)
  const [noDevice, setNoDevice] = useState(!resolvedId)

  useEffect(() => {
    const newId = resolveBatteryId(batteryId)
    setActiveId(newId)
    setNoDevice(!newId)
  }, [batteryId])

  // Always call useFirebase - pass a placeholder when no device to satisfy React Hooks rules
  const firebaseArg = activeId || 'placeholder-no-device'
  const { connected: firebaseConnected, data: firebaseData, sendCommand: sendFirebaseCmd } = useFirebase(firebaseArg)
  
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState('poll')
  const [error, setError] = useState(null)

  // Latest telemetry capture time as an epoch-ms value (or null before first packet),
  // so pages can feed the header connection badge a real timestamp.
  const lastSeen = useMemo(() => {
    if (noDevice) return null
    const ts = data?.timestamp ?? data?.receivedAt ?? data?.ts
    return ts != null ? Number(ts) : null
  }, [data, noDevice])

  // Firebase real-time stream path
  useEffect(() => {
    if (noDevice) return
    if (firebaseConnected && firebaseData) {
      setMode('firebase')
      setConnected(true)
      setError(null)
      setHistory((h) => [...h, { time: Date.now(), ...firebaseData }].slice(-50))
      setData((prev) => ({ ...prev, ...firebaseData }))
    }
  }, [firebaseConnected, firebaseData, noDevice])

  // Drop stale readings when the operator switches fleet units.
  useEffect(() => {
    if (noDevice) return
    setData(null)
    setHistory([])
    setMode('poll')
    setConnected(false)
  }, [activeId, noDevice])

  // HTTP polling fallback (only while Firebase RTDB stream has no data)
  useEffect(() => {
    if (noDevice || firebaseConnected) return undefined

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
  }, [activeId, firebaseConnected, noDevice])

  const sendControl = async (command, value) => {
    if (noDevice) {
      return { accepted: false, error: 'No battery device selected' }
    }
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

  return {
    data: noDevice ? null : data,
    history: noDevice ? [] : history,
    connected: noDevice ? false : connected,
    mode: noDevice ? 'idle' : mode,
    error: noDevice ? 'No battery device selected. Use the device switcher to select a device.' : error,
    lastSeen,
    sendControl,
  }
}

export default useRealTimeData