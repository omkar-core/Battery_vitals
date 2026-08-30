'use client'
import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Layout from '../../components/Layout'
import AlertsList from '../../components/AlertsList'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { playAlertChime } from '../../lib/utils'
import {
  BellRing,
  Volume2,
  VolumeX,
  Bell,
  Smartphone,
  ShieldAlert,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function AlertsPage() {
  return (
    <Suspense fallback={<Layout><div style={{ padding: 40, textAlign: 'center' }}>Loading alerts...</div></Layout>}>
      <AlertsInner />
    </Suspense>
  )
}

function AlertsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlTab = searchParams?.get('tab')

  const { connected, data } = useRealTimeData()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [activeTab, setActiveTab] = useState('active') // 'active', 'history', 'analytics'

  useEffect(() => {
    if (!urlTab) return
    const t = urlTab.toLowerCase()
    if (t === 'history') setActiveTab('history')
    else if (t === 'analytics') setActiveTab('analytics')
    else if (t === 'active') setActiveTab('active')
  }, [urlTab])

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

  const counts = alerts.reduce((acc, a) => {
    const sev = (a.severity || 'INFO').toUpperCase()
    acc[sev] = (acc[sev] || 0) + 1
    return acc
  }, {})
  const unacked = alerts.filter((a) => !a.acknowledged).length

  return (
    <Layout connected={connected} lastSeen={data?.timestamp} data={data}>
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
            {soundEnabled ? <Volume2 size={13} color="var(--state-safe)" /> : <VolumeX size={13} />}
            <span>Sound {soundEnabled ? 'Active' : 'Muted'}</span>
          </button>

          <button
            onClick={requestPushPermission}
            className={styles.filterBtn}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderColor: pushEnabled ? 'var(--state-safe)' : 'var(--border)',
            }}
          >
            <Smartphone size={13} color={pushEnabled ? 'var(--state-safe)' : 'var(--text-muted)'} />
            <span>{pushEnabled ? 'Push Enabled' : 'Enable Push'}</span>
          </button>
        </div>
      </div>

      {/* Alert Navigation Tabs */}
      <div className={styles.filters} style={{ marginBottom: 16 }}>
        <button
          className={`${styles.filterBtn} ${activeTab === 'active' ? styles.filterActive : ''}`}
          onClick={() => {
            setActiveTab('active')
            router.replace('/alerts', { scroll: false })
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ShieldAlert size={14} color="#FF2D55" />
          <span>Active Alerts {unacked > 0 ? `(${unacked})` : ''}</span>
        </button>

        <button
          className={`${styles.filterBtn} ${activeTab === 'history' ? styles.filterActive : ''}`}
          onClick={() => {
            setActiveTab('history')
            router.replace('/alerts?tab=history', { scroll: false })
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Clock size={14} color="#38BDF8" />
          <span>Alert History ({alerts.length})</span>
        </button>

        <button
          className={`${styles.filterBtn} ${activeTab === 'analytics' ? styles.filterActive : ''}`}
          onClick={() => {
            setActiveTab('analytics')
            router.replace('/alerts?tab=analytics', { scroll: false })
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <BarChart3 size={14} color="#FFB800" />
          <span>Incident Analytics</span>
        </button>
      </div>

      {/* Summary Chips Strip */}
      <div className={styles.toolbar}>
        <span className="chip">
          <BellRing size={12} /> {alerts.length} Total Logged
        </span>
        <span className="chip" style={{ color: unacked > 0 ? 'var(--state-caution)' : 'var(--state-safe)' }}>
          <Bell size={12} /> {unacked} Unacknowledged
        </span>
        {counts.CRITICAL ? (
          <span className="chip" style={{ color: 'var(--state-critical)', borderColor: 'rgba(255,45,85,0.5)' }}>
            {counts.CRITICAL} Critical Active
          </span>
        ) : null}
        {counts.WARNING ? (
          <span className="chip" style={{ color: 'var(--orange)', borderColor: 'rgba(255,107,53,0.5)' }}>
            {counts.WARNING} Warnings
          </span>
        ) : null}
      </div>

      {/* Tab 1: Active Alerts */}
      {activeTab === 'active' && (
        <AlertsList
          alerts={alerts.filter((a) => !a.acknowledged)}
          loading={loading}
          onRefresh={load}
        />
      )}

      {/* Tab 2: Alert History */}
      {activeTab === 'history' && (
        <AlertsList
          alerts={alerts}
          loading={loading}
          onRefresh={load}
        />
      )}

      {/* Tab 3: Incident Analytics */}
      {activeTab === 'analytics' && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} color="#FFB800" />
            Safety Incident &amp; Severity Distribution Analytics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, margin: '16px 0' }}>
            <div style={{ padding: 16, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Incidents</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{alerts.length}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Events recorded</div>
            </div>
            <div style={{ padding: 16, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Critical Violations</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FF2D55', marginTop: 4 }}>{counts.CRITICAL || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>High-hazard events</div>
            </div>
            <div style={{ padding: 16, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Safety Warnings</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#FF6B35', marginTop: 4 }}>{counts.WARNING || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Pre-critical flags</div>
            </div>
            <div style={{ padding: 16, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Resolution Rate</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#00E8A0', marginTop: 4 }}>
                {alerts.length > 0 ? Math.round(((alerts.length - unacked) / alerts.length) * 100) : 100}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{alerts.length - unacked} of {alerts.length} acknowledged</div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.note}>
        Alerts are evaluated directly on the ESP32 firmware and verified server-side against
        configured chemistry thresholds. Non-critical warnings can be muted for 1H or 24H;
        CRITICAL safety state overrides remain persistent and cannot be suppressed.
      </div>
    </Layout>
  )
}
