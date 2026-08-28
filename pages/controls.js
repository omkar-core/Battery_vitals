import { useEffect, useState } from 'react'
import Layout from '../src/components/Layout'
import ControlPanel from '../src/components/ControlPanel'
import { useRealTimeData } from '../src/hooks/useRealTimeData'
import styles from '../src/styles/pages.module.css'

export default function Controls() {
  const { connected, data, sendControl } = useRealTimeData()
  const [commands, setCommands] = useState({ auto_mode: true })
  const [history, setHistory] = useState([])
  const [latency, setLatency] = useState(null)

  useEffect(() => {
    fetch('/api/control').then((r) => r.json()).then(setCommands).catch(() => {})
    fetch('/api/commands').then((r) => r.json()).then(setHistory).catch(() => {})
  }, [])

  const handleControl = async (name) => {
    const t0 = performance.now()
    await sendControl(name)
    setLatency(Math.round(performance.now() - t0))
    const cmd = await fetch('/api/control').then((r) => r.json())
    setCommands(cmd)
    setHistory((prev) => [{ name, time: new Date().toISOString() }, ...prev].slice(0, 20))
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
              <div key={i} className={styles.commandItem}>
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
