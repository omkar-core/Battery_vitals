'use client'
import { useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import MetricCard from '../../components/MetricCard'
import TelemetryChart from '../../components/TelemetryChart'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { normalizeTelemetry, formatNumber, safetyColor, safetyLabel, bhiStatus } from '../../lib/utils'
import styles from '../../styles/pages.module.css'

const AGGS = [
  { key: 'raw', label: 'Raw' },
  { key: '1m', label: '1 min' },
  { key: '15m', label: '15 min' },
  { key: '1h', label: '1 hour' },
]

const BHI_BANDS = [
  { from: 30, to: 55, color: '#FFD60A', opacity: 0.07 },
  { from: 55, to: 75, color: '#FF6B35', opacity: 0.07 },
  { from: 75, to: 100, color: '#FF2D55', opacity: 0.08 },
]

export default function Analytics() {
  const { data, history, connected } = useRealTimeData()
  const [agg, setAgg] = useState('raw')

  const rows = useMemo(() => {
    const raw = normalizeTelemetry(history)
    if (agg === 'raw') return raw
    const bucketMs = agg === '1m' ? 60000 : agg === '15m' ? 900000 : 3600000
    const buckets = new Map()
    for (const r of raw) {
      const b = Math.floor(r.time / bucketMs) * bucketMs
      if (!buckets.has(b)) buckets.set(b, [])
      buckets.get(b).push(r)
    }
    const acc = (arr, key) => {
      const vals = arr.map((r) => r[key]).filter((v) => v != null)
      if (vals.length === 0) return undefined
      return vals.reduce((s, v) => s + v, 0) / vals.length
    }
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([t, arr]) => ({
      time: t,
      voltage: acc(arr, 'voltage'),
      current: acc(arr, 'current'),
      power: acc(arr, 'power'),
      soc: acc(arr, 'soc'),
      soh: acc(arr, 'soh'),
      temperature: acc(arr, 'temperature'),
      humidity: acc(arr, 'humidity'),
      gasMq2: acc(arr, 'gasMq2'),
      gasMq135: acc(arr, 'gasMq135'),
      bhi: acc(arr, 'bhi'),
      resistance: acc(arr, 'resistance'),
    }))
  }, [history, agg])

  const live = data
  const bhi = live?.risk?.bhi ?? live?.bhi
  const safety = live?.battery?.safety ?? live?.safety ?? 'SAFE'

  const stats = [
    { title: 'Current BHI', value: bhi == null ? '--' : formatNumber(bhi, 0), unit: '/100', color: bhiStatus(bhi).color },
    { title: 'Safety', value: safetyLabel(safety), unit: '', color: safetyColor(safety) },
    { title: 'SOC', value: formatNumber(live?.battery?.soc ?? live?.soc, 0), unit: '%', color: '#00E8A0' },
    { title: 'SOH', value: formatNumber(live?.battery?.soh ?? live?.soh, 0), unit: '%', color: '#38BDF8' },
    { title: 'IR', value: formatNumber(live?.battery?.resistance, 2), unit: 'mΩ', color: '#A78BFA' },
    { title: 'Cycles', value: formatNumber(live?.battery?.cycles, 0), unit: '', color: '#F472B6' },
    { title: 'RUL', value: live?.battery?.rul != null ? formatNumber(live.battery.rul, 0) : '--', unit: 'days', color: '#00E8A0' },
    { title: 'Efficiency', value: formatNumber(live?.battery?.efficiency, 0), unit: '%', color: '#FFD60A' },
  ]

  const ChartPanel = ({ title, legend, children, full }) => (
    <div className={`${styles.chartPanel} ${full ? styles.chartFull : ''}`}>
      <div className={styles.chartPanelHeader}>
        <span className={styles.chartPanelTitle}>{title}</span>
        {legend && (
          <div className={styles.chartLegend}>
            {legend.map((l) => (
              <span key={l.label} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  )

  const voltageColor = '#00E8A0'
  const currentColor = '#FF6B35'
  const powerColor = '#38BDF8'
  const tempColor = '#FF2D55'
  const humColor = '#00BFFF'
  const gasColor = '#A78BFA'

  return (
    <Layout connected={connected}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          <span className="gradText">Analytics</span> &amp; Trends
        </h1>
        <div className={styles.toolbar}>
          {AGGS.map((a) => (
            <button
              key={a.key}
              className={`${styles.filterBtn} ${agg === a.key ? styles.filterActive : ''}`}
              onClick={() => setAgg(a.key)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.metricsGrid}>
        {stats.map((s) => (
          <MetricCard key={s.title} title={s.title} value={s.value} unit={s.unit} color={s.color} />
        ))}
      </div>

      <div className={styles.chartGrid}>
        <ChartPanel
          title="Voltage Trend"
          full
          legend={[{ label: 'Voltage (V)', color: voltageColor }]}
        >
          <TelemetryChart
            data={rows}
            showArea
            series={[{ key: 'voltage', color: voltageColor, label: 'Voltage' }]}
            height={220}
          />
        </ChartPanel>

        <ChartPanel
          title="Current (charge + / discharge −)"
          legend={[{ label: 'Current (A)', color: currentColor }]}
        >
          <TelemetryChart
            data={rows}
            series={[{ key: 'current', color: currentColor }]}
            height={190}
          />
        </ChartPanel>

        <ChartPanel
          title="Power"
          legend={[{ label: 'Power (W)', color: powerColor }]}
        >
          <TelemetryChart
            data={rows}
            showArea
            series={[{ key: 'power', color: powerColor }]}
            height={190}
          />
        </ChartPanel>

        <ChartPanel
          title="SOC"
          legend={[{ label: 'SOC (%)', color: '#00E8A0' }]}
        >
          <TelemetryChart
            data={rows}
            series={[{ key: 'soc', color: '#00E8A0' }]}
            height={180}
            yDomain={[0, 100]}
          />
        </ChartPanel>

        <ChartPanel
          title="SOH Trend"
          legend={[{ label: 'SOH (%)', color: '#38BDF8' }]}
        >
          <TelemetryChart
            data={rows}
            series={[{ key: 'soh', color: '#38BDF8' }]}
            height={180}
            yDomain={[0, 100]}
          />
        </ChartPanel>

        <ChartPanel
          title="Temperature + Humidity"
          full
          legend={[
            { label: 'Temp (°C)', color: tempColor },
            { label: 'Humidity (%)', color: humColor },
          ]}
        >
          <TelemetryChart
            data={rows}
            series={[
              { key: 'temperature', color: tempColor },
              { key: 'humidity', color: humColor },
            ]}
            height={190}
          />
        </ChartPanel>

        <ChartPanel
          title="Gas Index — MQ-2 (combustible) & MQ-135 (VOC)"
          legend={[
            { label: 'MQ-2', color: '#FF6B35' },
            { label: 'MQ-135', color: '#A78BFA' },
          ]}
        >
          <TelemetryChart
            data={rows}
            series={[
              { key: 'gasMq2', color: '#FF6B35' },
              { key: 'gasMq135', color: '#A78BFA' },
            ]}
            height={190}
          />
        </ChartPanel>

        <ChartPanel
          title="Internal Resistance (aging indicator)"
          legend={[{ label: 'IR (mΩ)', color: '#00E8A0' }]}
        >
          <TelemetryChart
            data={rows}
            showArea
            series={[{ key: 'resistance', color: '#00E8A0' }]}
            height={190}
          />
        </ChartPanel>

        <ChartPanel
          title="BHI Risk Score — with threshold bands"
          full
          legend={[
            { label: 'BHI', color: '#FFD60A' },
            { label: 'Caution', color: '#FFD60A' },
            { label: 'Warning', color: '#FF6B35' },
            { label: 'Critical', color: '#FF2D55' },
          ]}
        >
          <TelemetryChart
            data={rows}
            showArea
            series={[{ key: 'bhi', color: '#FFD60A' }]}
            bands={BHI_BANDS}
            height={220}
          />
        </ChartPanel>
      </div>

      <div className={styles.note}>
        Data sourced from {connected ? 'the live sensor stream' : 'latest readings'}. Use the
        aggregation buttons to view longer-term averages. Threshold bands on the BHI chart mark the
        caution / warning / critical zones.
      </div>
    </Layout>
  )
}
