'use client'

import React, { useState } from 'react'
import styles from './ai.module.css'

export default function RootCauseCard({
  rootCause,
  loading = false,
  onAnalyzeWindow,
}) {
  const [selectedFactor, setSelectedFactor] = useState(null)

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI Root-Cause</span>
            <h3 className={styles.cardTitle}>Correlated Event Investigation</h3>
          </div>
        </div>
        <div className={styles.skeleton} style={{ height: 18, width: '100%', marginBottom: 16 }} />
        <div className={styles.skeleton} style={{ height: 80, width: '100%' }} />
      </div>
    )
  }

  const data = rootCause || {
    hypothesisTitle: 'Correlated Current Surge & Thermal Rise',
    hypothesis: 'Telemetry traces suggest that an abrupt 8.2A load surge preceded a 5°C thermal gradient rise over a 4-minute window. No combustible gas was detected.',
    confidencePercent: 78,
    primaryFactor: 'current',
    recommendedAction: 'Inspect external load switching MOSFETs and evaluate cell thermal dissipation path.',
    timelineFactors: [
      { factor: 'current', value: '8.2A', severity: 'WARNING', description: 'Load step surge' },
      { factor: 'current', value: '7.8A', severity: 'WARNING', description: 'Sustained load' },
      { factor: 'temperature', value: '42°C', severity: 'WARNING', description: 'Thermal rise begins' },
      { factor: 'temperature', value: '46°C', severity: 'CRITICAL', description: 'Exceeded 45°C limit' },
      { factor: 'voltage', value: '11.2V', severity: 'CAUTION', description: 'Impedance voltage dip' },
    ],
  }

  const factorColors = {
    voltage: '#FFB800',
    current: '#38BDF8',
    temperature: '#FF2D55',
    gas: '#BF5AF2',
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ Root-Cause Correlation</span>
          <h3 className={styles.cardTitle}>{data.hypothesisTitle}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38BDF8',
              border: '1px solid rgba(56, 189, 248, 0.28)',
              borderRadius: 16,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Hypothesis: {data.confidencePercent}% Confidence
          </span>
        </div>
      </div>

      {/* Horizontal Mini-Timeline Strip */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)', marginBottom: 4 }}>
          <span>Event Window Start (-15m)</span>
          <span>Trip Occurred (0m)</span>
        </div>

        <div className={styles.timelineStrip}>
          {data.timelineFactors.map((tf, i) => {
            const widthPct = Math.max(12, 100 / data.timelineFactors.length)
            const color = factorColors[tf.factor] || '#94A3B8'
            return (
              <div
                key={i}
                className={styles.timelineSegment}
                onClick={() => setSelectedFactor(tf)}
                style={{
                  width: `${widthPct}%`,
                  background: color,
                  cursor: 'pointer',
                  borderRight: '1px solid #0E131C',
                }}
                title={`${tf.factor.toUpperCase()} (${tf.value}): ${tf.description}`}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-secondary, #8B95A5)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: factorColors.current }} /> Current
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: factorColors.temperature }} /> Temperature
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: factorColors.voltage }} /> Voltage
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: factorColors.gas }} /> Gas (MQ)
          </span>
        </div>
      </div>

      {/* Selected Factor Preview */}
      {selectedFactor && (
        <div style={{ background: '#141B28', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '8px 12px', fontSize: 11, marginBottom: 12, color: 'var(--text-primary, #F0F4F8)' }}>
          <strong>Point Detail:</strong> {selectedFactor.factor.toUpperCase()} reached {selectedFactor.value} ({selectedFactor.description})
        </div>
      )}

      {/* Hypothesis Statement Box */}
      <div style={{ background: 'rgba(20, 27, 40, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#38BDF8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
          <span>💡 Physical Hypothesis (Interpretive Only)</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #8B95A5)', lineHeight: 1.5 }}>
          {data.hypothesis}
        </p>
      </div>

      {/* Suggested Action */}
      {data.recommendedAction && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--accent-primary, #00E8A0)' }}>
          <span>🛠️</span>
          <span><strong>Action:</strong> {data.recommendedAction}</span>
        </div>
      )}
    </div>
  )
}
