'use client'

import { useMemo } from 'react'
import { useRealTimeData } from './useRealTimeData'

export function useBattery() {
  const { data, history, connected, mode, error, lastSeen, sendControl } = useRealTimeData()

  const battery = useMemo(() => {
    const raw = data?.battery || data || {}
    const voltage = raw.voltage != null ? Number(raw.voltage) : 12.6
    const current = raw.current != null ? Number(raw.current) : 0.0
    const power = raw.power != null ? Number(raw.power) : (voltage * Math.abs(current))
    const shuntVoltage = raw.shuntVoltage != null ? Number(raw.shuntVoltage) : 0.025
    const loadVoltage = raw.loadVoltage != null ? Number(raw.loadVoltage) : (voltage + shuntVoltage)
    const soc = raw.soc != null ? Math.max(0, Math.min(100, Math.round(Number(raw.soc)))) : 85
    const soh = raw.soh != null ? Math.max(0, Math.min(100, Math.round(Number(raw.soh)))) : 98
    const bhi = raw.bhi != null ? Math.max(0, Math.min(100, Math.round(Number(raw.bhi)))) : 94
    const resistance = raw.resistance != null ? Number(raw.resistance) : (current !== 0 ? (shuntVoltage / Math.abs(current)) * 1000 : 15.2) // mΩ
    const safety = raw.safety || (voltage > 14.6 || voltage < 10.5 ? 'CRITICAL' : 'SAFE')
    const direction = current > 0.05 ? 'CHARGING' : current < -0.05 ? 'DISCHARGING' : 'IDLE'

    // Estimated cell voltages (assuming 3S pack configuration)
    const cellV = (voltage / 3).toFixed(3)
    const cells = [
      { id: 1, voltage: Number((Number(cellV) + 0.005).toFixed(3)), status: 'balanced' },
      { id: 2, voltage: Number(cellV), status: 'balanced' },
      { id: 3, voltage: Number((Number(cellV) - 0.005).toFixed(3)), status: 'balanced' },
    ]

    return {
      batteryId: raw.batteryId || 'BAT001',
      voltage,
      shuntVoltage,
      loadVoltage,
      current,
      power,
      soc,
      soh,
      bhi,
      resistance,
      safety,
      direction,
      cells,
      timestamp: data?.timestamp || Date.now(),
    }
  }, [data])

  // Extract battery-specific history
  const batteryHistory = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return []
    return history.map((h, i) => {
      const b = h.battery || h
      return {
        idx: i,
        time: h.time || new Date(h.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        voltage: b.voltage != null ? Number(Number(b.voltage).toFixed(2)) : null,
        current: b.current != null ? Number(Number(b.current).toFixed(2)) : null,
        power: b.power != null ? Number(Number(b.power).toFixed(2)) : null,
        soc: b.soc != null ? Math.round(Number(b.soc)) : null,
      }
    })
  }, [history])

  return {
    battery,
    history: batteryHistory,
    connected,
    mode,
    error,
    lastSeen,
    sendControl,
  }
}
