'use client'
import { useEffect, useState } from 'react'
import { Bell, Check, VolumeX } from 'lucide-react'
import styles from './components.module.css'

const SEVERITY_COLOR = {
  CRITICAL: '#FF2D55',
  EMERGENCY: '#FF2D55',
  WARNING: '#FF6B35',
  CAUTION: '#FFD60A',
  INFO: '#38BDF8',
  SAFE: '#00E8A0',
}

const MUTE_KEY = 'bv_muted_alerts'

function readMuted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(MUTE_KEY) || '[]'))
  } catch (e) {
    return new Set()
  }
}

export default function AlertsList({ alerts = [], loading }) {
  const [filter, setFilter] = useState('all')
  const [muted, setMuted] = useState([])
  const [ackBusy, setAckBusy] = useState(null)

  useEffect(() => {
    setMuted(readMuted())
  }, [])

  const toggleMute = (id, severity) => {
    setMuted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem(MUTE_KEY, JSON.stringify([...next])) } catch (e) { /* ignore */ }
      return next
    })
  }

  const acknowledge = async (id) => {
    setAckBusy(id)
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, acknowledged: true }),
      })
    } catch (e) { /* ignore */ }
    setAckBusy(null)
  }

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'ERROR', label: 'Critical' },
    { key: 'WARNING', label: 'Warnings' },
    { key: 'INFO', label: 'Info' },
  ]

  const isCritical = (sev) => {
    const s = (sev || '').toUpperCase()
    return s === 'CRITICAL' || s === 'EMERGENCY'
  }

  const visible = alerts.filter((a) => {
    const sev = (a.severity || 'INFO').toUpperCase()
    if (filter === 'ERROR') return isCritical(a.severity)
    if (filter === 'WARNING') return sev === 'WARNING' || sev === 'CAUTION'
    if (filter === 'INFO') return sev === 'INFO' || sev === 'SAFE'
    return true
  })

  return (
    <div className={styles.alertsCard}>
      <div className={styles.aiHeader}>
        <Bell size={16} color="#FFD60A" />
        <h3 className={styles.panelTitle}>Alerts</h3>
      </div>

      <div className={styles.alertFilters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              border: filter === f.key ? '1px solid rgba(255,45,85,0.5)' : '1px solid var(--border)',
              background: filter === f.key ? 'rgba(255,45,85,0.12)' : 'rgba(255,255,255,0.03)',
              color: filter === f.key ? '#ff7d94' : 'var(--text-secondary)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className={styles.aiEmpty}>
          {loading ? 'Loading alerts...' : 'No alerts match this filter.'}
        </div>
      ) : (
        <div className={styles.alertsList}>
          {visible.map((a) => {
            const sev = (a.severity || 'INFO').toUpperCase()
            const color = SEVERITY_COLOR[sev] || '#94A3B8'
            const isMuted = muted.includes(a.id)
            const dimmed = isMuted || a.acknowledged
            const unread = !a.acknowledged && !isMuted
            return (
              <div
                key={a.id}
                className={`${styles.alertItem} ${dimmed ? styles.dimmed : ''} ${unread ? styles.unread : ''}`}
              >
                <span className={styles.alertSeverity} style={{ background: color }} />
                <div className={styles.alertBody}>
                  <div className={styles.alertTop}>
                    <span className={styles.alertType} style={{ color }}>{a.severity || 'INFO'}</span>
                    <span className={styles.alertTime}>
                      {a.time ? new Date(a.time).toLocaleTimeString() : '--'}
                    </span>
                  </div>
                  <div className={styles.alertMsg}>{a.message || a.type || 'Alert'}</div>
                  <div className={styles.alertActions}>
                    {!a.acknowledged && (
                      <button
                        className={styles.alertActionBtn}
                        disabled={ackBusy === a.id}
                        onClick={() => acknowledge(a.id)}
                      >
                        <Check size={11} /> Ack
                      </button>
                    )}
                    {isCritical(a.severity) ? (
                      <span className={styles.alertAck} style={{ background: '#FF2D5522', color: '#ff7d94' }}>
                        Always-on
                      </span>
                    ) : (
                      <button
                        className={`${styles.alertActionBtn} ${isMuted ? styles.muted : ''}`}
                        onClick={() => toggleMute(a.id, sev)}
                      >
                        <VolumeX size={11} /> {isMuted ? 'Unmute' : 'Mute'}
                      </button>
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
