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
  const { data, history, connected, isDisconnected } = useRealTimeData()
  const { profile: activeProfile, voltageBand } = useActiveProfile(data?.batteryId)

  const live = data
  const bhi = isDisconnected ? null : (live?.risk?.bhi ?? live?.bhi)
  const safety = isDisconnected ? 'DISCONNECTED' : (live?.battery?.safety ?? live?.safety ?? 'SAFE')
  const voltage = isDisconnected ? 0 : (live?.battery?.voltage ?? live?.voltage ?? 0)
  const current = isDisconnected ? 0 : (live?.battery?.current ?? live?.current ?? 0)
  const temp = isDisconnected ? null : (live?.environment?.temperature ?? live?.temperature)
  const soc = isDisconnected ? 0 : (live?.battery?.soc ?? live?.soc ?? 0)
  const soh = isDisconnected ? null : (live?.battery?.soh ?? live?.soh)
  const ir = isDisconnected ? null : (live?.battery?.resistance ?? live?.resistance)
  const cycles = isDisconnected ? 0 : (live?.battery?.cycles ?? live?.cycles ?? 0)

  const normalizedHistory = useMemo(() => {
    return normalizeTelemetry(history)
  }, [history])

  const handleExportCSV = () => {
    exportToCSV(normalizedHistory, `telemetry_analytics_${Date.now()}.csv`)
  }

  const stats = [
    {
      title: 'Current BHI',
      value: bhi == null ? 'N/A' : formatNumber(bhi, 0),
      unit: bhi == null ? '' : '/100',
      color: bhiStatus(bhi).color,
      subtext: isDisconnected ? 'ESP32 Disconnected' : bhiStatus(bhi).label,
    },
    {
      title: 'Safety State',
      value: safetyLabel(safety),
      unit: '',
      color: safetyColor(safety),
      subtext: isDisconnected ? 'Offline' : 'Hardware Interlock',
    },
    {
      title: 'Voltage',
      value: isDisconnected ? '0.00' : formatNumber(voltage, 2),
      unit: 'V',
      color: isDisconnected ? 'var(--text-muted)' : 'var(--state-caution)',
      subtext: isDisconnected ? 'Offline' : (voltageBand ? `Safe: ${voltageBand}` : 'Auto-detected'),
    },
    {
      title: 'Current Flow',
      value: isDisconnected ? '0.00' : formatNumber(current, 2),
      unit: 'A',
      color: isDisconnected ? 'var(--text-muted)' : (current < 0 ? 'var(--state-critical)' : 'var(--state-safe)'),
      subtext: isDisconnected ? 'Standby' : (current < 0 ? 'Discharging' : 'Charging'),
    },
    {
      title: 'Cell Temp',
      value: temp == null ? 'N/A' : formatNumber(temp, 1),
      unit: temp == null ? '' : '°C',
      color: isDisconnected ? 'var(--text-muted)' : 'var(--state-critical)',
      subtext: isDisconnected ? 'Sensor Offline' : 'Threshold < 50°C',
    },
    {
      title: 'SOC',
      value: isDisconnected ? '0' : formatNumber(soc, 0),
      unit: '%',
      color: isDisconnected ? 'var(--text-muted)' : 'var(--state-safe)',
      subtext: 'State of Charge',
    },
    {
      title: 'SOH',
      value: soh == null ? 'N/A' : formatNumber(soh, 0),
      unit: soh == null ? '' : '%',
      color: isDisconnected ? 'var(--text-muted)' : 'var(--state-info)',
      subtext: 'State of Health',
    },
    {
      title: 'Internal Res.',
      value: ir == null ? 'N/A' : formatNumber(ir, 2),
      unit: ir == null ? '' : 'mΩ',
      color: isDisconnected ? 'var(--text-muted)' : 'var(--purple)',
      subtext: 'Degradation Metric',
    },
  ]

  const [aiSummary, setAiSummary] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handleGenerateAISummary = async () => {
    if (!data?.batteryId) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batteryId: data.batteryId, period: 'weekly' }),
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
