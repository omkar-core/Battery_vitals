'use client'

import React from 'react'
import { Lightbulb } from 'lucide-react'
import useAnimatedNumber from '../hooks/useAnimatedNumber'
import { computeHealthScore } from '../lib/utils'
import styles from '../styles/anim.module.css'

// L2 - Gamified Battery Health Score: a single 0-100 score with letter grade
// (A+ → F) and actionable tips, derived deterministically from live telemetry
// (SOH + cycles + thermal stress). Shows '--' when SOH has not been measured.
export default function HealthScore({ soh, cycles, temperature }) {
  const result = computeHealthScore({ soh, cycles, temperature })
  // Hook must run unconditionally — it returns null for null targets.
  const animated = useAnimatedNumber(result ? result.score : null, 1200, 0)

  if (!result) {
    return (
      <div className={styles.healthScoreCard}>
        <div className={styles.healthScoreTop}>
          <div>
            <div className={styles.healthScoreLabel} style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Health Score
            </div>
            <div className={styles.healthScoreNum} style={{ color: 'var(--text-muted)' }}>
              --
            </div>
          </div>
          <div className={styles.healthScoreGrade} style={{ color: 'var(--text-muted)' }}>
            —
          </div>
        </div>
        <div className={styles.healthScoreDesc} style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Health score unlocks once a genuine SOH measurement is reported by the ESP32.
        </div>
      </div>
    )
  }

  return (
    <div className={styles.healthScoreCard}>
      <div className={styles.healthScoreTop}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Health Score
          </div>
          <div className={styles.healthScoreNum} style={{ color: result.color }}>
            {animated == null ? result.score : animated}
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-tertiary)' }}>/100</span>
          </div>
        </div>
        <div className={styles.healthScoreGrade} style={{ color: result.color }}>
          {result.grade} · {result.label}
        </div>
      </div>

      <div className={styles.healthScoreBarBg}>
        <div
          className={styles.healthScoreBarFill}
          style={{ width: `${result.score}%`, background: result.color }}
        />
      </div>

      <ul className={styles.healthScoreTips}>
        {result.tips.map((tip, i) => (
          <li key={i} className={styles.healthScoreTip}>
            <Lightbulb size={13} />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}