'use client'

import React, { useEffect, useRef } from 'react'
import useAnimatedNumber from '../hooks/useAnimatedNumber'
import styles from '../styles/anim.module.css'

const CIRC = 2 * Math.PI * 78

const ringColor = (s) => (s == null || s >= 60 ? '#00E8A0' : s >= 20 ? '#FFD60A' : '#FF2D55')

// K4 - Circular SOC gauge ring with animated stroke-dasharray fill, breathing
// glow while charging, and an animated center percentage. Pure SVG + CSS.
export default function SocRing({
  soc,
  charging = false,
  size = 190,
  remainingLabel,
  label = 'State of Charge',
}) {
  const offsetRef = useRef(CIRC)
  const s = soc == null ? null : Math.max(0, Math.min(100, Number(soc)))
  const targetOffset = s == null ? CIRC : CIRC - (s / 100) * CIRC
  const animated = useAnimatedNumber(s, 800, 0)
  const colorNow = ringColor(s)

  // Animate from full ring to the current SOC on mount (1.5s ease-out), then
  // ease to new values on updates via CSS transition on stroke-dashoffset.
  useEffect(() => {
    let raf
    const start = performance.now()
    const duration = 1500
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      offsetRef.current = CIRC - (CIRC - targetOffset) * eased
      raf = requestAnimationFrame(tick)
      if (t >= 1) offsetRef.current = targetOffset
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.socRingWrap} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="100" cy="100" r="78" fill="none" stroke="var(--border-subtle)" strokeWidth="12" />
        <circle
          cx="100"
          cy="100"
          r="78"
          fill="none"
          stroke={colorNow}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offsetRef.current}
          style={{
            transition: 'stroke-dashoffset 0.5s ease, stroke 0.4s ease',
            filter: `drop-shadow(0 0 6px ${colorNow}66)`,
          }}
        />
      </svg>
      <div
        className={charging ? styles.socRingBreathing : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className={styles.socRingScore} style={{ color: colorNow }}>
          {animated == null ? '--' : `${animated}%`}
        </div>
        <div className={styles.socRingLabel}>{label}</div>
        {remainingLabel && <div className={styles.socRingRemain}>{remainingLabel}</div>}
      </div>
    </div>
  )
}