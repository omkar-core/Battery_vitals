'use client'
import { useEffect, useState } from 'react'
import { useMQTT } from './useMQTT'

const POLL_INTERVAL_MS = 3000

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
      setData(mqttData)
      setHistory((prev) => [...prev, { time: Date.now(), ...mqttData }].slice(-50))
    }
  }, [mqttConnected, mqttData])

  // HTTP polling fallback
  useEffect(() => {
    let timer
    async function fetchData() {
      try {
        const resp = await fetch(`/api/telemetry?batteryId=${batteryId}&t=${Date.now()}`, { signal: AbortSignal.timeout(5000) })
        if (!resp.ok) throw new Error('HTTP ' + resp.status)
        const d = await resp.json()
        if (d && d.message !== 'No data yet') {
          setData(d)
          setConnected(true)
          setMode('poll')
          setError(null)
          setHistory((prev) => [...prev, { time: Date.now(), ...d }].slice(-50))
        }
      } catch (e) {
        setConnected(false)
        if (mode !== 'mqtt') setError(e.message)
      }
    }

    // Don't poll if MQTT is actively delivering data
    if (!mqttConnected) {
      fetchData()
      timer = setInterval(fetchData, POLL_INTERVAL_MS)
    }

    return () => clearInterval(timer)
  }, [batteryId, mqttConnected, mode])

  const sendControl = (command) => {
    const payload = { command, value: command.toLowerCase().includes('on') ? true : undefined, requestId: Math.random().toString(16).substr(2, 8) }
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
