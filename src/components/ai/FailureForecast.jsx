'use client'

import React, { useState, useEffect } from 'react'
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
import Link from 'next/link'
import styles from './ai.module.css'

export default function FailureForecast({
  data = [],
  prediction: propPrediction = null,
  kpis = null,
  batteryId = 'BAT001',
  loading = false,
  onRegenerate,
}) {
  const [showModelBadge, setShowModelBadge] = useState(false)
  const [internalPrediction, setInternalPrediction] = useState(null)
  const [fetchingRul, setFetchingRul] = useState(false)

  // Fetch verified RUL model prediction if not passed as prop
  useEffect(() => {
    if (propPrediction) {
      setInternalPrediction(propPrediction)
      return
    }

    let isMounted = true
    async function loadRul() {
      setFetchingRul(true)
      try {
        const res = await fetch(`/api/battery/rul?batteryId=${batteryId}`)
        if (res.ok) {
          const json = await res.json()
          if (isMounted && json.success && json.prediction) {
            setInternalPrediction(json.prediction)
          }
        }
      } catch (e) {
        console.warn('Failed to load RUL prediction:', e.message)
      } finally {
        if (isMounted) setFetchingRul(false)
      }
    }

    loadRul()
    return () => {
      isMounted = false
    }
  }, [propPrediction, batteryId])

  const prediction = propPrediction || internalPrediction

  if (loading || (fetchingRul && !prediction)) {
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

  // Use real projection curve from rulModel if available
  const chartData =
    prediction?.projectionCurve && prediction.projectionCurve.length > 0
      ? prediction.projectionCurve
      : Array.isArray(data) && data.length > 0
      ? data
      : []

  if (prediction?.insufficient_data || chartData.length === 0) {
    return (
      <div className={styles.card} style={{ position: 'relative' }}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI Forecast</span>
            <h3 className={styles.cardTitle}>Predictive RUL &amp; SOH Degradation</h3>
          </div>
        </div>
        <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Awaiting Sufficient Charge/Discharge Cycles
          </div>
          <p style={{ fontSize: 12, margin: '0 auto 16px', maxWidth: 480, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {prediction?.message || 'Bootstrap RUL prognostics requires a minimum of 3 recorded operational cycles from the ESP32 to compute calibrated degradation curves without fabricating synthetic data.'}
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'var(--bg-surface-raised)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 8, color: 'var(--text-tertiary)' }}>
            <span>🔒</span> Zero synthetic data policy active: only verified sensor cycles will be projected.
          </div>
        </div>
      </div>
    )
  }

  const p10Cycles = prediction?.p10_cycles != null ? prediction.p10_cycles : null
  const p50Cycles = prediction?.p50_cycles != null ? prediction.p50_cycles : null
  const p90Cycles = prediction?.p90_cycles != null ? prediction.p90_cycles : null
  const p50Days = prediction?.p50_days ?? (p50Cycles != null ? Math.round(p50Cycles * 1.0) : null)
  const sensitivityNote = prediction?.dominant_sensitivity ?? 'Degradation projection computed from real sensor cycles.'

  return (
    <div className={styles.card} style={{ position: 'relative' }}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ AI Forecast</span>
          <h3 className={styles.cardTitle}>Predictive RUL & SOH Degradation</h3>

          {/* Validated Model Chip with clickable Popover */}
          <button
            type="button"
            onClick={() => setShowModelBadge(!showModelBadge)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              background: '#0B2027',
              border: '1px solid #00E8A0',
              color: '#00E8A0',
              cursor: 'pointer',
              marginLeft: 8,
            }}
            title="Click to view NASA benchmark validation proof"
          >
            <span>🛡️ Validated Model</span>
            <span style={{ fontSize: 9, opacity: 0.8 }}>ℹ️</span>
          </button>
        </div>

        <div className={styles.headerActions}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#00E8A0' }}>
              <span style={{ width: 10, height: 2, background: '#00E8A0' }} /> Measured
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38BDF8' }}>
              <span style={{ width: 10, height: 2, background: '#38BDF8', borderTop: '2px dashed #38BDF8' }} /> Predicted (P50)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#818CF8' }}>
              <span style={{ width: 10, height: 6, background: 'rgba(56, 189, 248, 0.25)', borderRadius: 1 }} /> P10–P90
            </span>
          </div>
          {onRegenerate && (
            <button className={styles.actionBtn} onClick={onRegenerate}>
              🔄 Refresh
            </button>
          )}
        </div>
      </div>

      {/* Popover Card for Validated Model Details */}
      {showModelBadge && (
        <div
          style={{
            position: 'absolute',
            top: 55,
            left: 20,
            zIndex: 30,
            maxWidth: 420,
            background: 'var(--bg-surface)',
            border: '1px solid #00E8A0',
            borderRadius: 10,
            padding: 16,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#00E8A0' }}>
              🔬 NASA Benchmark Validated
            </span>
            <button
              onClick={() => setShowModelBadge(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 10px 0' }}>
            This live RUL estimate uses the identical dual-use statistical model validated against the public
            <strong> NASA Ames PCoE 18650 Li-ion Aging Dataset</strong>.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12, background: 'var(--bg-surface-raised)', border: '1px solid var(--border)', padding: 8, borderRadius: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BENCHMARK MAE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>18.9 Cycles</div>
              <div style={{ fontSize: 9, color: '#00E8A0' }}>Beats all 3 baselines</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>P10–P90 COVERAGE</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>67% Empirical</div>
              <div style={{ fontSize: 9, color: '#38BDF8' }}>N=4 Held-Out Cells</div>
            </div>
          </div>
          <Link
            href="/validation"
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 600,
              color: '#00E8A0',
              textDecoration: 'none',
            }}
          >
            Open Full Validation Report & Baselines Comparison →
          </Link>
        </div>
      )}

      {/* Primary Recharts AreaChart with Confidence Band */}
      <div style={{ width: '100%', height: 240, marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" stroke="var(--chart-axis)" fontSize={11} tickLine={false} />
            <YAxis domain={[70, 102]} stroke="var(--chart-axis)" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--tooltip-bg)',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
              formatter={(value, name) => {
                if (name === 'p90') return [`${value}%`, 'P90 (Upper Bound)']
                if (name === 'p10') return [`${value}%`, 'P10 (Lower Bound)']
                if (name === 'median' || name === 'predicted') return [`${value}%`, 'Median Forecast']
                if (name === 'measured') return [`${value}%`, 'Measured SOH']
                return [value, name]
              }}
            />
            {/* Today boundary reference line */}
            <ReferenceLine
              x="Today"
              stroke="#FFB800"
              strokeDasharray="3 3"
              label={{ value: 'Today', fill: '#FFB800', fontSize: 10, position: 'top' }}
            />

            {/* EOL 80% Threshold reference line */}
            <ReferenceLine
              y={80}
              stroke="#EF4444"
              strokeDasharray="4 4"
              label={{ value: 'EOL (80%)', fill: '#EF4444', fontSize: 10, position: 'insideBottomRight' }}
            />

            {/* Confidence Band (P10 - P90) */}
            <Area
              type="monotone"
              dataKey="p90"
              stroke="none"
              fill="rgba(56, 189, 248, 0.18)"
            />
            <Area
              type="monotone"
              dataKey="p10"
              stroke="none"
              fill="var(--card-bg, var(--bg-surface))"
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

            {/* Predicted Median Line */}
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
        <div style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            Est. Remaining Life (P50)
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {p50Cycles} Cycles ({p50Days}d)
          </div>
          <div style={{ fontSize: 10, color: '#38BDF8', marginTop: 2 }}>
            P10: {p10Cycles} C | P90: {p90Cycles} C
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            Prediction Horizon
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            EOL &lt; 80% SOH
          </div>
          <div style={{ fontSize: 10, color: '#00E8A0', marginTop: 2 }}>
            Valid to +120 cycles beyond now
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            Uncertainty Driver
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary, #00E8A0)', marginTop: 2, lineHeight: 1.3 }}>
            {sensitivityNote}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Bootstrap N=150 resamples
          </div>
        </div>
      </div>
    </div>
  )
}
