'use client'

import { useCallback, useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import AlertsList from '../../components/AlertsList'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { playAlertChime } from '../../lib/utils'
import {
  BellRing,
  Volume2,
  VolumeX,
  Send,
  ShieldAlert,
  Bell,
  Smartphone,
  CheckCircle,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function AlertsPage() {
  const { connected, data } = useRealTimeData()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/alerts?limit=100')
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list)) setAlerts(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
    }
  }, [load])

  const requestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Browser notifications are not supported on this browser.')
      return
    }
    const perm = await Notification.requestPermission()
    setPushEnabled(perm === 'granted')
    if (perm === 'granted') {
      new Notification('Battery Vital Alerts Active', {
        body: 'You will now receive push notifications for critical battery events.',
        icon: '/favicon.svg',
      })
    }
  }

  const triggerTestAlert = async (severity = 'WARNING') => {
    playAlertChime(severity)
    const isCrit = severity === 'CRITICAL'
    const msg = isCrit
      ? 'Thermal Runaway Warning: DHT11 cell temperature 56.4°C exceeded 50.0°C safety ceiling.'
      : 'Voltage Anomaly: INA219 measured 14.65V approaching upper charge cutoff.'

    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batteryId: 'BAT001',
        severity,
        type: isCrit ? 'THERMAL_OVERHEAT' : 'OVER_VOLTAGE',
        message: msg,
        bhi: isCrit ? 82 : 45,
        sensorData: {
          voltage: isCrit ? 13.9 : 14.65,
          temperature: isCrit ? 56.4 : 32.1,
          current: isCrit ? 4.2 : 3.8,
        },
      }),
    })

    if (pushEnabled && typeof window !== 'undefined' && 'Notification' in window) {
      new Notification(`Battery Vital [${severity}]`, {
        body: msg,
        icon: '/favicon.svg',
      })
    }

    load()
  }

  const counts = alerts.reduce((acc, a) => {
    const sev = (a.severity || 'INFO').toUpperCase()
    acc[sev] = (acc[sev] || 0) + 1
    return acc
  }, {})
  const unacked = alerts.filter((a) => !a.acknowledged).length

  return (
    <Layout connected={connected} lastSeen={data?.timestamp}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            Alert Management &amp; <span className="gradText">Safety Center</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Real-time threshold surveillance, multi-channel dispatch, and event incident logs.
          </p>
        </div>

        {/* Action Controls & Notification Preferences */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              playAlertChime('INFO')
            }}
            className={styles.filterBtn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {soundEnabled ? <Volume2 size={13} color="#00E8A0" /> : <VolumeX size={13} />}
            <span>Sound {soundEnabled ? 'Active' : 'Muted'}</span>
          </button>

          <button
            onClick={requestPushPermission}
            className={styles.filterBtn}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderColor: pushEnabled ? '#00E8A0' : 'var(--border)',
            }}
          >
            <Smartphone size={13} color={pushEnabled ? '#00E8A0' : '#94A3B8'} />
            <span>{pushEnabled ? 'Push Enabled' : 'Enable Push'}</span>
          </button>

          <button
            onClick={() => triggerTestAlert('CRITICAL')}
            className={styles.filterBtn}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderColor: 'rgba(255, 45, 85, 0.4)',
              color: '#FF2D55',
            }}
          >
            <ShieldAlert size={13} />
            <span>Test Critical Alert</span>
          </button>
        </div>
      </div>

      {/* Summary Chips Strip */}
      <div className={styles.toolbar}>
        <span className="chip">
          <BellRing size={12} /> {alerts.length} Total Logged
        </span>
        <span className="chip" style={{ color: unacked > 0 ? '#FFD60A' : '#00E8A0' }}>
          <Bell size={12} /> {unacked} Unacknowledged
        </span>
        {counts.CRITICAL ? (
          <span className="chip" style={{ color: '#FF2D55', borderColor: 'rgba(255,45,85,0.5)' }}>
            {counts.CRITICAL} Critical Active
          </span>
        ) : null}
        {counts.WARNING ? (
          <span className="chip" style={{ color: '#FF6B35', borderColor: 'rgba(255,107,53,0.5)' }}>
            {counts.WARNING} Warnings
          </span>
        ) : null}
      </div>

      <AlertsList alerts={alerts} loading={loading} onRefresh={load} />

      <div className={styles.note}>
        Alerts are evaluated directly on the ESP32 firmware and verified server-side against
        configured chemistry thresholds. Non-critical warnings can be muted for 1H or 24H;
        CRITICAL safety state overrides remain persistent and cannot be suppressed.
      </div>
    </Layout>
  )
}
