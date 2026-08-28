import { useState } from 'react'
import { Power, BellOff, Bell, RotateCcw } from 'lucide-react'
import styles from './components.module.css'

export default function ControlPanel({ commands = {}, onCommand }) {
  const [pending, setPending] = useState(false)

  const act = async (name, value) => {
    setPending(true)
    try {
      if (onCommand) await onCommand(name, value)
    } finally {
      setTimeout(() => setPending(false), 300)
    }
  }

  const buttons = [
    { label: 'Silence All', name: 'ALL_OFF', icon: BellOff, tone: 'danger' },
    { label: 'Test Buzzer', name: 'TEST_BUZZER', icon: Bell },
    { label: 'Reset Alarm', name: 'RESET_ALARM', icon: RotateCcw },
  ]

  return (
    <div className={styles.controlPanel}>
      <h3 className={styles.panelTitle}>Device Control</h3>

      <div className={styles.controlStatus}>
        <div className={styles.controlRow}>
          <span>Auto Mode</span>
          <span className={styles.controlValue}>{commands.auto_mode ? 'ACTIVE' : 'MANUAL'}</span>
        </div>
        <div className={styles.controlRow}>
          <span>Green LED</span>
          <span className={styles.controlValue}>{commands.green_led ? 'ON' : 'OFF'}</span>
        </div>
        <div className={styles.controlRow}>
          <span>Yellow LED</span>
          <span className={styles.controlValue}>{commands.yellow_led ? 'ON' : 'OFF'}</span>
        </div>
        <div className={styles.controlRow}>
          <span>Red LED</span>
          <span className={styles.controlValue}>{commands.red_led ? 'ON' : 'OFF'}</span>
        </div>
        <div className={styles.controlRow}>
          <span>Buzzer</span>
          <span className={styles.controlValue}>{commands.buzzer ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      <div className={styles.controlButtons}>
        {buttons.map((b) => {
          const Icon = b.icon
          return (
            <button
              key={b.name}
              disabled={pending}
              className={`${styles.controlButton} ${b.tone === 'danger' ? styles.danger : ''}`}
              onClick={() => act(b.name, b.label)}
            >
              <Icon size={15} />
              <span>{b.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
