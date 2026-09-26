'use client'

import React from 'react'
import styles from '../../styles/dashboard.module.css'

export default function AirQualityIndex({ aqi = null, category = 'Awaiting Data', color = 'var(--text-muted)' }) {
  const clampedAqi = aqi != null ? Math.max(0, Math.min(500, aqi)) : null
  const percentage = clampedAqi != null ? (clampedAqi / 500) * 100 : 0

  const levels = [
    { name: 'Good', range: '0–50', color: '#00E8A0' },
    { name: 'Moderate', range: '51–100', color: '#FFB800' },
    { name: 'Unhealthy for Sensitive', range: '101–150', color: '#FF9500' },
    { name: 'Unhealthy', range: '151–200', color: '#FF2D55' },
    { name: 'Very Unhealthy', range: '201–300', color: '#8F3F97' },
    { name: 'Hazardous', range: '301–500', color: '#7E0023' },
  ]

  return (
    <div className={styles.metricCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌬️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Air Quality Index (AQI)
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Calculated from MQ-135 ppm spectrum</div>
          </div>
        </div>

        <span
          style={{
            background: aqi != null ? `${color}18` : 'var(--bg-surface-raised)',
            color: color,
            border: `1px solid ${aqi != null ? `${color}44` : 'var(--border)'}`,
            padding: '3px 10px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {category}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 36, fontWeight: 900, color: aqi != null ? color : 'var(--text-muted)', letterSpacing: '-1px' }}>
          {clampedAqi != null ? clampedAqi : '--'}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>/ 500 AQI</span>
      </div>

      {/* Multi-segment AQI gradient bar */}
      <div style={{ position: 'relative', width: '100%', height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#00E8A0' }} />
        <div style={{ flex: 1, background: '#FFB800' }} />
        <div style={{ flex: 1, background: '#FF9500' }} />
        <div style={{ flex: 1, background: '#FF2D55' }} />
        <div style={{ flex: 2, background: '#8F3F97' }} />
        <div style={{ flex: 4, background: '#7E0023' }} />

        {/* Current position marker */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${percentage}%`,
            width: 4,
            background: '#FFFFFF',
            boxShadow: '0 0 6px #000',
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Category Reference Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
        {levels.map((lvl) => (
          <div
            key={lvl.name}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              background: category === lvl.name ? `${lvl.color}22` : 'var(--bg-surface-raised)',
              border: category === lvl.name ? `1px solid ${lvl.color}66` : '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 10,
            }}
          >
            <span style={{ color: lvl.color, fontWeight: 700 }}>{lvl.name}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>{lvl.range}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
