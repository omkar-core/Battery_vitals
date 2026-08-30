'use client'

import React from 'react'
import { Zap } from 'lucide-react'
import styles from '../styles/anim.module.css'

// K1 - Animated SVG battery icon that fills/drains in real time from SOC.
//   - Pure SVG + CSS (no animation library)
//   - Smooth height transition on the fill bar
//   - Green ≥60% / yellow 20-59% / red <20%
//   - Charging ⇒ pulsing lightning bolt overlay
//   - SOC <10% ⇒ shaking animation
// Respects prefers-reduced-motion through the global override.
export default function AnimatedBatteryIcon({ soc, charging = false, size = 40 }) {
  const s = soc == null ? null : Math.max(0, Math.min(100, Number(soc)))
  const fillColor = s == null || s >= 60 ? '#00E8A0' : s >= 20 ? '#FFD60A' : '#FF2D55'
  const strokeColor = s == null ? 'var(--text-muted)' : fillColor
  // Fill bar geometry inside the recess (recess: x8, y10, w24, h52)
  const fillHeight = s == null ? 0 : 52 * (s / 100)
  const fillY = 62 - fillHeight

  return (
    <div
      className={charging ? `${styles.batteryChargingGlow}` : ''}
      style={{ width: size, height: size * 1.75 }}
      title={s == null ? 'No SOC data' : `State of Charge ${Math.round(s)}%`}
      aria-label={s == null ? 'Battery state unknown' : `Battery at ${Math.round(s)} percent`}
      role="img"
    >
      <svg
        viewBox="0 0 40 70"
        width={size}
        height={size * 1.75}
        className={s != null && s < 10 && !charging ? styles.batteryShake : undefined}
        style={{ overflow: 'visible' }}
      >
        {/* Terminal cap */}
        <rect x="13" y="1" width="14" height="4" rx="2" fill={strokeColor} />
        {/* Battery body */}
        <rect
          x="4"
          y="5"
          width="32"
          height="62"
          rx="7"
          fill="var(--bg-surface-raised)"
          stroke={strokeColor}
          strokeWidth="2"
        />
        {/* Inner recess */}
        <rect x="8" y="10" width="24" height="52" rx="4" fill="rgba(0,0,0,0.35)" />

        {/* Charge level fill (clip inside recess) */}
        <clipPath id="batteryClip">
          <rect x="8" y="10" width="24" height="52" rx="4" />
        </clipPath>
        <g clipPath="url(#batteryClip)">
          <rect
            className={styles.batteryFill}
            x="8"
            y={fillY}
            width="24"
            height={fillHeight}
            fill={fillColor}
          />
        </g>

        {/* Charging bolt overlay */}
        {charging && (
          <g className={styles.batteryBoltPulse}>
            <Zap
              x="12.5"
              y="26"
              size={15}
              color="#38BDF8"
              fill="#38BDF8"
              strokeWidth={1}
              style={{ overflow: 'visible' }}
            />
          </g>
        )}
      </svg>
    </div>
  )
}