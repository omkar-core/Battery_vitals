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
    totalPacks: 8,
    safeCount: 6,
    warningCount: 1,
    criticalCount: 1,
    fleetHeadline: '1 of 8 packs requires thermal inspection (BAT004)',
    fleetNarrative: 'Fleet operations are stable overall with 87.5% fleet availability. Pack BAT004 has entered warning state due to elevated ambient temperature during charging.',
    topPriorityActions: [
      'Inspect cooling airflow at Station 4 (BAT004).',
      'Verify state of charge balance across all active packs.',
    ],
    packs: [
      { deviceId: 'BAT001', name: 'Pack 1 (ESS)', state: 'SAFE', soh: 98, voltage: 12.6, temperature: 24 },
      { deviceId: 'BAT002', name: 'Pack 2 (Forklift)', state: 'SAFE', soh: 97, voltage: 12.5, temperature: 25 },
      { deviceId: 'BAT003', name: 'Pack 3 (Solar)', state: 'SAFE', soh: 95, voltage: 12.4, temperature: 26 },
      { deviceId: 'BAT004', name: 'Pack 4 (EV-Cart)', state: 'WARNING', soh: 91, voltage: 12.1, temperature: 42 },
      { deviceId: 'BAT005', name: 'Pack 5 (Backup)', state: 'SAFE', soh: 99, voltage: 12.6, temperature: 23 },
      { deviceId: 'BAT006', name: 'Pack 6 (Robotics)', state: 'SAFE', soh: 94, voltage: 12.3, temperature: 27 },
      { deviceId: 'BAT007', name: 'Pack 7 (Bench)', state: 'SAFE', soh: 96, voltage: 12.5, temperature: 24 },
      { deviceId: 'BAT008', name: 'Pack 8 (Cold-Test)', state: 'CAUTION', soh: 92, voltage: 11.9, temperature: 14 },
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
          background: 'rgba(20, 27, 40, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderLeft: '4px solid var(--accent-primary, #00E8A0)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #F0F4F8)', marginBottom: 4 }}>
          {data.fleetHeadline}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #8B95A5)', lineHeight: 1.45 }}>
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
                background: isSelected ? 'rgba(255, 255, 255, 0.08)' : '#141B28',
                border: `1px solid ${isSelected ? color : 'rgba(255, 255, 255, 0.08)'}`,
                borderTop: `3px solid ${color}`,
                borderRadius: 8,
                padding: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #F0F4F8)' }}>
                  {p.deviceId}
                </span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              </div>

              <div style={{ fontSize: 10, color: 'var(--text-tertiary, #4E5A6B)', marginBottom: 6, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {p.name}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary, #8B95A5)' }}>SOH: {p.soh}%</span>
                <span style={{ color: 'var(--text-tertiary, #4E5A6B)' }}>{p.temperature ? `${p.temperature}°C` : '--'}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Active Pack Drilldown Strip */}
      {activePack && (
        <div style={{ background: '#0E131C', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <div>
            <strong>Selected: {activePack.deviceId} ({activePack.name})</strong> — Status: <span style={{ color: getStateColor(activePack.state) }}>{activePack.state}</span> | Voltage: {activePack.voltage}V | Temp: {activePack.temperature}°C
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
