'use client'

import { useEffect, useState } from 'react'
import {
  Bell,
  Check,
  VolumeX,
  Volume2,
  Search,
  ShieldAlert,
  AlertTriangle,
  Info,
  Clock,
  Gauge,
  Flame,
  Zap,
} from 'lucide-react'
import { formatNumber, playAlertChime } from '../lib/utils'
import styles from './components.module.css'

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#FF2D55', icon: ShieldAlert, label: 'CRITICAL', bg: 'rgba(255, 45, 85, 0.15)' },
  EMERGENCY: { color: '#FF2D55', icon: ShieldAlert, label: 'EMERGENCY', bg: 'rgba(255, 45, 85, 0.15)' },
  WARNING: { color: '#FF6B35', icon: AlertTriangle, label: 'WARNING', bg: 'rgba(255, 107, 53, 0.14)' },
  CAUTION: { color: '#FFD60A', icon: AlertTriangle, label: 'CAUTION', bg: 'rgba(255, 214, 10, 0.12)' },
  INFO: { color: '#38BDF8', icon: Info, label: 'INFO', bg: 'rgba(56, 189, 248, 0.12)' },
  SAFE: { color: '#00E8A0', icon: Check, label: 'SAFE', bg: 'rgba(0, 232, 160, 0.12)' },
}

const MUTE_STORE_KEY = 'bv_muted_alerts_map'

function getMutedMap() {
  try {
    return JSON.parse(localStorage.getItem(MUTE_STORE_KEY) || '{}')
  } catch (e) {
    return {}
  }
}

export default function AlertsList({ alerts = [], loading, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [mutedMap, setMutedMap] = useState({})
  const [ackBusy, setAckBusy] = useState(null)

  useEffect(() => {
    setMutedMap(getMutedMap())
  }, [])

  const handleMute = (alertId, durationHours) => {
    const expiresAt = Date.now() + durationHours * 3600 * 1000
    const next = { ...mutedMap, [alertId]: expiresAt }
    setMutedMap(next)
    try {
      localStorage.setItem(MUTE_STORE_KEY, JSON.stringify(next))
    } catch (e) {}
  }

  const handleUnmute = (alertId) => {
    const next = { ...mutedMap }
    delete next[alertId]
    setMutedMap(next)
    try {
      localStorage.setItem(MUTE_STORE_KEY, JSON.stringify(next))
    } catch (e) {}
  }

  const isMuted = (alertId) => {
    const expires = mutedMap[alertId]
    if (!expires) return false
    if (Date.now() > expires) {
      handleUnmute(alertId)
      return false
    }
    return true
  }

  const acknowledge = async (id) => {
    setAckBusy(id)
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, acknowledged: true }),
      })
      if (onRefresh) onRefresh()
    } catch (e) {}
    setAckBusy(null)
  }

  const FILTERS = [
    { key: 'all', label: 'All Alerts' },
    { key: 'CRITICAL', label: 'Critical' },
    { key: 'WARNING', label: 'Warnings' },
    { key: 'INFO', label: 'Info' },
    { key: 'UNACK', label: 'Unacknowledged' },
  ]

  const isCritical = (sev) => {
    const s = (sev || '').toUpperCase()
    return s === 'CRITICAL' || s === 'EMERGENCY'
  }

  // Filtered & Searched list
  const visible = alerts.filter((a) => {
    const sev = (a.severity || 'INFO').toUpperCase()
    if (filter === 'CRITICAL' && !isCritical(sev)) return false
    if (filter === 'WARNING' && sev !== 'WARNING' && sev !== 'CAUTION') return false
    if (filter === 'INFO' && sev !== 'INFO' && sev !== 'SAFE') return false
    if (filter === 'UNACK' && a.acknowledged) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const text = `${a.message || ''} ${a.type || ''} ${a.severity || ''}`.toLowerCase()
      return text.includes(q)
    }
    return true
  })

  return (
    <div className={styles.alertsCard}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={18} color="#FFD60A" />
          <h3 className={styles.panelTitle} style={{ margin: 0 }}>
            Alert &amp; Safety Event Stream
          </h3>
        </div>

        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '5px 10px',
          }}
        >
          <Search size={13} color="#94A3B8" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#F4F6FB',
              fontSize: 12,
              outline: 'none',
              width: 130,
            }}
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className={styles.alertFilters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              border: filter === f.key ? '1px solid rgba(255,214,10,0.5)' : '1px solid var(--border)',
              background:
                filter === f.key ? 'rgba(255,214,10,0.12)' : 'rgba(255,255,255,0.03)',
              color: filter === f.key ? '#FFD60A' : 'var(--text-secondary)',
              borderRadius: 8,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      {visible.length === 0 ? (
        <div className={styles.aiEmpty}>
          {loading ? 'Polling live alerts from MongoDB...' : 'No active alerts match this filter.'}
        </div>
      ) : (
        <div className={styles.alertsList}>
          {visible.map((a) => {
            const sev = (a.severity || 'INFO').toUpperCase()
            const cfg = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.INFO
            const Icon = cfg.icon
            const muted = isMuted(a.id)
            const dimmed = muted || a.acknowledged
            const unread = !a.acknowledged && !muted
            const snapshot = a.sensorData || {}

            return (
              <div
                key={a.id}
                className={`${styles.alertItem} ${dimmed ? styles.dimmed : ''} ${
                  unread ? styles.unread : ''
                }`}
                style={{
                  borderLeft: `4px solid ${cfg.color}`,
                  position: 'relative',
                }}
              >
                <div className={styles.alertBody}>
                  {/* Top Bar: Severity + Time */}
                  <div className={styles.alertTop}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        color: cfg.color,
                        fontWeight: 800,
                        fontSize: 11,
                      }}
                    >
                      <Icon size={13} />
                      {cfg.label} • {a.type || 'SYSTEM'}
                    </span>
                    <span className={styles.alertTime}>
                      {a.time ? new Date(a.time).toLocaleString() : '--'}
                    </span>
                  </div>

                  {/* Message */}
                  <div className={styles.alertMsg} style={{ fontWeight: unread ? 600 : 400 }}>
                    {a.message || 'Battery limit anomaly triggered.'}
                  </div>

                  {/* Battery State Snapshot at time of alert */}
                  {(snapshot.voltage != null || a.bhi != null || snapshot.temperature != null) && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        marginTop: 6,
                        padding: '4px 8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: 6,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {snapshot.voltage != null && (
                        <span>
                          V: <strong style={{ color: '#FFD60A' }}>{formatNumber(snapshot.voltage)}V</strong>
                        </span>
                      )}
                      {snapshot.current != null && (
                        <span>
                          I: <strong style={{ color: '#38BDF8' }}>{formatNumber(snapshot.current)}A</strong>
                        </span>
                      )}
                      {snapshot.temperature != null && (
                        <span>
                          Temp:{' '}
                          <strong style={{ color: '#FF2D55' }}>
                            {formatNumber(snapshot.temperature, 1)}°C
                          </strong>
                        </span>
                      )}
                      {a.bhi != null && (
                        <span>
                          BHI:{' '}
                          <strong style={{ color: a.bhi > 50 ? '#FF2D55' : '#00E8A0' }}>
                            {Math.round(a.bhi)}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions: Acknowledge, Mute */}
                  <div className={styles.alertActions}>
                    {!a.acknowledged ? (
                      <button
                        className={styles.alertActionBtn}
                        disabled={ackBusy === a.id}
                        onClick={() => acknowledge(a.id)}
                        style={{
                          background: 'rgba(0, 232, 160, 0.1)',
                          borderColor: 'rgba(0, 232, 160, 0.3)',
                          color: '#00E8A0',
                        }}
                      >
                        <Check size={11} /> {ackBusy === a.id ? 'Saving...' : 'Acknowledge'}
                      </button>
                    ) : (
                      <span className={styles.alertAck}>Acknowledged</span>
                    )}

                    {isCritical(a.severity) ? (
                      <span
                        className={styles.alertAck}
                        style={{
                          background: 'rgba(255, 45, 85, 0.15)',
                          color: '#ff7d94',
                        }}
                        title="Critical safety alarms cannot be muted"
                      >
                        Critical (Non-Mutable)
                      </span>
                    ) : muted ? (
                      <button
                        className={`${styles.alertActionBtn} ${styles.muted}`}
                        onClick={() => handleUnmute(a.id)}
                      >
                        <Volume2 size={11} /> Unmute
                      </button>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          className={styles.alertActionBtn}
                          onClick={() => handleMute(a.id, 1)}
                          title="Mute similar alerts for 1 Hour"
                        >
                          <VolumeX size={11} /> Mute 1H
                        </button>
                        <button
                          className={styles.alertActionBtn}
                          onClick={() => handleMute(a.id, 24)}
                          title="Mute similar alerts for 24 Hours"
                        >
                          Mute 24H
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
