'use client'

import React from 'react'
import styles from '../../styles/dashboard.module.css'

export default function GasDetection({ environmental }) {
  const { mq2 = null, mq135 = null, isGasAlert = false } = environmental || {}

  const mq2Color = mq2 == null ? '#64748B' : mq2 > 3000 ? '#FF2D55' : mq2 > 1500 ? '#FFB800' : '#00E8A0'
  const mq135Color = mq135 == null ? '#64748B' : mq135 > 500 ? '#FF2D55' : mq135 > 300 ? '#FFB800' : '#00E8A0'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
      {/* MQ-2 LPG & Smoke Sensor */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${mq2Color}18`, padding: 6, borderRadius: 8 }}>
              <span style={{ fontSize: 18 }}>💨</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>MQ-2 Gas / Smoke</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>LPG &amp; Combustibles (GPIO34)</div>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: mq2Color,
              background: `${mq2Color}18`,
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {mq2 == null ? 'NO DATA' : mq2 > 3000 ? 'CRITICAL' : mq2 > 1500 ? 'WARNING' : 'CLEAN'}
          </span>
        </div>

        <div style={{ fontSize: 30, fontWeight: 900, color: mq2Color, letterSpacing: '-0.5px' }}>
          {mq2 != null ? Math.round(mq2) : '--'} <span style={{ fontSize: 16, fontWeight: 600 }}>ppm</span>
        </div>

        {/* Visual Progress Bar */}
        <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
          <div
            style={{
              width: mq2 != null ? `${Math.min(100, (mq2 / 4000) * 100)}%` : '0%',
              height: '100%',
              background: mq2Color,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>Baseline: ~300 ppm</span>
          <span>Crit limit: 3000 ppm</span>
        </div>
      </div>

      {/* MQ-135 Air Quality Sensor */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${mq135Color}18`, padding: 6, borderRadius: 8 }}>
              <span style={{ fontSize: 18 }}>🌫️</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>MQ-135 Air Quality</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>CO₂ &amp; VOC Vapors (GPIO35)</div>
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: mq135Color,
              background: `${mq135Color}18`,
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {mq135 == null ? 'NO DATA' : mq135 > 500 ? 'CRITICAL' : mq135 > 300 ? 'WARNING' : 'GOOD'}
          </span>
        </div>

        <div style={{ fontSize: 30, fontWeight: 900, color: mq135Color, letterSpacing: '-0.5px' }}>
          {mq135 != null ? Math.round(mq135) : '--'} <span style={{ fontSize: 16, fontWeight: 600 }}>ppm</span>
        </div>

        <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
          <div
            style={{
              width: mq135 != null ? `${Math.min(100, (mq135 / 800) * 100)}%` : '0%',
              height: '100%',
              background: mq135Color,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>Clean air: ~100 ppm</span>
          <span>Crit limit: 500 ppm</span>
        </div>
      </div>
    </div>
  )
}
