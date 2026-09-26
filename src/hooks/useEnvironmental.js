'use client'

import { useMemo } from 'react'
import { useRealTimeData } from './useRealTimeData'

export function useEnvironmental() {
  const { data, history, connected, mode, error, lastSeen } = useRealTimeData()

  const environmental = useMemo(() => {
    const raw = data?.environmental || data || {}
    const temperature = raw.temperature != null ? Number(raw.temperature) : null
    const humidity = raw.humidity != null ? Number(raw.humidity) : null
    const mq2 = raw.mq2 != null ? Number(raw.mq2) : (raw.gasIndex?.mq2 != null ? Number(raw.gasIndex.mq2) : null)
    const mq135 = raw.mq135 != null ? Number(raw.mq135) : (raw.gasIndex?.mq135 != null ? Number(raw.gasIndex.mq135) : null)
    
    // Calculate AQI (0-500 scale) if MQ-135 reading is available
    let aqi = null
    let aqiCategory = 'Awaiting Data'
    let aqiColor = 'var(--text-muted)'

    if (raw.aqi != null) {
      aqi = Math.max(0, Math.min(500, Number(raw.aqi)))
    } else if (mq135 != null) {
      aqi = Math.max(0, Math.min(500, Math.round(mq135 * 0.45)))
    }

    if (aqi != null) {
      if (aqi > 300) {
        aqiCategory = 'Hazardous'
        aqiColor = '#7E0023'
      } else if (aqi > 200) {
        aqiCategory = 'Very Unhealthy'
        aqiColor = '#8F3F97'
      } else if (aqi > 150) {
        aqiCategory = 'Unhealthy'
        aqiColor = '#FF2D55'
      } else if (aqi > 100) {
        aqiCategory = 'Unhealthy for Sensitive Groups'
        aqiColor = '#FF9500'
      } else if (aqi > 50) {
        aqiCategory = 'Moderate'
        aqiColor = '#FFB800'
      } else {
        aqiCategory = 'Good'
        aqiColor = '#00E8A0'
      }
    }

    // Heat Index approximation & Dew Point (only if real temp and humidity are present)
    let heatIndex = null
    let dewPoint = null

    if (temperature != null && humidity != null && humidity > 0) {
      const calcHi = Number((temperature + 0.5555 * ((humidity / 100) * 6.11 * Math.exp(5417.7530 * (1/273.16 - 1/(273.15 + temperature))) - 10)).toFixed(1))
      heatIndex = isNaN(calcHi) ? temperature : calcHi
      
      const a = 17.27
      const b = 237.7
      const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100)
      const calcDp = Number(((b * alpha) / (a - alpha)).toFixed(1))
      dewPoint = isNaN(calcDp) ? null : calcDp
    }

    // Hazard Status
    const isGasAlert = mq2 != null ? mq2 > 800 : false
    const isTempAlert = temperature != null ? temperature > 45.0 : false
    const isHumidityAlert = humidity != null ? humidity > 80.0 : false

    return {
      temperature,
      humidity,
      heatIndex,
      dewPoint,
      mq2,
      mq135,
      aqi,
      aqiCategory,
      aqiColor,
      isGasAlert,
      isTempAlert,
      isHumidityAlert,
      timestamp: data?.timestamp || Date.now(),
    }
  }, [data])

  // Extract environmental history
  const envHistory = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return []
    return history.map((h, i) => {
      const e = h.environmental || h
      return {
        idx: i,
        time: h.time || new Date(h.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        temperature: e.temperature != null ? Number(Number(e.temperature).toFixed(1)) : null,
        humidity: e.humidity != null ? Number(Number(e.humidity).toFixed(1)) : null,
        mq2: e.mq2 != null ? Math.round(Number(e.mq2)) : null,
        mq135: e.mq135 != null ? Math.round(Number(e.mq135)) : null,
      }
    })
  }, [history])

  return {
    environmental,
    history: envHistory,
    connected,
    mode,
    error,
    lastSeen,
  }
}
