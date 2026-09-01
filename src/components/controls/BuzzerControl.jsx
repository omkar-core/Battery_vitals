'use client'

import React, { useState } from 'react'
import { Volume2, VolumeX, AlertTriangle, Radio } from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function BuzzerControl({ commands = {}, onCommand, isAuto = false }) {
  const [loading, setLoading] = useState(false)
  const currentPattern = commands.buzzer_mode || (commands.buzzer ? 'continuous' : 'off')

  const setPattern = async (mode) => {
    if (isAuto) return
    setLoading(true)
    try {
      if (onCommand) {
        await onCommand('BUZZER_PATTERN', mode, `Set Buzzer Alarm Mode: ${mode.toUpperCase()}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const patterns = [
    { id: 'off', name: 'Silence / Mute', desc: 'Buzzer disabled', icon: VolumeX, color: '#8B95A5' },
    { id: 'slow_beep', name: 'Slow Beep', desc: '2.0s interval (Minor anomaly)', icon: Volume2, color: '#38BDF8' },
    { id: 'fast_beep', name: 'Fast Beep', desc: '0.5s interval (Warning state)', icon: Volume2, color: '#FFB800' },
    { id: 'continuous', name: 'Continuous Tone', desc: 'Solid alarm (Critical emergency)', icon: AlertTriangle, color: '#FF2D55' },
  ]

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Volume2 size={18} color="#FF2D55" />
          <h3 className={styles.cardTitle}>Audible Alarm &amp; Buzzer Patterns</h3>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Pin: GPIO 25 (Active Buzzer)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {patterns.map((p) => {
          const Icon = p.icon
          const isSelected = currentPattern === p.id

          return (
            <button
              key={p.id}
              onClick={() => setPattern(p.id)}
              disabled={isAuto || loading}
              style={{
                background: isSelected ? `${p.color}18` : 'var(--bg-surface-raised)',
                border: isSelected ? `1px solid ${p.color}66` : '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 14,
                textAlign: 'left',
                cursor: isAuto ? 'not-allowed' : 'pointer',
                opacity: isAuto ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon size={16} color={isSelected ? p.color : 'var(--text-secondary)'} />
                <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? p.color : 'var(--text-primary)' }}>
                  {p.name}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.desc}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
