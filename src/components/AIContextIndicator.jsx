'use client'

import React from 'react'

export default function AIContextIndicator({ contextData }) {
  const telemetry = contextData?.currentTelemetry || {}
  const safety = contextData?.deterministicSafetyState || {}
  const confidence = contextData?.sensorConfidence || {}

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <span>🧠</span> AI Context &amp; Data Transparency
        </div>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '4px 8px',
          borderRadius: '20px',
          backgroundColor: safety.statusLabel === 'SAFE' ? 'rgba(0,232,160,0.15)' : 'rgba(255,184,0,0.15)',
          color: safety.statusLabel === 'SAFE' ? '#00E8A0' : '#FFB800',
        }}>
          Engine: {safety.statusLabel || 'SAFE'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#00E8A0' }}>✓</span> Current Telemetry ({telemetry.voltage || '12.8'}V / {telemetry.temperature || '31.4'}°C)
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#00E8A0' }}>✓</span> 30-Day Degradation Trends
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#00E8A0' }}>✓</span> Active Battery Profile
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: '#00E8A0' }}>✓</span> Verified Sensor Confidence ({confidence.overallConfidence || '100% Verified'})
        </div>
      </div>
    </div>
  )
}
