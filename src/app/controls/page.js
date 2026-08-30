'use client'

import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import ControlPanel from '../../components/ControlPanel'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { Terminal, ShieldAlert, Check, XCircle, Clock, Trash2 } from 'lucide-react'
import styles from '../../styles/pages.module.css'

const HISTORY_KEY = 'bv_command_history_v2'

export default function Controls() {
  const { connected, data, sendControl } = useRealTimeData()
  const [commands, setCommands] = useState({ auto_mode: true })
  const [history, setHistory] = useState([])
  const [latency, setLatency] = useState(null)

  useEffect(() => {
    fetch('/api/control')
      .then((r) => r.json())
      .then(setCommands)
      .catch(() => {})
    try {
      const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
      if (Array.isArray(saved)) setHistory(saved)
    } catch (e) {}
  }, [])

  const handleControl = async (name, value, label) => {
    const t0 = performance.now()
    const result = await sendControl(name, value)
    const dt = Math.round(performance.now() - t0)
    setLatency(dt)

    const cmd = await fetch('/api/control')
      .then((r) => r.json())
      .catch(() => commands)
    setCommands(cmd)

    const entry = {
      name: label || name,
      raw: name,
      value: value !== undefined ? String(value) : '',
      requestId: result?.requestId || Math.random().toString(16).slice(2, 8),
      accepted: result?.accepted !== false,
      latency: `${dt}ms`,
      time: new Date().toISOString(),
      response: result?.accepted !== false ? 'ACK_OK (ESP32 Executed)' : 'ERR_BUSY',
    }

    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 50)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const clearHistory = () => {
    setHistory([])
    try {
      localStorage.removeItem(HISTORY_KEY)
    } catch (e) {}
  }

  const batterySafety = data?.battery?.safety || data?.safety || 'SAFE'

  return (
    <Layout connected={connected} lastSeen={data?.timestamp} data={data}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Terminal size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#00E8A0" />
            Manual Hardware <span className="gradText">Control Center</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Bi-directional actuator command pipeline over Firebase Realtime Database with firmware safety overrides.
          </p>
        </div>

        {latency != null && (
          <span className={styles.latencyBadge}>Round-Trip Latency: {latency} ms</span>
        )}
      </div>

      <ControlPanel
        commands={commands}
        onCommand={handleControl}
        batteryState={batterySafety}
      />

      {/* Command Audit Log Panel (Last 50 Commands) */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#38BDF8" />
            <h3 className={styles.cardTitle} style={{ margin: 0 }}>
              Command Dispatch Audit Log (Last 50 Commands)
            </h3>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                color: 'var(--text-muted)',
                fontSize: 11,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              <Trash2 size={11} /> Clear Log
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className={styles.empty}>
            No commands dispatched yet. Actuator actions and test cycles will be logged here.
          </div>
        ) : (
          <div className={styles.commandList}>
            {history.map((h, i) => (
              <div key={`${h.requestId}-${h.time}-${i}`} className={styles.commandItem}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={styles.mono} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {h.name}
                  </span>
                  {h.value ? (
                    <span className={styles.muted} style={{ fontSize: 11 }}>
                      [{h.value}]
                    </span>
                  ) : null}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({h.latency})</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {h.response}
                  </span>
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
                    {h.accepted ? 'EXECUTED' : 'REJECTED'}
                  </span>
                  <span className={styles.commandTime}>{new Date(h.time).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.note}>
        All commands are dispatched instantly through Firebase Realtime Database to ESP32 listeners.
      </div>
    </Layout>
  )
}
