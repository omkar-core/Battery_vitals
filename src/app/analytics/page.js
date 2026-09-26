'use client'

import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import MetricCard from '../../components/MetricCard'
import HealthScore from '../../components/HealthScore'
import RealtimeGraphs from '../../components/RealtimeGraphs'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { useActiveProfile } from '../../hooks/useActiveProfile'
import { normalizeTelemetry, formatNumber, safetyColor, safetyLabel, bhiStatus, exportToCSV } from '../../lib/utils'
import styles from '../../styles/pages.module.css'

export default function Analytics() {
  const { data, history, connected } = useRealTimeData()
  const { profile: activeProfile, voltageBand } = useActiveProfile(data?.batteryId || 'BAT001')

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
      subtext: voltageBand ? `Safe: ${voltageBand}` : 'Deploy a profile for band',
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

  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handleGenerateAISummary = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batteryId: data?.batteryId || 'BAT001', period: 'weekly' }),
      })
      const json = await res.json()
      if (res.ok && json.narrative) {
        setAiSummary(json)
      }
    } catch (e) {
      console.warn('AI Summary failed:', e.message)
    } finally {
      setAiLoading(false)
    }
  }

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

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleGenerateAISummary}
            disabled={aiLoading}
            className={styles.filterBtn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderColor: 'rgba(191,90,242,0.4)', color: '#BF5AF2' }}
          >
            <span>{aiLoading ? '✨ Summarizing...' : '✨ Generate AI Summary'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className={styles.filterBtn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
          >
            <span style={{ fontSize: 14 }}>📊</span>
            <span>Export Graph CSV</span>
          </button>
        </div>
      </div>

      {/* AI Trend Summary Banner if triggered */}
      {aiSummary && (
        <div style={{ padding: '14px 18px', background: 'var(--bg-surface-raised)', border: '1px solid rgba(191,90,242,0.35)', borderRadius: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#BF5AF2', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              ✨ AI Operating Trend Summary
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Grade: <strong style={{ color: 'var(--accent-primary)' }}>{aiSummary.grade || '--'}</strong>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {aiSummary.narrative}
          </p>
        </div>
      )}

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
      <RealtimeGraphs rawData={normalizedHistory} liveState={live} profileBand={activeProfile?.voltage} />

      <div className={styles.note} style={{ marginTop: 20 }}>
        Graphs update in real-time as samples arrive from the ESP32 via Firebase. Min/Max safety thresholds are
        calculated dynamically according to the active battery chemistry profile.
      </div>
    </Layout>
  )
}
