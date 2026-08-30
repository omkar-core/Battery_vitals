'use client'

import React from 'react'
import { BatteryCharging, PlugZap } from 'lucide-react'
import styles from '../styles/anim.module.css'

// L1 - Animated energy-flow diagram. Dashes stream toward the battery while
// charging, away from it while discharging, and sit static (gray) when idle.
// Line thickness scales with current magnitude. Pure SVG + CSS animation.
export default function EnergyFlow({ op = 'IDLE', current = 0, power = 0 }) {
  const opCode = String(op || 'IDLE').toUpperCase()
  const charging = opCode === 'CHARGING'
  const discharging = opCode === 'DISCHARGING'
  const magnitude = Math.min(2.5, Math.max(1, Math.abs(Number(current) || 0) * 18))
  const flowClass = charging ? styles.flowCharging : discharging ? styles.flowDischarging : styles.flowIdle
  const color = charging ? '#38BDF8' : discharging ? '#FF6B35' : '#94A3B8'
  const powerText =
    power == null || Number.isNaN(Number(power))
      ? '--'
      : `${Math.abs(Number(power)) >= 10 ? Math.round(Number(power)) : Number(power).toFixed(2)} W`
  const direction = charging ? 'charging' : discharging ? 'discharging' : 'idle'

  return (
    <div
      className={`${charging ? styles.flowGlowCharging : discharging ? styles.flowGlowDischarging : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md, 12px)',
      }}
      role="img"
      aria-label={`Energy flow: ${direction}, ${powerText}`}
    >
      {/* Source / charger node */}
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 42,
          height: 42,
          borderRadius: 10,
          border: `1.5px solid ${color}66`,
          background: `${color}1a`,
          color,
          flexShrink: 0,
        }}
        title={charging ? 'Charger' : 'Battery'}
      >
        <PlugZap size={20} />
      </div>

      {/* Flow line */}
      <svg viewBox="0 0 140 40" width="100%" height="34" style={{ flex: 1 }}>
        <path
          className={`${styles.flowPathBase} ${flowClass}`}
          d="M 8 20 H 132"
          strokeWidth={magnitude}
        />
        {/* Watt label in middle */}
        <text
          className={styles.flowLabel}
          x="70"
          y="14"
          textAnchor="middle"
          fill={color}
          fontWeight={600}
        >
          {powerText}
        </text>
        <text x="70" y="32" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="var(--font-mono)" fontSize="9">
          {direction.toUpperCase()}
        </text>
      </svg>

      {/* Load / battery node */}
      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 42,
          height: 42,
          borderRadius: 10,
          border: `1.5px solid ${color}66`,
          background: `${color}1a`,
          color,
          flexShrink: 0,
        }}
        title={charging ? 'Battery absorbing charge' : 'Load'}
      >
        <BatteryCharging size={20} />
      </div>
    </div>
  )
}