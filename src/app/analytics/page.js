'use client'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import LiveChart from '../../components/LiveChart'
import MetricCard from '../../components/MetricCard'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { formatNumber, safetyLabel, safetyColor, bhiStatus } from '../../lib/utils'
import styles from '../../styles/pages.module.css'

export default function Analytics() {
  const { data, history, connected } = useRealTimeData()
  const [minutes, setMinutes] = useState(30)

  const bhi = data?.risk?.bhi ?? data?.bhi
  const bhiState = bhiStatus(bhi)

  const stats = [
    { title: 'Current BHI', value: bhi == null ? '--' : formatNumber(bhi, 0), color: bhiState.color, unit: '/100' },
    { title: 'Safety', value: safetyLabel(data?.battery?.safety ?? data?.safety ?? 'SAFE'), color: safetyColor(data?.battery?.safety ?? data?.safety ?? 'SAFE'), unit: '' },
    { title: 'SOC', value: formatNumber(data?.battery?.soc ?? data?.soc, 0), color: '#00E8A0', unit: '%' },
    { title: 'SOH', value: formatNumber(data?.battery?.soh ?? data?.soh, 0), color: '#00BFFF', unit: '%' },
  ]

  return (
    <Layout connected={connected}>
      <h1 className={styles.pageTitle}>Analytics</h1>
      <div className={styles.metricsGrid}>
        {stats.map((s) => (
          <MetricCard key={s.title} title={s.title} value={s.value} unit={s.unit} color={s.color} />
        ))}
      </div>
      <LiveChart data={history} series={['voltage', 'current', 'bhi']} />
      <div className={styles.note}>Data sourced from {connected ? 'live sensor stream' : 'latest readings'}.</div>
    </Layout>
  )
}
