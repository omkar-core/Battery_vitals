'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useFirebase } from './useFirebase'

const POLL_INTERVAL_MS = 4000
const POLL_TIMEOUT_MS = 5000

function createTimeoutSignal(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

// Generate realistic physics-based battery telemetry for Demo/Simulation Mode
function generateSimulatedFrame(stepCount = 0) {
  const now = Date.now()
  const cyclePhase = (stepCount % 30) / 30 // 0 to 1 cycle progress
  
  // Simulated dynamic values
  const currentAmp = stepCount % 20 < 10 ? 2.4 - Math.sin(cyclePhase * Math.PI) * 0.8 : -3.2 + Math.cos(cyclePhase * Math.PI) * 0.5
  const voltage = Number((12.2 + (currentAmp > 0 ? 0.6 : -0.4) + Math.sin(stepCount * 0.3) * 0.15).toFixed(2))
  const power = Number((voltage * currentAmp).toFixed(2))
  const temperature = Number((31.5 + Math.sin(stepCount * 0.1) * 3.5).toFixed(1))
  const humidity = Number((52.0 + Math.cos(stepCount * 0.1) * 4.0).toFixed(1))
  
  const mq2 = Math.floor(320 + Math.random() * 80 + (stepCount % 25 === 0 ? 400 : 0))
  const mq135 = Math.floor(350 + Math.random() * 60)
  
  const soc = Math.min(100, Math.max(10, Math.round(78 + Math.sin(stepCount * 0.05) * 20)))
  const soh = 96
  const resistance = Number((14.2 + Math.random() * 0.8).toFixed(2))
  
  let bhi = 12
  if (temperature > 40) bhi += 30
  if (mq2 > 600) bhi += 40
  if (voltage < 10.5 || voltage > 14.5) bhi += 25
  bhi = Math.min(100, bhi)
  
  const state = bhi >= 75 ? 'CRITICAL' : bhi >= 45 ? 'WARNING' : bhi >= 25 ? 'CAUTION' : 'SAFE'
  const op = currentAmp > 0.1 ? 'CHARGING' : currentAmp < -0.1 ? 'DISCHARGING' : 'IDLE'

  return {
    batteryId: 'BAT001',
    deviceId: 'BV001-SIM',
    voltage,
    current: Number(currentAmp.toFixed(2)),
    power,
    soc,
    soh,
    bhi,
    temperature,
    humidity,
    safety: state,
    opDirection: op,
    resistance,
    profile: '12V-LiFePO4-SIM',
    firmware: 'v12.0-simulated',
    uptimeMs: stepCount * 2500,
    uptime: stepCount * 2,
    ina_ok: true,
    dht_ok: true,
    errors: 0,
    timestamp: now,
    receivedAt: new Date(now).toISOString(),
    ts: now,
    gasIndex: { mq2, mq135, warm: false },
    gas: { index_mq2: mq2, index_mq135: mq135 },
    environment: { temperature, humidity },
    battery: {
      voltage,
      current: Number(currentAmp.toFixed(2)),
      power,
      soc,
      soh,
      safety: state,
      op: op.toLowerCase(),
      resistance,
      cycles: 142,
      energyWh: 88.4,
    },
    risk: { bhi },
    network: { rssi: -58, heap: 245120 },
    outputs: { auto: true, red: state === 'CRITICAL', yellow: state === 'WARNING', green: state === 'SAFE', buzzer: state === 'CRITICAL' },
  }
}

export function useRealTimeData(batteryId = 'BAT001') {
  const { connected: firebaseConnected, data: firebaseData, sendCommand: sendFirebaseCmd } = useFirebase(batteryId)
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState('poll')
  const [error, setError] = useState(null)
  const [simulating, setSimulating] = useState(false)
  const stepRef = useRef(0)

  // Simulation loop trigger
  useEffect(() => {
    if (!simulating) return undefined
    setConnected(true)
    setMode('simulation')
    setError(null)

    const interval = setInterval(() => {
      stepRef.current += 1
      const simFrame = generateSimulatedFrame(stepRef.current)
      setData(simFrame)
      setHistory((h) => [...h, simFrame].slice(-50))
    }, 2500)

    // Initial frame
    const firstFrame = generateSimulatedFrame(stepRef.current)
    setData(firstFrame)
    setHistory((h) => [...h, firstFrame].slice(-50))

    return () => clearInterval(interval)
  }, [simulating])

  // Firebase real-time stream path
  useEffect(() => {
    if (simulating) return
    if (firebaseConnected && firebaseData) {
      setMode('firebase')
      setConnected(true)
      setError(null)
      setHistory((h) => [...h, { time: Date.now(), ...firebaseData }].slice(-50))
      setData((prev) => ({ ...prev, ...firebaseData }))
    }
  }, [firebaseConnected, firebaseData, simulating])

  // HTTP polling fallback (only while Firebase RTDB stream has no data and not simulating)
  useEffect(() => {
    if (simulating || firebaseConnected) return undefined

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
  }, [batteryId, firebaseConnected, simulating])

  const toggleSimulation = useCallback(() => {
    setSimulating((prev) => !prev)
  }, [])

  const sendControl = async (command, value) => {
    const requestId = Math.random().toString(16).slice(2, 10)
    const payload = {
      command,
      value: value !== undefined ? value : command.toLowerCase().includes('on'),
      requestId,
    }
    
    if (simulating) {
      // Simulate command response
      return { requestId, accepted: true, body: { simulation: true } }
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

  return { data, history, connected, mode, error, sendControl, simulating, toggleSimulation }
}

export default useRealTimeData