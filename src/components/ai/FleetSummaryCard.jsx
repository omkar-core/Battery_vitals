'use client'

import React, { useState } from 'react'
import styles from './ai.module.css'

export default function FleetSummaryCard({
  fleetData,
  loading = false,
  onSelectPack,
}) {
  const [activePack, setActivePack] = useState(null)

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ Fleet AI</span>
            <h3 className={styles.cardTitle}>Cross-Fleet Battery Telemetry Heatmap</h3>
          </div>
        </div>
        <div className={styles.skeleton} style={{ height: 60, width: '100%', marginBottom: 16 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
            <div key={k} className={styles.skeleton} style={{ height: 70 }} />
          ))}
        </div>
      </div>
    )
  }

  const data = fleetData || {
    totalPacks: 1,
    safeCount: 1,
    warningCount: 0,
    criticalCount: 0,
    fleetHeadline: 'Active Hardware Node Online (BAT001)',
    fleetNarrative: 'Hardware monitoring node BAT001 is active and transmitting real telemetry over Firebase Realtime Database and MongoDB.',
    topPriorityActions: [
      'Maintain continuous telemetry ingestion on node BAT001.',
      'Review threshold profiles against cell chemistry specifications.',
    ],
    packs: [
      { deviceId: 'BAT001', name: 'Primary Node (BAT001)', state: 'SAFE', soh: null, voltage: null, temperature: null },
    ],
  }

  const getStateColor = (state) => {
    const s = String(state || 'SAFE').toUpperCase()
    if (s === 'CRITICAL' || s === 'EMERGENCY') return '#FF2D55'
    if (s === 'WARNING') return '#FF6B35'
    if (s === 'CAUTION') return '#FFB800'
    return '#00E8A0'
  }

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ Fleet AI</span>
          <h3 className={styles.cardTitle}>Cross-Fleet Health Heatmap</h3>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <span style={{ color: '#00E8A0' }}>● {data.safeCount} Safe</span>
          <span style={{ color: '#FFB800' }}>● {data.warningCount} Warning</span>
          <span style={{ color: '#FF2D55' }}>● {data.criticalCount} Critical</span>
        </div>
      </div>

      {/* AI Narrative Banner Above Grid */}
      <div
        style={{
          background: 'var(--bg-surface-raised)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid var(--accent-primary)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {data.fleetHeadline}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {data.fleetNarrative}
        </div>
      </div>

      {/* Heatmap Grid of Pack Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
        {data.packs.map((p) => {
          const color = getStateColor(p.state)
          const isSelected = activePack?.deviceId === p.deviceId

          return (
            <div
              key={p.deviceId}
              onClick={() => {
                setActivePack(p)
                if (onSelectPack) onSelectPack(p.deviceId)
              }}
              style={{
                background: isSelected ? 'var(--bg-surface-raised)' : 'var(--bg-surface)',
                border: `1px solid ${isSelected ? color : 'var(--border)'}`,
                borderTop: `3px solid ${color}`,
                borderRadius: 8,
                padding: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {p.deviceId}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {p.name}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>SOH: {p.soh != null ? `${p.soh}%` : '--'}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{p.temperature != null ? `${p.temperature}°C` : '--'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Active Pack Drilldown Strip */}
      {activePack && (
        <div style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <div>
            <strong>Selected: {activePack.deviceId} ({activePack.name})</strong> — Status: <span style={{ color: getStateColor(activePack.state) }}>{activePack.state}</span> | Voltage: {activePack.voltage != null ? `${activePack.voltage}V` : '--'} | Temp: {activePack.temperature != null ? `${activePack.temperature}°C` : '--'}
          </div>
          <button
            onClick={() => setActivePack(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary, #4E5A6B)', cursor: 'pointer', fontSize: 12 }}
          >
            Dismiss ✕
          </button>
        </div>
      )}
    </div>
  )
}
