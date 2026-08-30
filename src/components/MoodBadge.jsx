'use client'

import React from 'react'
import { batteryMood } from '../lib/utils'
import styles from '../styles/anim.module.css'

// L3 - Battery "mood" indicator. Maps live telemetry to an emotive status
// (⚡️ Energized, 😊 Happy, 😱 Panicking, ...) with an explanatory reason.
// Re-renders with a pop animation whenever the mood changes.
export default function MoodBadge({ soc, temperature, current, safety, align = 'left' }) {
  const mood = batteryMood({ soc, temperature, current, safety })

  return (
    <span
      className={styles.moodBadge}
      style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}
      title={mood.reason}
      role="img"
      aria-label={`Battery mood: ${mood.label}. ${mood.reason}`}
    >
      <span key={mood.emoji} className={styles.moodEmoji}>
        {mood.emoji}
      </span>
      <span style={{ color: mood.color }}>{mood.label}</span>
    </span>
  )
}