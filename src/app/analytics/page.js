'use client'

import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import MetricCard from '../../components/MetricCard'
import HealthScore from '../../components/HealthScore'
import RealtimeGraphs from '../../components/RealtimeGraphs'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { normalizeTelemetry, formatNumber, safetyColor, safetyLabel, bhiStatus, exportToCSV } from '../../lib/utils'
import { FileSpreadsheet } from 'lucide-react'
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
  const cycles = live?.battery?.cycles ?? live?.cycles

  const normalizedHistory = useMemo(() => {
    return normalizeTelemetry(history)
  }, [history])

  const handleExportCSV = () => {
    exportToCSV(normalizedHistory, `telemetry_analytics_${Date.now()}.csv`)
  }

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
      color: 'var(--state-caution)',
      subtext: 'Safe: 10.5V - 14.4V',
    },
    {
      title: 'Current Flow',
      value: formatNumber(current, 2),
      unit: 'A',
      color: current < 0 ? 'var(--state-critical)' : 'var(--state-safe)',
      subtext: current < 0 ? 'Discharging' : 'Charging',
    },
    {
      title: 'Cell Temp',
      value: formatNumber(temp, 1),
      unit: '°C',
      color: 'var(--state-critical)',
      subtext: 'Threshold < 50°C',
    },
    {
      title: 'SOC',
      value: formatNumber(soc, 0),
      unit: '%',
      color: 'var(--state-safe)',
      subtext: 'State of Charge',
    },
    {
      title: 'SOH',
      value: formatNumber(soh, 0),
      unit: '%',
      color: 'var(--state-info)',
      subtext: 'State of Health',
    },
    {
      title: 'Internal Res.',
      value: formatNumber(ir, 2),
      unit: 'mΩ',
      color: 'var(--purple)',
      subtext: 'Degradation Metric',
    },
  ]

  return (
    <Layout connected={connected} lastSeen={data?.timestamp || data?.receivedAt} data={data}>
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

        <button
          onClick={handleExportCSV}
          className={styles.filterBtn}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
        >
          <FileSpreadsheet size={15} color="var(--accent-primary)" />
          <span>Export Graph CSV</span>
        </button>
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

      {/* L2 - Gamified Health Score (count-up + letter grade from real SOH/cycles/temp) */}
      <div style={{ marginBottom: 20, maxWidth: 620 }}>
        <HealthScore soh={soh} cycles={cycles} temperature={temp} />
      </div>

      {/* Complete 8 Real-Time Graphs Suite */}
      <RealtimeGraphs rawData={normalizedHistory} liveState={live} />

      <div className={styles.note} style={{ marginTop: 20 }}>
        Graphs update in real-time as samples arrive from the ESP32 via Firebase. Min/Max safety thresholds are
        calculated dynamically according to the active battery chemistry profile.
      </div>
    </Layout>
  )
}
