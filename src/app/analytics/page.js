'use client'

import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import MetricCard from '../../components/MetricCard'
import RealtimeGraphs from '../../components/RealtimeGraphs'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { normalizeTelemetry, formatNumber, safetyColor, safetyLabel, bhiStatus } from '../../lib/utils'
import styles from '../../styles/pages.module.css'

export default function Analytics() {
  const { data, history, connected } = useRealTimeData()

  const live = data
  const bhi = live?.risk?.bhi ?? live?.bhi
  const safety = live?.battery?.safety ?? live?.safety ?? 'SAFE'
  const voltage = live?.battery?.voltage ?? live?.voltage
  const current = live?.battery?.current ?? live?.current
  const temp = live?.environment?.temperature ?? live?.temperature
  const soc = live?.battery?.soc ?? live?.soc
  const soh = live?.battery?.soh ?? live?.soh
  const ir = live?.battery?.resistance ?? live?.resistance

  const stats = [
    {
      title: 'Current BHI',
      value: bhi == null ? '--' : formatNumber(bhi, 0),
      unit: '/100',
      color: bhiStatus(bhi).color,
      subtext: bhiStatus(bhi).label,
    },
    {
      title: 'Safety State',
      value: safetyLabel(safety),
      unit: '',
      color: safetyColor(safety),
      subtext: 'Hardware Interlock',
    },
    {
      title: 'Voltage',
      value: formatNumber(voltage, 2),
      unit: 'V',
      color: '#FFD60A',
      subtext: 'Safe: 10.5V - 14.4V',
    },
    {
      title: 'Current Flow',
      value: formatNumber(current, 2),
      unit: 'A',
      color: current < 0 ? '#FF6B35' : '#00E8A0',
      subtext: current < 0 ? 'Discharging' : 'Charging',
    },
    {
      title: 'Cell Temp',
      value: formatNumber(temp, 1),
      unit: '°C',
      color: '#FF2D55',
      subtext: 'Threshold < 50°C',
    },
    {
      title: 'SOC',
      value: formatNumber(soc, 0),
      unit: '%',
      color: '#00E8A0',
      subtext: 'State of Charge',
    },
    {
      title: 'SOH',
      value: formatNumber(soh, 0),
      unit: '%',
      color: '#38BDF8',
      subtext: 'State of Health',
    },
    {
      title: 'Internal Res.',
      value: formatNumber(ir, 2),
      unit: 'mΩ',
      color: '#A78BFA',
      subtext: 'Degradation Metric',
    },
  ]

  const normalizedHistory = useMemo(() => {
    return normalizeTelemetry(history)
  }, [history])

  return (
    <Layout connected={connected} lastSeen={data?.timestamp || data?.receivedAt}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            Real-Time <span className="gradText">Graphs &amp; Sensor Analytics</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Comprehensive 8-stream visualization suite with tolerance bands, direction vectors, and
            degradation tracking.
          </p>
        </div>
      </div>

      {/* Snapshot Vitals Grid */}
      <div className={styles.metricsGrid}>
        {stats.map((s) => (
          <MetricCard
            key={s.title}
            title={s.title}
            value={s.value}
            unit={s.unit}
            color={s.color}
            subtext={s.subtext}
          />
        ))}
      </div>

      {/* Complete 8 Real-Time Graphs Suite */}
      <RealtimeGraphs rawData={normalizedHistory} liveState={live} />

      <div className={styles.note} style={{ marginTop: 20 }}>
        Graphs update in real-time as samples arrive over MQTT. Min/Max safety thresholds are
        calculated dynamically according to the active battery chemistry profile.
      </div>
    </Layout>
  )
}
