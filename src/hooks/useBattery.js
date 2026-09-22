'use client'

import { useMemo } from 'react'
import { useRealTimeData } from './useRealTimeData'

export function useBattery() {
  const { data, history, connected, mode, error, lastSeen, sendControl } = useRealTimeData()

  const battery = useMemo(() => {
    const raw = data?.battery || data || {}
    const numOrNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
    const voltage = numOrNull(raw.voltage)
    const current = numOrNull(raw.current)
    const power = numOrNull(raw.power ?? (voltage != null && current != null ? voltage * current : null))
    const shuntVoltage = numOrNull(raw.shuntVoltage)
    const loadVoltage = numOrNull(raw.loadVoltage ?? (voltage != null && shuntVoltage != null ? voltage + shuntVoltage : null))
    const soc = numOrNull(raw.soc)
    const soh = numOrNull(raw.soh)
    const bhi = numOrNull(raw.bhi)
    const resistance = numOrNull(raw.resistance)
    // Honesty: missing safety channels are UNKNOWN, never assumed SAFE.
    const safety = raw.safety || raw.safetyState || 'UNKNOWN'
    const direction = current == null ? 'UNKNOWN' : current > 0.05 ? 'CHARGING' : current < -0.05 ? 'DISCHARGING' : 'IDLE'

    return {
      batteryId: raw.batteryId || 'BAT001',
      profileId: data?.profileId ?? raw.profileId ?? null,
      profileState: data?.profileState ?? raw.profileState ?? null,
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
      cells: [],
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
