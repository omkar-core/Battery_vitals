'use client'

import React from 'react'
import { BatteryCharging, Battery, Clock, Zap } from 'lucide-react'

export default function SOCIndicator({ soc = 85, voltage = 12.6, current = 0, size = 180 }) {
  const clampedSoc = Math.max(0, Math.min(100, Math.round(soc)))
  const radius = (size - 24) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clampedSoc / 100) * circumference

  let color = '#00E8A0'
  if (clampedSoc < 20) color = '#FF2D55'
  else if (clampedSoc < 40) color = '#FFB800'

  const isCharging = current > 0.05
  const isDischarging = current < -0.05

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
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
          {isCharging ? (
            <BatteryCharging size={24} color="#00E8A0" style={{ marginBottom: 2 }} />
          ) : (
            <Battery size={24} color={color} style={{ marginBottom: 2 }} />
          )}
          <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {clampedSoc}%
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            {isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Standby'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Zap size={14} color="#FFB800" /> {voltage.toFixed(2)} V
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={14} color="#38BDF8" /> {current.toFixed(2)} A
        </span>
      </div>
    </div>
  )
}
