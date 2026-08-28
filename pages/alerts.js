import { useEffect, useState } from 'react'
import Layout from '../src/components/Layout'
import AlertsList from '../src/components/AlertsList'
import { useRealTimeData } from '../src/hooks/useRealTimeData'
import styles from '../src/styles/pages.module.css'

const FILTERS = ['all', 'safe', 'caution', 'warning', 'critical']

export default function AlertsPage() {
  const { connected, data } = useRealTimeData()
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const load = (f = filter) => {
    setLoading(true)
    const q = f === 'all' ? '' : `&severity=${f}`
    fetch(`/api/alerts?limit=100${q}`)
      .then((r) => r.json())
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [data])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(filter) }, [filter])

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
