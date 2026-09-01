'use client'

import React from 'react'

export default function GaugeChart({
  value = 0,
  min = 0,
  max = 100,
  unit = '',
  label = '',
  color = '#00E8A0',
  size = 160,
  thickness = 10,
}) {
  const clamped = Math.max(min, Math.min(max, value))
  const percentage = (clamped - min) / (max - min)
  
  const radius = (size - thickness * 2) / 2
  // Semi-circle arc from 180 deg to 360 deg (PI rad)
  const arcLength = Math.PI * radius
  const strokeDashoffset = arcLength - percentage * arcLength

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size / 2 + 20, overflow: 'hidden' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-180deg)' }}>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={thickness}
            strokeDasharray={`${arcLength} ${arcLength}`}
            fill="transparent"
          />
          {/* Active arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={`${arcLength} ${arcLength}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>

        {/* Center reading */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {typeof value === 'number' ? value.toFixed(1) : value} <span style={{ fontSize: 13, fontWeight: 600 }}>{unit}</span>
          </div>
          {label && (
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: size, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}
