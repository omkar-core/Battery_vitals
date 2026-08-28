'use client'
import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import MetricCard from '../../components/MetricCard'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { formatNumber } from '../../lib/utils'
import styles from '../../styles/pages.module.css'

export default function HistoryPage() {
  const { connected } = useRealTimeData()
  const [rows, setRows] = useState([])
  const [minutes, setMinutes] = useState(120)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/history?minutes=${minutes}&limit=2000`)
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [minutes, connected])

  const stats = useMemo(() => {
    if (!rows.length) return { peakV: '--', avgT: '--', peakI: '--' }
    const vs = rows.map((r) => r.voltage).filter((v) => v != null)
    const ts = rows.map((r) => r.temperature).filter((v) => v != null)
    const is = rows.map((r) => r.current).filter((v) => v != null)
    return {
      peakV: vs.length ? Math.max(...vs).toFixed(2) : '--',
      avgT: ts.length ? (ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1) : '--',
      peakI: is.length ? Math.max(...is.map(Math.abs)).toFixed(2) : '--',
    }
  }, [rows])

  return (
    <Layout connected={connected}>
      <h1 className={styles.pageTitle}>History</h1>

      <div className={styles.toolbar}>
        <select className={styles.select} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          <option value={15}>Last 15 min</option>
          <option value={60}>Last hour</option>
          <option value={120}>Last 2 hours</option>
          <option value={360}>Last 6 hours</option>
          <option value={1440}>Last 24 hours</option>
        </select>
        <span className={styles.muted}>{rows.length} reading{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className={styles.metricsGrid}>
        <MetricCard title="Peak Voltage" value={stats.peakV} unit="V" color="#00BFFF" />
        <MetricCard title="Avg Temperature" value={stats.avgT} unit="Â°C" color="#FF2D55" />
        <MetricCard title="Peak Current" value={stats.peakI} unit="A" color="#FFD60A" />
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Stored Readings</h3>
        {loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>No history available yet. Data will appear after the device has been running.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Voltage</th>
                  <th>Current</th>
                  <th>Power</th>
                  <th>SOC</th>
                  <th>Temp</th>
                  <th>BHI</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice().reverse().map((r, i) => (
                  <tr key={r.id || i}>
                    <td>{r.time ? new Date(r.time).toLocaleString() : '--'}</td>
                    <td>{formatNumber(r.voltage)}</td>
                    <td>{formatNumber(r.current)}</td>
                    <td>{formatNumber(r.power)}</td>
                    <td>{formatNumber(r.soc, 0)}%</td>
                    <td>{formatNumber(r.temperature, 1)}</td>
                    <td>{formatNumber(r.bhi, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
