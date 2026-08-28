'use client'
import { useCallback, useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import AlertsList from '../../components/AlertsList'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { BellRing } from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function AlertsPage() {
  const { connected, data } = useRealTimeData()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/alerts?limit=100')
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [data, load])

  const counts = alerts.reduce((acc, a) => {
    const sev = (a.severity || 'INFO').toUpperCase()
    acc[sev] = (acc[sev] || 0) + 1
    return acc
  }, {})
  const unacked = alerts.filter((a) => !a.acknowledged).length

  return (
    <Layout connected={connected}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <BellRing size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#FFD60A" />
          <span className="gradText">Alerts</span> &amp; Notification Center
        </h1>
        <div className={styles.toolbar}>
          <span className="chip"><BellRing size={12} /> {alerts.length} total</span>
          <span className="chip"><BellRing size={12} /> {unacked} unacknowledged</span>
          {counts.CRITICAL ? (
            <span className="chip" style={{ color: '#FF2D55', borderColor: 'rgba(255,45,85,0.5)' }}>
              {counts.CRITICAL} critical
            </span>
          ) : null}
        </div>
      </div>

      <AlertsList alerts={alerts} loading={loading} />

      <div className={styles.note}>
        Acknowledge an alert to mark it read. Muting suppresses display for non-critical alerts only —
        CRITICAL / EMERGENCY alerts are always shown. Mutes are stored locally in your browser.
      </div>
    </Layout>
  )
}
