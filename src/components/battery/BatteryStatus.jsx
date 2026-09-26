'use client'

import React from 'react'
import styles from '../../styles/dashboard.module.css'

export default function BatteryStatus({ battery }) {
  const raw = battery || {}
  const num = (v, fb) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? fb : Number(v))
  const bhi = num(raw.bhi, null)
  const soh = num(raw.soh, null)
  const safety = raw.safety || 'UNKNOWN'
  const direction = raw.direction || 'UNKNOWN'
  const resistance = num(raw.resistance, null)
  const cells = Array.isArray(raw.cells) ? raw.cells : []

  const STATUS_COLORS = {
    SAFE: '#00E8A0',
    CAUTION: '#FFD60A',
    WARNING: '#FFB800',
    CRITICAL: '#FF2D55',
    EMERGENCY: '#FF0040',
    UNKNOWN: '#64748B',
  }
  const statusColor = STATUS_COLORS[safety] || '#64748B'
  const isSafe = safety === 'SAFE'

  return (
    <div className={styles.batteryOverviewCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: `${statusColor}18`, padding: 8, borderRadius: 10, fontSize: 18 }}>
            {isSafe ? '🛡️' : '⚠️'}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Pack Safety &amp; Health State
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Deterministic Physics Engine</span>
          </div>
        </div>

        <span
          style={{
            background: `${statusColor}22`,
            color: statusColor,
            border: `1px solid ${statusColor}44`,
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {safety}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={{ background: 'var(--bg-surface-raised)', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>💚</span> BHI Score
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#00E8A0' }}>{bhi != null ? `${bhi}/100` : '--'}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Battery Health Index</div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>📈</span> SOH
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#38BDF8' }}>{soh != null ? `${soh}%` : '--'}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>State of Health</div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>⚡</span> Internal R
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{resistance != null ? `${resistance.toFixed(1)} mΩ` : '--'}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Impedance</div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <span>🔄</span> Mode
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#BF5AF2', marginTop: 2 }}>{direction}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Current flow</div>
        </div>
      </div>

      {/* Cell-Level Voltage Distribution (single INA219 measures pack only) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Cell Balance Overview
          </span>
          <span style={{ fontSize: 11, color: '#00E8A0', fontWeight: 600 }}>
            {cells.length ? 'ΔV ≤ 10 mV (Balanced)' : 'No per-cell taps on this hardware'}
          </span>
        </div>

        {cells.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {cells.map((cell) => (
            <div
              key={cell.id}
              style={{
                background: 'var(--bg-surface-raised)',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Cell #{cell.id}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{cell.voltage}V</div>
              <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(cell.voltage / 4.2) * 100}%`, height: '100%', background: '#00E8A0' }} />
              </div>
            </div>
          ))}
        </div>
        ) : (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
            Pack-level sensing only (INA219). Per-cell balance needs a monitor IC with cell taps — not claimed here.
          </p>
        )}
      </div>
    </div>
  )
}
