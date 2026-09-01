'use client'

import React from 'react'
import { ShieldAlert, ShieldCheck, Wind, AlertTriangle } from 'lucide-react'
import styles from '../../styles/dashboard.module.css'

export default function GasDetection({ environmental }) {
  const { mq2 = 340, mq135 = 115, isGasAlert = false } = environmental || {}

  const mq2Color = mq2 > 800 ? '#FF2D55' : mq2 > 500 ? '#FFB800' : '#00E8A0'
  const mq135Color = mq135 > 500 ? '#FF2D55' : mq135 > 250 ? '#FFB800' : '#00E8A0'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
      {/* MQ-2 LPG & Smoke Sensor */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${mq2Color}18`, padding: 6, borderRadius: 8 }}>
              <Wind size={18} color={mq2Color} />
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
            {mq2 > 800 ? 'LEAK ALERT' : mq2 > 500 ? 'ELEVATED' : 'CLEAN'}
          </span>
        </div>

        <div style={{ fontSize: 30, fontWeight: 900, color: mq2Color, letterSpacing: '-0.5px' }}>
          {Math.round(mq2)} <span style={{ fontSize: 16, fontWeight: 600 }}>ppm</span>
        </div>

        {/* Visual Progress Bar */}
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, (mq2 / 1200) * 100)}%`,
              height: '100%',
              background: mq2Color,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>Baseline: ~300 ppm</span>
          <span>Crit limit: 800 ppm</span>
        </div>
      </div>

      {/* MQ-135 Air Quality Sensor */}
      <div className={styles.metricCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: `${mq135Color}18`, padding: 6, borderRadius: 8 }}>
              <AlertTriangle size={18} color={mq135Color} />
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
            {mq135 > 500 ? 'POOR' : mq135 > 250 ? 'MODERATE' : 'GOOD'}
          </span>
        </div>

        <div style={{ fontSize: 30, fontWeight: 900, color: mq135Color, letterSpacing: '-0.5px' }}>
          {Math.round(mq135)} <span style={{ fontSize: 16, fontWeight: 600 }}>ppm</span>
        </div>

        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, (mq135 / 800) * 100)}%`,
              height: '100%',
              background: mq135Color,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
          <span>Clean air: ~100 ppm</span>
          <span>Threshold: 500 ppm</span>
        </div>
      </div>
    </div>
  )
}
