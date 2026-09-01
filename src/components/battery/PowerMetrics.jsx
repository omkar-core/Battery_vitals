'use client'

import React from 'react'
import { Zap, Gauge, Activity, Cpu, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import styles from '../../styles/dashboard.module.css'

export default function PowerMetrics({ battery }) {
  const {
    voltage = 12.6,
    shuntVoltage = 0.025,
    loadVoltage = 12.625,
    current = 0,
    power = 0,
  } = battery || {}

  const isPositive = current >= 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {/* Bus Voltage */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Bus Voltage (INA219)</span>
          <Zap size={16} color="#00E8A0" />
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#00E8A0', letterSpacing: '-0.5px' }}>
          {voltage.toFixed(2)} <span style={{ fontSize: 16, fontWeight: 600 }}>V</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Safe range: 10.5V – 14.6V
        </div>
      </div>

      {/* Current */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Current Flow</span>
          <Activity size={16} color="#38BDF8" />
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#38BDF8', letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
          {current.toFixed(2)} <span style={{ fontSize: 16, fontWeight: 600 }}>A</span>
          {Math.abs(current) > 0.05 && (
            isPositive ? <ArrowUpRight size={20} color="#00E8A0" /> : <ArrowDownRight size={20} color="#FF9500" />
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Max Continuous: ±15.0A
        </div>
      </div>

      {/* Active Power */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Active Power</span>
          <Gauge size={16} color="#FFB800" />
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#FFB800', letterSpacing: '-0.5px' }}>
          {power.toFixed(2)} <span style={{ fontSize: 16, fontWeight: 600 }}>W</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          P = V × I (Instantaneous)
        </div>
      </div>

      {/* Shunt Voltage */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Shunt Drop / Load V</span>
          <Cpu size={16} color="#BF5AF2" />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#BF5AF2', letterSpacing: '-0.5px' }}>
          {(shuntVoltage * 1000).toFixed(1)} <span style={{ fontSize: 14, fontWeight: 600 }}>mV</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Load: {loadVoltage.toFixed(2)} V
        </div>
      </div>
    </div>
  )
}
