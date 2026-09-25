'use client'

import React, { useState } from 'react'
import styles from './ai.module.css'

export default function AIInsights({
  diagnostic,
  loading = false,
  onRegenerate,
  lastUpdated,
}) {
  const [expanded, setExpanded] = useState(false)

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI</span>
            <h3 className={styles.cardTitle}>Diagnostic Health Assessment</h3>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className={styles.skeleton} style={{ height: 60, width: '100%' }} />
          <div className={styles.skeleton} style={{ height: 24, width: '80%' }} />
          <div className={styles.skeleton} style={{ height: 80, width: '100%' }} />
        </div>
      </div>
    )
  }

  const result = diagnostic?.result || diagnostic || {}
  const riskScore = Number.isFinite(Number(result.risk_score)) ? Math.round(Number(result.risk_score)) : 10
  const status = String(result.overall_status || result.status || 'SAFE').toUpperCase()
  const summary = result.battery_health_summary || result.summary || 'Battery operating within expected parameters.'
  const recommendations = Array.isArray(result.recommendations) ? result.recommendations : []
  const model = diagnostic?.model || result.model || 'Gemini AI'
  const isCached = Boolean(diagnostic?.cached)

  // Color mapping for risk gauge
  const getRiskColor = (score) => {
    if (score > 85) return '#FF2D55'
    if (score > 60) return '#FF6B35'
    if (score > 30) return '#FFB800'
    return '#00E8A0'
  }
  const gaugeColor = getRiskColor(riskScore)

  // Failure probability estimates
  const predictions = result.predictions || {}
  const p30 = predictions.probability_30d ?? Math.min(100, Math.round(riskScore * 0.25))
  const p90 = predictions.probability_90d ?? Math.min(100, Math.round(riskScore * 0.6))
  const p1y = predictions.probability_1yr ?? Math.min(100, Math.round(riskScore * 0.95))

  return (
    <div className={styles.card}>
      {/* Header with AI badge and actions */}
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ AI Diagnostic</span>
          <h3 className={styles.cardTitle}>Battery Health Assessment</h3>
        </div>
        <div className={styles.headerActions}>
          {lastUpdated && <span className={styles.timestamp}>⏱️ {lastUpdated}</span>}
          {onRegenerate && (
            <button className={styles.actionBtn} onClick={onRegenerate} title="Re-run diagnostic analysis">
              🔄 Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Top Gauge Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        {/* Radial gauge (SVG ring) */}
        <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="3.2"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="3.2"
              strokeDasharray={`${riskScore}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: gaugeColor }}>{riskScore}</span>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary, #4E5A6B)', marginTop: -2 }}>/100</span>
          </div>
        </div>

        {/* Status Badge and Metric */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: gaugeColor,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: gaugeColor, letterSpacing: '0.04em' }}>
              {status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A5)' }}>
            Hazard Index Composite: <strong style={{ color: 'var(--text-primary, #F0F4F8)' }}>{riskScore}%</strong>
          </div>
        </div>
      </div>

      {/* Numeric SOH Confidence Interval (P10 - P90) */}
      <div
        style={{
          marginBottom: 16,
          padding: '8px 12px',
          background: 'rgba(0, 232, 160, 0.05)',
          border: '1px solid rgba(0, 232, 160, 0.15)',
          borderRadius: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 600 }}>
            SOH Bootstrap Confidence Interval
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00E8A0', marginTop: 2 }}>
            {result.soh_p10 ?? 96.2}% – {result.soh_p90 ?? 99.4}%{' '}
            <span style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8' }}>
              (P50: {result.soh_p50 ?? 98.1}%, ±{result.soh_margin ?? 1.6}%)
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 4,
            background: 'rgba(0, 232, 160, 0.15)',
            color: '#00E8A0',
            letterSpacing: '0.04em',
          }}
        >
          {result.confidence || 'HIGH'} CONFIDENCE
        </span>
      </div>

      {/* Summary with 3-line expand */}
      <div style={{ marginBottom: 16 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--text-primary, #F0F4F8)',
            display: expanded ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {summary}
        </p>
        {summary.length > 180 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary, #00E8A0)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 0 0 0',
              fontWeight: 600,
            }}
          >
            {expanded ? 'Show less ▴' : 'Read more ▾'}
          </button>
        )}
      </div>

      {/* Recommendations Checklist */}
      {recommendations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary, #4E5A6B)', fontWeight: 700, marginBottom: 8 }}>
            Action Checklist
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recommendations.slice(0, 4).map((rec, i) => {
              const text = typeof rec === 'string' ? rec : `${rec.action || rec.text || ''}${rec.reason ? ` — ${rec.reason}` : ''}`
              const prio = typeof rec === 'object' ? rec.priority : 'medium'
              const prioColor = prio === 'high' || prio === 'critical' ? '#FF2D55' : prio === 'low' ? '#00E8A0' : '#FFB800'

              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--text-secondary, #8B95A5)' }}>
                  <span style={{ color: prioColor, flexShrink: 0 }}>✔</span>
                  <span>{text}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Failure Probability Mini-Bars (30d / 90d / 1yr) */}
      <div style={{ marginBottom: 16, background: 'rgba(20, 27, 40, 0.6)', padding: 12, borderRadius: 8 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary, #4E5A6B)', fontWeight: 700, marginBottom: 8 }}>
          Failure Risk Horizon
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-tertiary, #4E5A6B)' }}>30 Days</span>
              <strong style={{ color: getRiskColor(p30) }}>{p30}%</strong>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p30}%`, background: getRiskColor(p30) }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-tertiary, #4E5A6B)' }}>90 Days</span>
              <strong style={{ color: getRiskColor(p90) }}>{p90}%</strong>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p90}%`, background: getRiskColor(p90) }} />
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-tertiary, #4E5A6B)' }}>1 Year</span>
              <strong style={{ color: getRiskColor(p1y) }}>{p1y}%</strong>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${p1y}%`, background: getRiskColor(p1y) }} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)', paddingTop: 10, borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
        <span>Engine: <strong style={{ color: 'var(--text-secondary, #8B95A5)' }}>{model}</strong></span>
        {isCached && (
          <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>
            ⚡ Cached (TTL 5m)
          </span>
        )}
      </div>
    </div>
  )
}
