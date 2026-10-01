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

  // 1. Initial load of historical readings from MongoDB on device switch or mount
  useEffect(() => {
    if (noDevice || !activeId) {
      setData(null)
      setHistory([])
      setConnected(false)
      return
    }

    let active = true
    async function loadInitialHistory() {
      try {
        const resp = await fetch(`/api/history?batteryId=${encodeURIComponent(activeId)}&limit=50&t=${Date.now()}`)
        if (resp.ok) {
          const json = await resp.json()
          if (active && json.data && Array.isArray(json.data) && json.data.length > 0) {
            setHistory(json.data)
            // If data is null, set the most recent historical packet
            setData((prev) => prev || json.data[json.data.length - 1])
          } else if (active) {
            setHistory([])
          }
        }
      } catch (err) {
        // Silently continue to live polling
      }
    }

    loadInitialHistory()

    return () => {
      active = false
    }
  }, [activeId, noDevice])

  // Latest telemetry capture time as an epoch-ms value (or null before first packet),
  // so pages can feed the header connection badge a real timestamp.
  const lastSeen = useMemo(() => {
    if (noDevice) return null
    const ts = data?.timestamp ?? data?.receivedAt ?? data?.ts
    return ts != null ? Number(ts) : null
  }, [data, noDevice])

  // Helper to append a reading to history without duplicating timestamps
  const appendHistory = useCallback((newReading) => {
    if (!newReading) return
    if (newReading.isMock || newReading.mock || newReading.synthetic || newReading.deviceId === 'ESP32_TEST') return
    const readTs = newReading.timestamp || newReading.ts || newReading.time || Date.now()
    const timeMs = typeof readTs === 'number' ? readTs : new Date(readTs).getTime()

    setHistory((prev) => {
      // Check if last element has identical timestamp (within 500ms)
      const last = prev[prev.length - 1]
      const lastTs = last ? (last.timestamp || last.ts || last.time || 0) : 0
      const lastTimeMs = typeof lastTs === 'number' ? lastTs : new Date(lastTs).getTime()
      if (Math.abs(timeMs - lastTimeMs) < 500) {
        // Update in-place
        const updated = [...prev]
        updated[updated.length - 1] = { ...last, ...newReading, time: timeMs, timestamp: timeMs }
        return updated.slice(-50)
      }
      return [...prev, { time: timeMs, timestamp: timeMs, ...newReading }].slice(-50)
    })
  }, [])

  // Firebase real-time stream path
  useEffect(() => {
    if (noDevice) return
    if (firebaseConnected && firebaseData) {
      setMode('firebase')
      setConnected(true)
      setError(null)
      appendHistory(firebaseData)
      setData((prev) => ({ ...prev, ...firebaseData }))
    }
  }, [firebaseConnected, firebaseData, noDevice, appendHistory])

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
          setData((prev) => ({ ...prev, ...d }))
          setConnected(true)
          setError(null)
          setMode((m) => (m === 'firebase' ? m : 'poll'))
          appendHistory(d)
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
  }, [activeId, firebaseConnected, noDevice, appendHistory])

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

  const isDisconnected = noDevice || !connected || (lastSeen && (Date.now() - lastSeen) > 30000)

  return {
    data: noDevice ? null : data,
    history: noDevice ? [] : history,
    connected: noDevice ? false : connected,
    mode: noDevice ? 'idle' : mode,
    error: noDevice ? 'No battery device selected. Use the device switcher to select a device.' : error,
    lastSeen,
    isDisconnected,
    sendControl,
  }
}

export default useRealTimeData