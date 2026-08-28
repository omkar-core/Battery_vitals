'use client'
import { useEffect, useRef, useState } from 'react'
import { useMQTT } from './useMQTT'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5000

function createTimeoutSignal(ms) {
  // AbortSignal.timeout is not available in every browser; emulate it.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

// Real-time data hook: uses MQTT when available, falls back to HTTP polling.
export function useRealTimeData(batteryId = 'BAT001') {
  const { connected: mqttConnected, data: mqttData, publish, error: mqttError } = useMQTT()
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState('poll')
  const [error, setError] = useState(null)

  // MQTT path
  useEffect(() => {
    if (mqttConnected && mqttData) {
      setMode('mqtt')
      setConnected(true)
      setError(null)
      setHistory((h) => [...h, { time: Date.now(), ...mqttData }].slice(-50))
      // setData inside updater avoids stale-closure warnings
      setData((prev) => ({ ...prev, ...mqttData }))
    }
  }, [mqttConnected, mqttData])

  // HTTP polling fallback (only while MQTT is not delivering data)
  useEffect(() => {
    if (mqttConnected) return undefined

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
          setMode((m) => (m === 'mqtt' ? m : 'poll'))
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
  }, [batteryId, mqttConnected])

  const sendControl = (command, value) => {
    const payload = {
      command,
      value: value !== undefined ? value : command.toLowerCase().includes('on'),
      requestId: Math.random().toString(16).slice(2, 10),
    }
    if (mqttConnected) {
      publish(`batteryvitals/${batteryId}/control`, payload)
    }
    return fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  return { data, history, connected, mode, error, mqttConnected, sendControl }
}