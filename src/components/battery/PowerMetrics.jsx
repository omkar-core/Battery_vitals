'use client'

import React from 'react'
import styles from '../../styles/dashboard.module.css'

export default function PowerMetrics({ battery }) {
  const raw = battery || {}
  // Display-only fallbacks; safety truth lives in the engine (UNKNOWN, never SAFE).
  const num = (v, fb) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? fb : Number(v))
  const voltage = num(raw.voltage, null)
  const shuntVoltage = num(raw.shuntVoltage, null)
  const loadVoltage = num(raw.loadVoltage, null)
  const current = num(raw.current, null)
  const power = num(raw.power, null)

  const isPositive = current >= 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {/* Bus Voltage */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Bus Voltage (INA219)</span>
          <span style={{ fontSize: 16 }}>⚡</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#00E8A0', letterSpacing: '-0.5px' }}>
          {voltage != null ? voltage.toFixed(2) : '--'} <span style={{ fontSize: 16, fontWeight: 600 }}>V</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Safe band: active profile
        </div>
      </div>

      {/* Current */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Current Flow</span>
          <span style={{ fontSize: 16 }}>🔌</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#38BDF8', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
          {current != null ? current.toFixed(2) : '--'} <span style={{ fontSize: 16, fontWeight: 600 }}>A</span>
          {current != null && Math.abs(current) > 0.05 && (
            isPositive ? <span style={{ fontSize: 18 }}>↗️</span> : <span style={{ fontSize: 18 }}>↘️</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Limits: active profile
        </div>
      </div>

      {/* Active Power */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Active Power</span>
          <span style={{ fontSize: 16 }}>⚡</span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#FFB800', letterSpacing: '-0.5px' }}>
          {power != null ? power.toFixed(2) : '--'} <span style={{ fontSize: 16, fontWeight: 600 }}>W</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          P = V × I (Instantaneous)
        </div>
      </div>

      {/* Shunt Voltage */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Shunt Drop / Load V</span>
          <span style={{ fontSize: 16 }}>🎛️</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#BF5AF2', letterSpacing: '-0.5px' }}>
          {shuntVoltage != null ? (shuntVoltage * 1000).toFixed(1) : '--'} <span style={{ fontSize: 14, fontWeight: 600 }}>mV</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Load: {loadVoltage != null ? loadVoltage.toFixed(2) : '--'} V
        </div>
      </div>
    </div>
  )
}
