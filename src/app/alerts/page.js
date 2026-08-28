'use client'
import { useCallback, useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import AlertsList from '../../components/AlertsList'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import styles from '../../styles/pages.module.css'

const FILTERS = ['all', 'safe', 'caution', 'warning', 'critical']

export default function AlertsPage() {
  const { connected, data } = useRealTimeData()
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const load = useCallback((f = filter) => {
    setLoading(true)
    const q = f === 'all' ? '' : `&severity=${f}`
    fetch(`/api/alerts?limit=100${q}`)
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [data, load])

  return (
    <Layout connected={connected}>
      <h1 className={styles.pageTitle}>Alerts</h1>

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <AlertsList alerts={alerts} loading={loading} />
    </Layout>
  )
}
