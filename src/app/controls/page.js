'use client'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import ControlPanel from '../../components/ControlPanel'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { Terminal } from 'lucide-react'
import styles from '../../styles/pages.module.css'

const HISTORY_KEY = 'bv_command_history'

export default function Controls() {
  const { connected, data, sendControl } = useRealTimeData()
  const [commands, setCommands] = useState({ auto_mode: true })
  const [history, setHistory] = useState([])
  const [latency, setLatency] = useState(null)

  useEffect(() => {
    fetch('/api/control').then((r) => r.json()).then(setCommands).catch(() => {})
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      if (Array.isArray(saved)) setHistory(saved)
    } catch (e) { /* ignore */ }
  }, [])

  const handleControl = async (name, value, label) => {
    const t0 = performance.now()
    const result = await sendControl(name, value)
    setLatency(Math.round(performance.now() - t0))
    const cmd = await fetch('/api/control').then((r) => r.json()).catch(() => commands)
    setCommands(cmd)
    const entry = {
      name: label || name,
      raw: name,
      value,
      requestId: result?.requestId,
      accepted: result?.accepted !== false,
      time: new Date().toISOString(),
    }
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 30)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch (e) { /* ignore */ }
      return next
    })
  }

  return (
    <Layout connected={connected}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <Terminal size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#00E8A0" />
          <span className="gradText">Control</span> Center
        </h1>
        {latency != null && (
          <span className={styles.latencyBadge}>API Latency: {latency} ms</span>
        )}
      </div>

      <ControlPanel commands={commands} onCommand={handleControl} />

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Command Audit Log</h3>
        {history.length === 0 ? (
          <div className={styles.empty}>No commands sent yet.</div>
        ) : (
          <div className={styles.commandList}>
            {history.map((h, i) => (
              <div key={`${h.requestId}-${h.time}-${i}`} className={styles.commandItem}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={styles.mono}>{h.name}</span>
                  {h.value ? <span className={styles.muted}>{String(h.value)}</span> : null}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={styles.mono} style={{ fontSize: 10, minWidth: 'auto' }}>
                    #{h.requestId}
                  </span>
                  <span
                    className={styles.severityPill}
                    style={{
                      background: h.accepted ? 'rgba(0,232,160,0.12)' : 'rgba(255,45,85,0.15)',
                      color: h.accepted ? '#00E8A0' : '#FF2D55',
                    }}
                  >
                    {h.accepted ? 'ACCEPTED' : 'REJECTED'}
                  </span>
                  <span className={styles.commandTime}>{new Date(h.time).toLocaleTimeString()}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.note}>
        Every command is logged with a unique request id and its accepted/rejected status. Control
        commands are relayed to the device over MQTT and persisted to the backend.
      </div>
    </Layout>
  )
}
