'use client'

import React from 'react'
import { ShieldCheck, ShieldAlert, Zap, Activity, Heart, RefreshCw } from 'lucide-react'
import styles from '../../styles/dashboard.module.css'

export default function BatteryStatus({ battery }) {
  const { bhi = 94, soh = 98, safety = 'SAFE', direction = 'IDLE', resistance = 15.4, cells = [] } = battery || {}

  const isSafe = safety === 'SAFE'
  const statusColor = isSafe ? '#00E8A0' : safety === 'WARNING' ? '#FFB800' : '#FF2D55'

  return (
    <div className={styles.batteryOverviewCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: `${statusColor}18`, padding: 8, borderRadius: 10 }}>
            {isSafe ? <ShieldCheck size={22} color={statusColor} /> : <ShieldAlert size={22} color={statusColor} />}
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
            <Heart size={13} color="#00E8A0" /> BHI Score
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#00E8A0' }}>{bhi}/100</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Battery Health Index</div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <Activity size={13} color="#38BDF8" /> SOH
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#38BDF8' }}>{soh}%</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>State of Health</div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <Zap size={13} color="#FFB800" /> Internal R
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{resistance.toFixed(1)} mΩ</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Impedance</div>
        </div>

        <div style={{ background: 'var(--bg-surface-raised)', padding: 12, borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            <RefreshCw size={13} color="#BF5AF2" /> Mode
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#BF5AF2', marginTop: 2 }}>{direction}</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Current flow</div>
        </div>
      </div>

      {/* Cell-Level Voltage Distribution */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Cell Balance Overview (3S Pack)
          </span>
          <span style={{ fontSize: 11, color: '#00E8A0', fontWeight: 600 }}>ΔV ≤ 10 mV (Balanced)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {cells.map((cell) => (
            <div
              key={cell.id}
              style={{
                background: 'rgba(0,0,0,0.25)',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Cell #{cell.id}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{cell.voltage}V</div>
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${(cell.voltage / 4.2) * 100}%`, height: '100%', background: '#00E8A0' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
