'use client'

import React from 'react'
import { Flame, Droplets, Sun, Wind } from 'lucide-react'
import styles from '../../styles/dashboard.module.css'

export default function TempHumidity({ environmental }) {
  const {
    temperature = 25.4,
    humidity = 58.0,
    heatIndex = 26.1,
    dewPoint = 16.2,
  } = environmental || {}

  const tempColor = temperature > 45 ? '#FF2D55' : temperature > 38 ? '#FFB800' : '#00E8A0'
  const humColor = humidity > 80 ? '#FFB800' : '#38BDF8'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
      {/* Temperature */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${tempColor}18`, padding: 6, borderRadius: 8 }}>
              <Flame size={18} color={tempColor} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Temperature</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>DHT11 Sensor (GPIO4)</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: tempColor }}>
            {temperature > 40 ? 'ELEVATED' : 'NOMINAL'}
          </span>
        </div>

        <div style={{ fontSize: 32, fontWeight: 900, color: tempColor, letterSpacing: '-0.5px' }}>
          {temperature.toFixed(1)} <span style={{ fontSize: 18, fontWeight: 600 }}>°C</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
          <span>Heat Index: {heatIndex}°C</span>
          <span>Max safe: 45.0°C</span>
        </div>
      </div>

      {/* Relative Humidity */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${humColor}18`, padding: 6, borderRadius: 8 }}>
              <Droplets size={18} color={humColor} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Humidity</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Relative Moisture</div>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: humColor }}>
            {humidity > 75 ? 'HIGH' : 'COMFORT'}
          </span>
        </div>

        <div style={{ fontSize: 32, fontWeight: 900, color: humColor, letterSpacing: '-0.5px' }}>
          {humidity.toFixed(1)} <span style={{ fontSize: 18, fontWeight: 600 }}>%RH</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
          <span>Dew Point: {dewPoint}°C</span>
          <span>Target: 30–65%</span>
        </div>
      </div>
    </div>
  )
}
