'use client'

import React from 'react'
import { Sparkles, Calendar, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function Predictions({ prediction = {} }) {
  const {
    battery_health = 92,
    estimated_lifespan = '22 months',
    next_maintenance = '2024-06-15',
    failure_probability = { '30_days': 2.4, '90_days': 8.1, '1_year': 24.5 },
  } = prediction

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
      {/* Estimated Lifespan & Next Maintenance */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="#38BDF8" />
            <h3 className={styles.cardTitle}>Predictive Maintenance Schedule</h3>
          </div>
          <span style={{ fontSize: 11, color: '#38BDF8', fontWeight: 700 }}>Gemini ML Model</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ background: 'var(--bg-surface-raised)', padding: 14, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Remaining Usable Life</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#00E8A0', marginTop: 4 }}>
              {estimated_lifespan}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Target: 80% SOH EOL</div>
          </div>

          <div style={{ background: 'var(--bg-surface-raised)', padding: 14, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Next Recommended Check</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#38BDF8', marginTop: 6 }}>
              {next_maintenance}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Terminal &amp; cell inspection</div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          Based on historical current draw cycles and ambient thermal profile.
        </p>
      </div>

      {/* Failure Probability Forecast */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingDown size={18} color="#FFB800" />
            <h3 className={styles.cardTitle}>Failure Probability Forecast</h3>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 30 Days */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>30-Day Risk Horizon</span>
              <span style={{ color: '#00E8A0', fontWeight: 700 }}>{failure_probability['30_days'] || 2.4}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <div style={{ width: `${failure_probability['30_days'] || 2.4}%`, height: '100%', background: '#00E8A0', borderRadius: 3 }} />
            </div>
          </div>

          {/* 90 Days */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>90-Day Risk Horizon</span>
              <span style={{ color: '#FFB800', fontWeight: 700 }}>{failure_probability['90_days'] || 8.1}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <div style={{ width: `${failure_probability['90_days'] || 8.1}%`, height: '100%', background: '#FFB800', borderRadius: 3 }} />
            </div>
          </div>

          {/* 1 Year */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>1-Year Risk Horizon</span>
              <span style={{ color: '#38BDF8', fontWeight: 700 }}>{failure_probability['1_year'] || 24.5}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
              <div style={{ width: `${failure_probability['1_year'] || 24.5}%`, height: '100%', background: '#38BDF8', borderRadius: 3 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
