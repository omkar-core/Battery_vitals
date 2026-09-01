'use client'

import React, { useState } from 'react'
import { Lightbulb, CheckCircle2, ShieldAlert } from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function LEDControl({ commands = {}, onCommand, isAuto = false }) {
  const [loading, setLoading] = useState(false)

  const toggleLED = async (color) => {
    if (isAuto) return
    setLoading(true)
    try {
      const key = `${color}_led`
      const nextVal = !commands[key]
      if (onCommand) {
        await onCommand(key.toUpperCase(), nextVal, `Toggle ${color.toUpperCase()} LED`)
      }
    } finally {
      setLoading(false)
    }
  }

  const leds = [
    {
      color: 'green',
      name: 'Normal (Green)',
      pin: 'GPIO 14',
      hex: '#00E8A0',
      active: commands.green_led ?? commands.led_green ?? true,
    },
    {
      color: 'yellow',
      name: 'Warning (Yellow)',
      pin: 'GPIO 26',
      hex: '#FFB800',
      active: commands.yellow_led ?? commands.led_yellow ?? false,
    },
    {
      color: 'red',
      name: 'Critical (Red)',
      pin: 'GPIO 27',
      hex: '#FF2D55',
      active: commands.red_led ?? commands.led_red ?? false,
    },
  ]

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lightbulb size={18} color="#00E8A0" />
          <h3 className={styles.cardTitle}>LED Status Indicator Controls</h3>
        </div>
        {isAuto && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Controlled automatically by safety state engine
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {leds.map((l) => (
          <div
            key={l.color}
            style={{
              background: l.active ? `${l.hex}14` : 'var(--bg-surface-raised)',
              border: l.active ? `1px solid ${l.hex}55` : '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{l.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>ESP32 Pin: {l.pin}</div>
              </div>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: l.active ? l.hex : '#3A4455',
                  boxShadow: l.active ? `0 0 10px ${l.hex}` : 'none',
                }}
              />
            </div>

            <button
              onClick={() => toggleLED(l.color)}
              disabled={isAuto || loading}
              className={styles.actionBtn}
              style={{
                width: '100%',
                background: l.active ? `${l.hex}22` : 'rgba(255,255,255,0.06)',
                color: l.active ? l.hex : 'var(--text-secondary)',
                border: l.active ? `1px solid ${l.hex}44` : '1px solid var(--border-subtle)',
                opacity: isAuto ? 0.6 : 1,
                cursor: isAuto ? 'not-allowed' : 'pointer',
              }}
            >
              {l.active ? 'Turn OFF' : 'Turn ON'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
