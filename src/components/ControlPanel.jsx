'use client'
import { useState } from 'react'
import { BellOff, Bell, RotateCcw, Volume2, Play, Power, Lightbulb } from 'lucide-react'
import styles from './components.module.css'

export default function ControlPanel({ commands = {}, onCommand }) {
  const [pending, setPending] = useState(null)

  const act = async (name, value, label) => {
    setPending(name)
    try {
      if (onCommand) await onCommand(name, value, label)
    } finally {
      setTimeout(() => setPending(null), 300)
    }
  }

  const outRow = (label, key, cmdOn, cmdOff) => {
    const isOn = !!commands[key]
    return (
      <div className={styles.controlRow}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lightbulb size={13} style={{ color: isOn ? 'var(--yellow)' : 'var(--text-muted)' }} />
          {label}
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <span className={styles.controlValue} style={{ color: isOn ? '#00E8A0' : 'var(--text-muted)' }}>
            {isOn ? 'ON' : 'OFF'}
          </span>
          <button
            disabled={pending != null}
            onClick={() => act(isOn ? cmdOff : cmdOn, !isOn, label)}
            style={{ marginLeft: 6, cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--blue)', fontSize: 12 }}
          >
            {isOn ? 'Off' : 'On'}
          </button>
        </div>
      </div>
    )
  }

  const primary = [
    { label: 'Silence All', name: 'ALL_OFF', value: 'ALL_OFF', icon: Volume2, severity: 'danger' },
    { label: 'Test Buzzer', name: 'TEST_BUZZER', value: 'TEST_BUZZER', icon: Bell },
    { label: 'Demo Cycle', name: 'DEMO_CYCLE', value: 'DEMO_CYCLE', icon: Play },
    { label: 'Reset Auto', name: 'LED_MODE', value: 'auto', icon: RotateCcw },
  ]

  return (
    <div className={styles.controlPanel}>
      <h3 className={styles.panelTitle}>Device Control</h3>

      <div className={styles.controlStatus}>
        <div className={styles.controlRow}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Power size={13} color="#00E8A0" />
            Auto Mode
          </span>
          <span className={styles.controlValue}>{commands.auto_mode ? 'ACTIVE' : 'MANUAL'}</span>
        </div>
        {outRow('Green LED', 'green_led', 'GREEN_ON', 'GREEN_OFF')}
        {outRow('Yellow LED', 'yellow_led', 'YELLOW_ON', 'YELLOW_OFF')}
        {outRow('Red LED', 'red_led', 'RED_ON', 'RED_OFF')}
        {outRow('Buzzer', 'buzzer', 'BUZZER_ON', 'BUZZER_OFF')}
      </div>

      <div className={styles.controlButtons}>
        {primary.map((b) => {
          const Icon = b.icon
          return (
            <button
              key={b.name}
              disabled={pending != null}
              className={`${styles.controlButton} ${b.severity === 'danger' ? styles.danger : ''}`}
              onClick={() => act(b.name, b.value, b.label)}
            >
              <Icon size={15} />
              <span>{b.label}</span>
            </button>
          )
        })}
      </div>
      {pending && <div className={styles.controlValue} style={{ marginTop: 10 }}>Sending {pending}...</div>}
    </div>
  )
}
