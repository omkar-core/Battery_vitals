'use client'

import React from 'react'
import styles from '../../styles/dashboard.module.css'

export default function SensorGrid({ telemetry }) {
  const t = telemetry || {}
  const b = t.battery || t
  const env = t.environmental || t

  const hasVoltage = b.voltage != null && Number.isFinite(Number(b.voltage)) && Number(b.voltage) > 0
  const hasCurrent = b.current != null && Number.isFinite(Number(b.current))
  const hasTemp = env.temperature != null && Number.isFinite(Number(env.temperature))
  const hasHum = env.humidity != null && Number.isFinite(Number(env.humidity))
  const mq2Val = env.mq2 != null ? Number(env.mq2) : (env.gasIndex?.mq2 != null ? Number(env.gasIndex.mq2) : null)
  const mq135Val = env.mq135 != null ? Number(env.mq135) : (env.gasIndex?.mq135 != null ? Number(env.gasIndex.mq135) : null)

  const sensors = [
    {
      id: 'ina219_v',
      name: 'Bus Voltage',
      sensor: 'INA219 (I2C 0x40)',
      value: hasVoltage ? `${Number(b.voltage).toFixed(2)} V` : '--',
      status: !hasVoltage ? 'OFFLINE' : b.voltage > 14.4 || b.voltage < 10.0 ? 'CRITICAL' : b.voltage > 14.2 || b.voltage < 10.5 ? 'WARNING' : 'NOMINAL',
      color: '#00E8A0',
      icon: '⚡',
    },
    {
      id: 'ina219_i',
      name: 'Current',
      sensor: 'INA219 (I2C 0x40)',
      value: hasCurrent ? `${Number(b.current).toFixed(2)} A` : '--',
      status: !hasCurrent ? 'OFFLINE' : Math.abs(b.current) >= 30 ? 'CRITICAL' : Math.abs(b.current) >= 15 ? 'WARNING' : 'NOMINAL',
      color: '#38BDF8',
      icon: '🔌',
    },
    {
      id: 'dht11_temp',
      name: 'Temperature',
      sensor: 'DHT11 (GPIO4)',
      value: hasTemp ? `${Number(env.temperature).toFixed(1)} °C` : '--',
      status: !hasTemp ? 'OFFLINE' : env.temperature > 55 ? 'EMERGENCY' : env.temperature > 45 ? 'CRITICAL' : env.temperature > 40 ? 'WARNING' : 'NOMINAL',
      color: '#FF9500',
      icon: '🌡️',
    },
    {
      id: 'dht11_hum',
      name: 'Humidity',
      sensor: 'DHT11 (GPIO4)',
      value: hasHum ? `${Number(env.humidity).toFixed(1)} %RH` : '--',
      status: !hasHum ? 'OFFLINE' : env.humidity > 80 ? 'WARNING' : 'NOMINAL',
      color: '#00E8A0',
      icon: '💧',
    },
    {
      id: 'mq2_gas',
      name: 'LPG / Smoke',
      sensor: 'MQ-2 (GPIO34)',
      value: mq2Val != null ? `${Math.round(mq2Val)} ppm` : '--',
      status: mq2Val == null ? 'OFFLINE' : mq2Val > 3000 ? 'CRITICAL' : mq2Val > 1500 ? 'WARNING' : 'NOMINAL',
      color: '#FF2D55',
      icon: '💨',
    },
    {
      id: 'mq135_co2',
      name: 'Air Quality / CO₂',
      sensor: 'MQ-135 (GPIO35)',
      value: mq135Val != null ? `${Math.round(mq135Val)} ppm` : '--',
      status: mq135Val == null ? 'OFFLINE' : mq135Val > 500 ? 'CRITICAL' : mq135Val > 300 ? 'WARNING' : 'NOMINAL',
      color: '#BF5AF2',
      icon: '🌫️',
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
      {sensors.map((s) => {
        const isCrit = s.status === 'CRITICAL' || s.status === 'EMERGENCY'
        const isWarn = s.status === 'WARNING'
        const isOffline = s.status === 'OFFLINE'
        const badgeColor = isCrit ? '#FF2D55' : isWarn ? '#FFB800' : isOffline ? '#94A3B8' : '#00E8A0'

        return (
          <div
            key={s.id}
            className={styles.metricCard}
            style={{
              border: isCrit ? '1px solid rgba(255,45,85,0.4)' : undefined,
              background: isCrit ? 'rgba(255,45,85,0.06)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: `${s.color}18`, padding: 6, borderRadius: 8 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.sensor}</div>
                </div>
              </div>

              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: badgeColor,
                  background: `${badgeColor}18`,
                  padding: '2px 6px',
                  borderRadius: 10,
                }}
              >
                {s.status}
              </span>
            </div>

            <div style={{ fontSize: 24, fontWeight: 800, color: isOffline ? 'var(--text-muted)' : 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {s.value}
            </div>
          </div>
        )
      })}
    </div>
  )
}
