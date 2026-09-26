'use client'

import React from 'react'

export default function SOCIndicator({ soc = null, voltage = null, current = null, size = 180 }) {
  const hasSoc = soc != null
  const clampedSoc = hasSoc ? Math.max(0, Math.min(100, Math.round(soc))) : 0
  const radius = (size - 24) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = hasSoc ? circumference - (clampedSoc / 100) * circumference : circumference

  let color = '#00E8A0'
  if (hasSoc) {
    if (clampedSoc < 20) color = '#FF2D55'
    else if (clampedSoc < 40) color = '#FFB800'
  } else {
    color = 'var(--text-muted)'
  }

  const isCharging = current != null && current > 0.05
  const isDischarging = current != null && current < -0.05

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--border)"
            strokeWidth="12"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
          />
        </svg>

        {/* Center Content */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 22, marginBottom: 2 }}>
            {isCharging ? '⚡' : '🔋'}
          </span>
          <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {hasSoc ? `${clampedSoc}%` : '--'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            {isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Standby'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>⚡</span> {voltage != null ? `${voltage.toFixed(2)} V` : '-- V'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>⏱️</span> {current != null ? `${current.toFixed(2)} A` : '-- A'}
        </span>
      </div>
    </div>
  )
}
