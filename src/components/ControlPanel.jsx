'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  RotateCcw,
  VolumeX,
  Power,
  Lightbulb,
  Clock,
  Info,
} from 'lucide-react'
import styles from './components.module.css'

export default function ControlPanel({ commands = {}, onCommand, batteryState = 'SAFE' }) {
  const [pending, setPending] = useState(null)
  const [manualTimeRemaining, setManualTimeRemaining] = useState(1800) // 30 min countdown

  const isAuto = !!commands.auto_mode
  const isCritical = batteryState === 'CRITICAL' || batteryState === 'EMERGENCY'

  // Safety timer for manual mode
  useEffect(() => {
    if (isAuto) {
      setManualTimeRemaining(1800)
      return
    }
    const timer = setInterval(() => {
      setManualTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time expired, reset to auto
          if (onCommand) onCommand('LED_MODE', 'auto', 'Auto Reset Timeout')
          return 1800
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isAuto, onCommand])

  const act = async (name, value, label) => {
    setPending(name)
    try {
      if (onCommand) await onCommand(name, value, label)
    } finally {
      setTimeout(() => setPending(null), 350)
    }
  }

  const toggleAutoMode = () => {
    if (isCritical && isAuto) {
      alert('Safety Lock Active: Device is in CRITICAL safety state. Manual override is disallowed.')
      return
    }
    act('LED_MODE', isAuto ? 'manual' : 'auto', isAuto ? 'Manual Mode Engaged' : 'Auto Mode Engaged')
  }

  const outRow = (label, key, cmdOn, cmdOff, colorHex) => {
    const isOn = !!commands[key]
    const isDisabled = isAuto || pending != null || (key === 'buzzer' && isCritical && isOn)

    return (
      <div className={styles.controlRow} key={key}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Lightbulb
            size={16}
            style={{
              color: isOn ? colorHex : 'var(--text-tertiary)',
            }}
          />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{label}</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            className={styles.controlValue}
            style={{
              color: isOn ? colorHex : 'var(--text-tertiary)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
            }}
          >
            {isOn ? 'ENGAGED' : 'OFF'}
          </span>

          {/* iOS Style Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            disabled={isDisabled}
            onClick={() => act(isOn ? cmdOff : cmdOn, !isOn, label)}
            className={`${styles.toggleSwitch} ${isOn ? styles.toggleActive : ''}`}
            title={`${isOn ? 'Disable' : 'Enable'} ${label}`}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </div>
    )
  }

  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <div className={styles.controlPanel}>
      {/* Prominent Auto / Manual Mode Toggle Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: isAuto
            ? 'rgba(61, 220, 151, 0.08)'
            : 'rgba(245, 185, 66, 0.12)',
          border: `1px solid ${isAuto ? 'var(--state-safe)' : 'var(--state-warning)'}`,
          borderRadius: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Power size={18} color={isAuto ? 'var(--state-safe)' : 'var(--state-warning)'} />
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Control Mode: {isAuto ? 'AUTOMATIC (Safe)' : 'MANUAL OVERRIDE'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {isAuto
              ? 'ESP32 firmware autonomously dictates LED and Buzzer triggers according to real-time risk scores.'
              : `Manual test override active. Auto-reverts in ${formatCountdown(manualTimeRemaining)} for hardware safety.`}
          </div>
        </div>

        <button
          disabled={pending != null || (isCritical && isAuto)}
          onClick={toggleAutoMode}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: isAuto ? 'var(--state-warning)' : 'var(--state-safe)',
            color: '#0B0E12',
            fontSize: '12px',
            fontWeight: 700,
            cursor: isCritical && isAuto ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isAuto ? 'Switch to Manual Mode' : 'Reset to Auto Mode'}
        </button>
      </div>

      {/* Auto Mode Logic Explanation Banner */}
      {isAuto ? (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Info size={16} color="var(--state-safe)" flexShrink={0} />
          <span>
            <strong>Active Safety Logic:</strong> Green LED active (BHI &lt; 30, SAFE). Yellow LED
            triggers at BHI &gt; 30 (Caution). Red LED &amp; Buzzer trigger at BHI &gt; 55 or voltage
            cutoffs. Direct manual toggling is disabled while in Auto.
          </span>
        </div>
      ) : (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(245, 185, 66, 0.08)',
            border: '1px solid var(--state-warning)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--state-warning)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Clock size={16} color="var(--state-warning)" flexShrink={0} />
          <span>
            <strong>Manual Override Engaged:</strong> Use the iOS toggle switches below to send immediate command frames to ESP32 listeners.
          </span>
        </div>
      )}

      {/* Actuator Status Rows with iOS Switches */}
      <div className={styles.controlStatus}>
        {outRow('Green Safety Indicator LED', 'green_led', 'GREEN_ON', 'GREEN_OFF', 'var(--state-safe)')}
        {outRow('Yellow Caution Indicator LED', 'yellow_led', 'YELLOW_ON', 'YELLOW_OFF', 'var(--state-caution)')}
        {outRow('Red Critical Hazard Warning LED', 'red_led', 'RED_ON', 'RED_OFF', 'var(--state-critical)')}
        {outRow('Audible Piezo Alarm Buzzer', 'buzzer', 'BUZZER_ON', 'BUZZER_OFF', 'var(--state-critical)')}
      </div>

      {/* Manual Action Buttons (Test Buzzer, Reset to Auto, Silence All) */}
      <div className={styles.controlButtons}>
        <button
          disabled={isAuto || pending != null}
          className={styles.controlButton}
          onClick={() => act('TEST_BUZZER', 'TEST_BUZZER', '3-Sec Buzzer Test')}
          title="Pulse buzzer for 3 seconds"
        >
          <Bell size={14} color="var(--state-caution)" />
          <span>Test Buzzer (3s)</span>
        </button>

        <button
          disabled={pending != null}
          className={styles.controlButton}
          onClick={() => act('LED_MODE', 'auto', 'Reset to Auto')}
          title="Return to autonomous monitoring"
        >
          <RotateCcw size={14} color="var(--state-safe)" />
          <span>Reset to Auto</span>
        </button>

        <button
          disabled={isAuto || pending != null || isCritical}
          className={`${styles.controlButton} ${styles.danger}`}
          onClick={() => act('ALL_OFF', 'ALL_OFF', 'Silence All Actuators')}
          title="Turn off all LEDs and buzzer"
        >
          <VolumeX size={14} />
          <span>Silence All</span>
        </button>
      </div>

      {pending && (
        <div style={{ fontSize: '11px', color: 'var(--state-info)', marginTop: '12px', fontFamily: 'var(--font-mono)' }}>
          Transmitting Firebase command frame: {pending}...
        </div>
      )}
    </div>
  )
}
