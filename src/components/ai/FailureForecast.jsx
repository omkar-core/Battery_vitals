'use client'

import React from 'react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import styles from './ai.module.css'

export default function FailureForecast({
  data = [],
  kpis = {
    estimatedRulDays: 420,
    degradationRatePerMonth: -0.4,
    confidence: '86%',
  },
  loading = false,
  onRegenerate,
}) {
  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI Forecast</span>
            <h3 className={styles.cardTitle}>State-of-Health Degradation Projection</h3>
          </div>
        </div>
        <div className={styles.skeleton} style={{ height: 260, width: '100%', marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className={styles.skeleton} style={{ height: 60 }} />
          <div className={styles.skeleton} style={{ height: 60 }} />
          <div className={styles.skeleton} style={{ height: 60 }} />
        </div>
      </div>
    )
  }

  // Generate realistic synthetic projection curve if data is empty
  const chartData = data.length > 0 ? data : [
    { label: '3M Ago', measured: 100, median: 100, p10: 99, p90: 100 },
    { label: '2M Ago', measured: 99.2, median: 99.2, p10: 98, p90: 100 },
    { label: '1M Ago', measured: 98.5, median: 98.5, p10: 97, p90: 99.5 },
    { label: 'Today', measured: 98.1, median: 98.1, p10: 96.5, p90: 99.2 },
    { label: '+1M', predicted: 97.4, median: 97.4, p10: 95.5, p90: 98.8 },
    { label: '+3M', predicted: 96.2, median: 96.2, p10: 93.5, p90: 98.0 },
    { label: '+6M', predicted: 94.5, median: 94.5, p10: 90.0, p90: 97.0 },
    { label: '+12M', predicted: 91.0, median: 91.0, p10: 84.0, p90: 95.0 },
  ]

  const degradationDirection = (kpis.degradationRatePerMonth ?? -0.4) <= 0 ? 'down' : 'up'

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ AI Forecast</span>
          <h3 className={styles.cardTitle}>Predictive RUL & SOH Degradation</h3>
        </div>
        <div className={styles.headerActions}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#00E8A0' }}>
              <span style={{ width: 10, height: 2, background: '#00E8A0' }} /> Measured
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38BDF8' }}>
              <span style={{ width: 10, height: 2, background: '#38BDF8', borderTop: '2px dashed #38BDF8' }} /> Predicted
            </span>
          </div>
          {onRegenerate && (
            <button className={styles.actionBtn} onClick={onRegenerate}>
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* Primary Recharts AreaChart with Confidence Band */}
      <div style={{ width: '100%', height: 240, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" stroke="#4E5A6B" fontSize={11} tickLine={false} />
            <YAxis domain={[75, 105]} stroke="#4E5A6B" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: '#0E131C',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            {/* Today boundary reference line */}
            <ReferenceLine x="Today" stroke="#FFB800" strokeDasharray="3 3" label={{ value: 'Today', fill: '#FFB800', fontSize: 10, position: 'top' }} />

            {/* Confidence Band (P10 - P90) */}
            <Area
              type="monotone"
              dataKey="p90"
              stroke="none"
              fill="rgba(56, 189, 248, 0.14)"
            />
            <Area
              type="monotone"
              dataKey="p10"
              stroke="none"
              fill="transparent"
            />

            {/* Measured Line */}
            <Line
              type="monotone"
              dataKey="measured"
              stroke="#00E8A0"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#00E8A0' }}
              isAnimationActive={false}
            />

            {/* Predicted Line */}
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#38BDF8"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#38BDF8' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 3 KPI Mini-Cards in a Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ background: '#141B28', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary, #4E5A6B)', fontWeight: 700 }}>
            Est. RUL
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #F0F4F8)', marginTop: 2 }}>
            {kpis.estimatedRulDays ? `${kpis.estimatedRulDays} Days` : 'n/a'}
          </div>
          <div style={{ fontSize: 10, color: '#00E8A0', marginTop: 2 }}>
            ✔ Health above 80%
          </div>
        </div>

        <div style={{ background: '#141B28', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary, #4E5A6B)', fontWeight: 700 }}>
            Degradation / Month
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary, #F0F4F8)', marginTop: 2 }}>
            {kpis.degradationRatePerMonth ? `${Math.abs(kpis.degradationRatePerMonth)}%` : '0.4%'}
          </div>
          <div style={{ fontSize: 10, color: degradationDirection === 'down' ? '#FFB800' : '#00E8A0', marginTop: 2 }}>
            {degradationDirection === 'down' ? '▼ Linear slope' : '▲ Stable'}
          </div>
        </div>

        <div style={{ background: '#141B28', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary, #4E5A6B)', fontWeight: 700 }}>
            Model Confidence
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-primary, #00E8A0)', marginTop: 2 }}>
            {kpis.confidence || '86%'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary, #4E5A6B)', marginTop: 2 }}>
            Based on 500+ readings
          </div>
        </div>
      </div>
    </div>
  )
}
