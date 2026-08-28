'use client'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import ControlPanel from '../../components/ControlPanel'
import { useRealTimeData } from '../../hooks/useRealTimeData'
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

  const handleControl = async (name) => {
    const t0 = performance.now()
    await sendControl(name)
    setLatency(Math.round(performance.now() - t0))
    const cmd = await fetch('/api/control').then((r) => r.json())
    setCommands(cmd)
    const entry = { name, time: new Date().toISOString() }
    setHistory((prev) => {
      const next = [entry, ...prev.filter((h) => h.name !== name)].slice(0, 20)
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch (e) { /* ignore */ }
      return next
    })
  }

  return (
    <Layout connected={connected}>
      <h1 className={styles.pageTitle}>Controls</h1>
      {latency != null && (
        <div className={styles.latencyBadge}>API Latency: {latency} ms</div>
      )}
      <ControlPanel commands={commands} onCommand={handleControl} />

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Command History</h3>
        {history.length === 0 ? (
          <div className={styles.empty}>No commands sent yet</div>
        ) : (
          <div className={styles.commandList}>
            {history.map((h, i) => (
              <div key={`${h.name}-${h.time}-${i}`} className={styles.commandItem}>
                <span>{h.name}</span>
                <span className={styles.commandTime}>{new Date(h.time).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}