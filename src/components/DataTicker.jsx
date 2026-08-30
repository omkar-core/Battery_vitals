'use client'

import React from 'react'
import styles from '../styles/anim.module.css'

// L4 - Stock-market style live data ticker. Items are rendered in a doubled
// list so the CSS translate marquee loops seamlessly. Pauses on hover.
// Each item shows arrow deltas against the previous sample (real data only).
export default function DataTicker({ items = [] }) {
  if (!items || items.length === 0) return null
  const doubled = [...items, ...items]

  return (
    <div className={styles.tickerWrap} role="marquee" aria-label="Live telemetry ticker">
      <div className={styles.tickerTrack} aria-hidden="false">
        {doubled.map((it, i) => {
          const deltaClass =
            it.delta == null
              ? styles.tickerFlat
              : it.delta > 0.0005
              ? styles.tickerUp
              : it.delta < -0.0005
              ? styles.tickerDown
              : styles.tickerFlat
          const arrow = it.delta == null ? '•' : it.delta > 0.0005 ? '▲' : it.delta < -0.0005 ? '▼' : '•'
          return (
            <span key={`${it.key}-${i}`} className={styles.tickerItem}>
              <span className={styles.tickerKey}>{it.label}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{it.value}</span>
              <span className={deltaClass}>
                {arrow}
                {it.delta != null ? it.deltaText : ''}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}