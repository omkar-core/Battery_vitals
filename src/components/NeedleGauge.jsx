'use client'

import React from 'react'
import useAnimatedNumber from '../hooks/useAnimatedNumber'
import styles from '../styles/anim.module.css'

const CX = 100
const CY = 100
const R = 78

function polar(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}

function arcPath(startAngle, endAngle) {
  const s = polar(startAngle)
  const e = polar(endAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

// K3 - Semi-circular animated needle gauge with color zones and tick labels.
// Zones are passed as [ {min, max, color} ] fractions of the full scale.
export default function NeedleGauge({
  label,
  value,
  min,
  max,
  unit = '',
  digits = 1,
  zones = [
    { min: 0, max: 0.6, color: '#00E8A0' },
    { min: 0.6, max: 0.8, color: '#FFD60A' },
    { min: 0.8, max: 1, color: '#FF2D55' },
  ],
}) {
  const v = value == null || Number.isNaN(Number(value)) ? null : Math.min(max, Math.max(min, Number(value)))
  const frac = v == null ? 0 : (v - min) / (max - min)
  // Needle rotation: -180deg (left) → 0deg (right) across the semi-circle.
  const needleAngle = -180 + frac * 180
  const animated = useAnimatedNumber(v, 700, digits)
  const needleColor = v == null ? '#94A3B8' : (zones.find((z) => frac >= z.min && frac <= z.max) || zones[zones.length - 1]).color

  return (
    <div className={styles.needleGaugeWrap}>
      <svg viewBox="0 0 200 128" width="100%" height="auto" role="img" aria-label={`${label}: ${animated ?? '--'} ${unit}`}>
        {/* Colored zone arcs (semi-circle from 180° → 360° in svg coords = top half) */}
        {zones.map((z, i) => (
          <path
            key={i}
            d={arcPath(-180 + z.min * 180, -180 + z.max * 180)}
            fill="none"
            stroke={z.color}
            strokeOpacity="0.25"
            strokeWidth="14"
            strokeLinecap="round"
          />
        ))}
        {/* Thinner active arc */}
        <path
          d={arcPath(-180, -180 + frac * 180)}
          fill="none"
          stroke={needleColor}
          strokeWidth="14"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${needleColor}77)` }}
        />

        {/* Tick marks at 0/25/50/75/100% */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const a = -180 + f * 180
          const p1 = { x: CX + 62 * Math.cos((a * Math.PI) / 180), y: CY + 62 * Math.sin((a * Math.PI) / 180) }
          const p2 = { x: CX + R * Math.cos((a * Math.PI) / 180), y: CY + R * Math.sin((a * Math.PI) / 180) }
          return <line key={f} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--text-tertiary)" strokeOpacity="0.5" strokeWidth="2" />
        })}
        {[
          { f: 0, txt: min },
          { f: 0.5, txt: (min + max) / 2 },
          { f: 1, txt: max },
        ].map(({ f, txt }) => {
          const a = -180 + f * 180
          const p = { x: CX + 48 * Math.cos((a * Math.PI) / 180), y: CY + 52 * Math.sin((a * Math.PI) / 180) }
          return (
            <text key={f} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="var(--text-tertiary)" fontSize="9" fontFamily="var(--font-mono)">
              {String(txt).slice(0, 5)}
            </text>
          )
        })}

        {/* Needle */}
        <g
          className={styles.needleGaugeNeedle}
          style={{ transform: `rotate(${needleAngle}deg)` }}
        >
          <g className={styles.needleDropShadow}>
            <line x1="100" y1="100" x2="100" y2="26" stroke={needleColor} strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="100" r="7" fill={needleColor} />
            <circle cx="100" cy="100" r="3" fill="var(--bg-surface)" />
          </g>
        </g>
      </svg>

      <div style={{ textAlign: 'center', marginTop: -6 }}>
        <div className={styles.needleGaugeValue} style={{ color: needleColor }}>
          {animated == null ? '--' : `${animated}${unit}`}
        </div>
        <div className={styles.needleGaugeLabel}>{label}</div>
      </div>
    </div>
  )
}