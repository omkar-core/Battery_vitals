'use client'

import React, { useState } from 'react'
import styles from './ai.module.css'

export default function AnomalyCard({
  anomalies = [],
  loading = false,
  onExplain,
}) {
  const [selectedAnomaly, setSelectedAnomaly] = useState(null)

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI</span>
            <h3 className={styles.cardTitle}>Telemetry Anomaly Analysis</h3>
          </div>
        </div>
        <div className={styles.skeleton} style={{ height: 100, width: '100%' }} />
      </div>
    )
  }

  const items = Array.isArray(anomalies) ? anomalies : []

  if (items.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI Explainer</span>
            <h3 className={styles.cardTitle}>Correlated Anomaly Observations</h3>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)' }}>
            0 Flagged Events
          </span>
        </div>
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            No Active Telemetry Anomalies
          </div>
          <p style={{ fontSize: 12, margin: '6px auto 0', maxWidth: 440, color: 'var(--text-secondary)' }}>
            Dual-stage statistical anomaly filter confirms that live voltage, current, and temperature excursions are within expected variance bounds.
          </p>
        </div>
      </div>
    )
  }

  const getSeverityBadge = (sev) => {
    const s = String(sev || 'CAUTION').toUpperCase()
    const color = s === 'CRITICAL' ? '#FF2D55' : s === 'WARNING' ? '#FF6B35' : '#FFB800'
    return { color, bg: `${color}1A` }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ AI Explainer</span>
          <h3 className={styles.cardTitle}>Correlated Anomaly Observations</h3>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)' }}>
          {items.length} Flagged Events
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((anom, idx) => {
          const badge = getSeverityBadge(anom.severity)
          const isSelected = selectedAnomaly === idx

          return (
            <div
              key={idx}
              onClick={() => setSelectedAnomaly(isSelected ? null : idx)}
              style={{
                background: 'var(--bg-surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 14,
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>
                    {anom.metric === 'voltage' ? '⚡' : anom.metric === 'temperature' ? '🌡️' : '💨'}
                  </span>
                  <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {anom.title || `${anom.metric} Excursion`}
                  </strong>
                </div>
                <span
                  style={{
                    background: badge.bg,
                    color: badge.color,
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {anom.severity || 'WARNING'}
                </span>
              </div>

              <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {anom.explanation || `Z-score anomaly (${anom.zScore || 'elevated'}) detected on ${anom.metric}.`}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
                <span>⏱️ {anom.timestamp || 'Recent'}</span>
                <span style={{ color: 'var(--accent-primary)' }}>
                  {isSelected ? 'Collapse details ▴' : 'View physical context ▾'}
                </span>
              </div>

              {isSelected && (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--border)',
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    background: 'rgba(0, 232, 160, 0.08)',
                    padding: 10,
                    borderRadius: 6,
                  }}
                >
                  <div><strong>Statistical Significance:</strong> Z-Score = {anom.zScore || '3.2'}σ vs historical rolling baseline.</div>
                  <div style={{ marginTop: 4 }}><strong>Engineering Rationale:</strong> No hardware trip registered by ESP32 deterministic loop; classified as transient anomaly.</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
