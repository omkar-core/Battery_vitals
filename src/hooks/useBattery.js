'use client'

import { useMemo } from 'react'
import { useRealTimeData } from './useRealTimeData'

export function useBattery() {
  const { data, history, connected, mode, error, lastSeen, isDisconnected, sendControl } = useRealTimeData()

  const battery = useMemo(() => {
    const raw = data?.battery || data || {}
    const numOrNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
    
    if (isDisconnected || !data) {
      return {
        batteryId: raw.batteryId || 'BAT001',
        profileId: data?.profileId ?? raw.profileId ?? null,
        profileState: 'DISCONNECTED',
        inferredBattery: null,
        remainingRuntime: null,
        resistanceMeasurable: false,
        socMethod: null,
        voltage: 0,
        shuntVoltage: 0,
        loadVoltage: 0,
        current: 0,
        power: 0,
        soc: 0,
        soh: null,
        bhi: null,
        resistance: null,
        safety: 'DISCONNECTED',
        direction: 'DISCONNECTED',
        cells: [],
        timestamp: Date.now(),
      }
    }

    const voltage = numOrNull(raw.voltage) ?? 0
    const current = numOrNull(raw.current) ?? 0
    const power = numOrNull(raw.power ?? (voltage != null && current != null ? voltage * current : null)) ?? 0
    const shuntVoltage = numOrNull(raw.shuntVoltage) ?? 0
    const loadVoltage = numOrNull(raw.loadVoltage ?? (voltage != null && shuntVoltage != null ? voltage + shuntVoltage : null)) ?? 0
    const soc = numOrNull(raw.soc) ?? 0
    const soh = numOrNull(raw.soh)
    const bhi = numOrNull(raw.bhi)
    const resistance = numOrNull(raw.resistance)
    const safety = raw.safety || raw.safetyState || 'UNKNOWN'
    const direction = current == null ? 'UNKNOWN' : current > 0.05 ? 'CHARGING' : current < -0.05 ? 'DISCHARGING' : 'IDLE'

    return {
      batteryId: raw.batteryId || 'BAT001',
      profileId: data?.profileId ?? raw.profileId ?? null,
      profileState: data?.profileState ?? raw.profileState ?? null,
      inferredBattery: data?.inferredBattery ?? raw.inferredBattery ?? null,
      remainingRuntime: data?.remainingRuntime ?? raw.remainingRuntime ?? null,
      resistanceMeasurable: data?.resistanceMeasurable ?? raw.resistanceMeasurable ?? false,
      socMethod: data?.socMethod ?? raw.socMethod ?? null,
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
  }, [data, isDisconnected])

  // Extract battery-specific history
  const batteryHistory = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return []
    return history.map((h, i) => {
      const b = h.battery || h
      return {
        idx: i,
        time: h.time || new Date(h.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        voltage: b.voltage != null ? Number(Number(b.voltage).toFixed(2)) : null,
        current: b.current != null ? Number(Number(b.current).toFixed(4)) : null,
        power: b.power != null ? Number(Number(b.power).toFixed(3)) : null,
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
