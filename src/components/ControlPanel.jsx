'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  RotateCcw,
  Volume2,
  VolumeX,
  Play,
  Power,
  Lightbulb,
  ShieldAlert,
  Clock,
  Info,
  CheckCircle,
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
    return (
      <div className={styles.controlRow}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lightbulb
            size={15}
            style={{
              color: isOn ? colorHex : 'var(--text-muted)',
              filter: isOn ? `drop-shadow(0 0 6px ${colorHex})` : 'none',
            }}
          />
          <span style={{ fontWeight: 600, color: '#E2E8F0' }}>{label}</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className={styles.controlValue}
            style={{
              color: isOn ? colorHex : 'var(--text-muted)',
              fontSize: 11,
              letterSpacing: 0.5,
            }}
          >
            {isOn ? 'ENGAGED' : 'OFF'}
          </span>

          <button
            disabled={isAuto || pending != null || (key === 'buzzer' && isCritical && isOn)}
            onClick={() => act(isOn ? cmdOff : cmdOn, !isOn, label)}
            style={{
              cursor: isAuto ? 'not-allowed' : 'pointer',
              background: isAuto
                ? 'rgba(255,255,255,0.02)'
                : isOn
                ? 'rgba(255,45,85,0.12)'
                : 'rgba(0,232,160,0.12)',
              border: `1px solid ${
                isAuto ? 'var(--border)' : isOn ? 'rgba(255,45,85,0.3)' : 'rgba(0,232,160,0.3)'
              }`,
              color: isAuto ? 'var(--text-muted)' : isOn ? '#FF2D55' : '#00E8A0',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 700,
              transition: 'all 0.2s',
            }}
          >
            {isOn ? 'Turn Off' : 'Turn On'}
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
          padding: '14px 18px',
          background: isAuto
            ? 'linear-gradient(120deg, rgba(0, 232, 160, 0.14), rgba(56, 189, 248, 0.08))'
            : 'linear-gradient(120deg, rgba(255, 107, 53, 0.16), rgba(255, 214, 10, 0.08))',
          border: `1.5px solid ${isAuto ? 'rgba(0, 232, 160, 0.4)' : 'rgba(255, 107, 53, 0.4)'}`,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Power size={18} color={isAuto ? '#00E8A0' : '#FF6B35'} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
              Control Mode: {isAuto ? 'AUTOMATIC (Safe)' : 'MANUAL OVERRIDE'}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
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
            borderRadius: 10,
            border: 'none',
            background: isAuto ? 'linear-gradient(90deg, #FF6B35, #FF9800)' : 'linear-gradient(90deg, #00E8A0, #00C07A)',
            color: '#06121B',
            fontSize: 12,
            fontWeight: 800,
            cursor: isCritical && isAuto ? 'not-allowed' : 'pointer',
            boxShadow: isAuto ? '0 0 16px rgba(255, 107, 53, 0.3)' : '0 0 16px rgba(0, 232, 160, 0.3)',
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
            padding: '10px 14px',
            background: 'rgba(0, 232, 160, 0.05)',
            border: '1px solid rgba(0, 232, 160, 0.2)',
            borderRadius: 8,
            fontSize: 11.5,
            color: '#CBD5E1',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Info size={15} color="#00E8A0" flexShrink={0} />
          <span>
            <strong>Active Safety Logic:</strong> Green LED active (BHI &lt; 30, SAFE). Yellow LED
            triggers at BHI &gt; 30 (Caution). Red LED &amp; Buzzer trigger at BHI &gt; 55 or voltage
            cutoffs. Direct manual toggling is disabled while in Auto.
          </span>
        </div>
      ) : (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(255, 107, 53, 0.08)',
            border: '1px solid rgba(255, 107, 53, 0.25)',
            borderRadius: 8,
            fontSize: 11.5,
            color: '#FFD60A',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Clock size={15} color="#FFD60A" flexShrink={0} />
          <span>
            <strong>Manual Override Engaged:</strong> Actuator buttons below send immediate commands
            over MQTT. Note: Safety interlocks will override if a CRITICAL state occurs.
          </span>
        </div>
      )}

      {/* Actuator Status Rows */}
      <div className={styles.controlStatus}>
        {outRow('Green Safety Indicator LED', 'green_led', 'GREEN_ON', 'GREEN_OFF', '#00E8A0')}
        {outRow('Yellow Caution Indicator LED', 'yellow_led', 'YELLOW_ON', 'YELLOW_OFF', '#FFD60A')}
        {outRow('Red Critical Hazard Warning LED', 'red_led', 'RED_ON', 'RED_OFF', '#FF2D55')}
        {outRow('Audible Piezo Alarm Buzzer', 'buzzer', 'BUZZER_ON', 'BUZZER_OFF', '#FF2D55')}
      </div>

      {/* Manual Action Buttons (Test Buzzer, Demo Cycle, Reset to Auto, Silence All) */}
      <div className={styles.controlButtons}>
        <button
          disabled={isAuto || pending != null}
          className={styles.controlButton}
          onClick={() => act('TEST_BUZZER', 'TEST_BUZZER', '3-Sec Buzzer Test')}
          title="Pulse buzzer for 3 seconds"
        >
          <Bell size={14} color="#FFD60A" />
          <span>Test Buzzer (3s)</span>
        </button>

        <button
          disabled={isAuto || pending != null}
          className={styles.controlButton}
          onClick={() => act('DEMO_CYCLE', 'DEMO_CYCLE', 'LED Sequence Demo')}
          title="Run LED cycling sequence"
        >
          <Play size={14} color="#38BDF8" />
          <span>Demo Cycle</span>
        </button>

        <button
          disabled={pending != null}
          className={styles.controlButton}
          onClick={() => act('LED_MODE', 'auto', 'Reset to Auto')}
          title="Return to autonomous monitoring"
        >
          <RotateCcw size={14} color="#00E8A0" />
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
        <div style={{ fontSize: 11, color: '#38BDF8', marginTop: 10, fontFamily: 'monospace' }}>
          Transmitting MQTT command: {pending}...
        </div>
      )}
    </div>
  )
}
