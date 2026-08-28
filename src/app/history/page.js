'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '../../components/Layout'
import MetricCard from '../../components/MetricCard'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { formatNumber, exportToCSV, exportToJSON, formatUptime } from '../../lib/utils'
import {
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  FileSpreadsheet,
  FileCode,
  Clock,
  Zap,
  Flame,
  Gauge,
  Activity,
  GitCompare,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

const AGG_OPTIONS = [
  { key: 'raw', label: 'Raw' },
  { key: '1m', label: '1-min Avg' },
  { key: '1h', label: 'Hourly' },
  { key: '1d', label: 'Daily' },
]

export default function HistoryPage() {
  const { connected, data } = useRealTimeData()
  const [rows, setRows] = useState([])
  const [minutes, setMinutes] = useState(1440) // 24 hours default
  const [aggregation, setAggregation] = useState('raw')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('readings') // 'readings', 'sessions', 'timeline', 'compare'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/history?minutes=${minutes}&limit=3000`)
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch('/api/sessions')
      .then((r) => r.json())
      .then((d) => {
        if (d.sessions) setSessions(d.sessions)
      })
      .catch(() => {})
  }, [minutes, connected])

  // Aggregated data computation
  const displayRows = useMemo(() => {
    if (!rows.length || aggregation === 'raw') return rows
    const bucketMs =
      aggregation === '1m' ? 60000 : aggregation === '1h' ? 3600000 : 86400000

    const buckets = new Map()
    for (const r of rows) {
      const t = new Date(r.time).getTime()
      const b = Math.floor(t / bucketMs) * bucketMs
      if (!buckets.has(b)) buckets.set(b, [])
      buckets.get(b).push(r)
    }

    const avg = (arr, key) => {
      const vals = arr.map((x) => x[key]).filter((v) => v != null)
      if (vals.length === 0) return null
      return Number((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2))
    }

    return [...buckets.entries()].map(([t, arr]) => ({
      id: `agg_${t}`,
      time: new Date(t).toISOString(),
      voltage: avg(arr, 'voltage'),
      current: avg(arr, 'current'),
      power: avg(arr, 'power'),
      soc: avg(arr, 'soc'),
      soh: avg(arr, 'soh') || 95,
      temperature: avg(arr, 'temperature'),
      humidity: avg(arr, 'humidity'),
      bhi: avg(arr, 'bhi'),
    }))
  }, [rows, aggregation])

  // Stats summary for the chosen window
  const stats = useMemo(() => {
    if (!rows.length) {
      return { peakV: '--', avgT: '--', peakI: '--', totalEnergy: '--', avgBHI: '--' }
    }
    const vs = rows.map((r) => r.voltage).filter((v) => v != null)
    const ts = rows.map((r) => r.temperature).filter((v) => v != null)
    const is = rows.map((r) => r.current).filter((v) => v != null)
    const bhis = rows.map((r) => r.bhi).filter((v) => v != null)
    const powers = rows.map((r) => r.power).filter((v) => v != null)

    const totalEnergy = powers.length
      ? (powers.reduce((a, b) => a + b, 0) * (minutes / 60 / powers.length)).toFixed(1)
      : '0.0'

    return {
      peakV: vs.length ? Math.max(...vs).toFixed(2) : '--',
      avgT: ts.length ? (ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1) : '--',
      peakI: is.length ? Math.max(...is.map(Math.abs)).toFixed(2) : '--',
      avgBHI: bhis.length ? Math.round(bhis.reduce((a, b) => a + b, 0) / bhis.length) : '--',
      totalEnergy,
    }
  }, [rows, minutes])

  const handleExportCSV = () => {
    exportToCSV(displayRows, `battery_history_${minutes}m_${aggregation}.csv`)
  }

  const handleExportJSON = () => {
    exportToJSON(displayRows, `battery_history_${minutes}m_${aggregation}.json`)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Layout connected={connected} lastSeen={data?.timestamp}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            Historical Data &amp; <span className="gradText">Session Analytics</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Query, filter, aggregate, and export long-term battery telemetry and charge/discharge cycles.
          </p>
        </div>

        {/* Action Buttons: CSV, JSON, Print Report */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleExportCSV} className={styles.filterBtn} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileSpreadsheet size={13} color="#00E8A0" />
            <span>Export CSV</span>
          </button>
          <button onClick={handleExportJSON} className={styles.filterBtn} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FileCode size={13} color="#38BDF8" />
            <span>Export JSON</span>
          </button>
          <button onClick={handlePrint} className={styles.filterBtn} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Printer size={13} color="#FFD60A" />
            <span>Print PDF Report</span>
          </button>
        </div>
      </div>

      {/* Snapshot Summary Cards */}
      <div className={styles.metricsGrid}>
        <MetricCard title="Peak Voltage" value={stats.peakV} unit="V" color="#FFD60A" icon={Gauge} subtext="Selected Window" />
        <MetricCard title="Avg Temperature" value={stats.avgT} unit="°C" color="#FF2D55" icon={Flame} subtext="Thermal Average" />
        <MetricCard title="Peak Current" value={stats.peakI} unit="A" color="#38BDF8" icon={Zap} subtext="Maximum In/Out" />
        <MetricCard title="Avg BHI Risk" value={stats.avgBHI} unit="/100" color="#A78BFA" icon={Activity} subtext="Health Baseline" />
        <MetricCard title="Est. Energy Moved" value={stats.totalEnergy} unit="Wh" color="#00E8A0" icon={Zap} subtext="Energy Throughput" />
      </div>

      {/* Controls: Date Range Selector & Aggregation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: 'rgba(18, 24, 40, 0.65)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Time Range:
          </span>
          {[
            { val: 15, label: '15m' },
            { val: 60, label: '1h' },
            { val: 360, label: '6h' },
            { val: 1440, label: '24h' },
            { val: 10080, label: '7d' },
            { val: 43200, label: '30d' },
          ].map((item) => (
            <button
              key={item.val}
              className={`${styles.filterBtn} ${minutes === item.val ? styles.filterActive : ''}`}
              onClick={() => setMinutes(item.val)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Aggregation:
          </span>
          {AGG_OPTIONS.map((a) => (
            <button
              key={a.key}
              className={`${styles.filterBtn} ${aggregation === a.key ? styles.filterActive : ''}`}
              onClick={() => setAggregation(a.key)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Switcher Tabs: Telemetry Table / Charge-Discharge Sessions / Event Timeline / Comparison */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'readings', label: `Stored Readings (${displayRows.length})` },
          { key: 'sessions', label: `Auto-Detected Sessions (${sessions.length})` },
          { key: 'timeline', label: 'Event & State Timeline' },
          { key: 'compare', label: 'Weekly Benchmark Comparison' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === tab.key ? '1px solid #00E8A0' : '1px solid var(--border)',
              background:
                activeTab === tab.key ? 'rgba(0, 232, 160, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === tab.key ? '#00E8A0' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: READINGS TABLE */}
      {activeTab === 'readings' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Telemetry Records</h3>
            <span className={styles.muted}>
              Showing {displayRows.length} {aggregation} row{displayRows.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading historical telemetry...</div>
          ) : displayRows.length === 0 ? (
            <div className={styles.empty}>
              No readings found in this window. Telemetry is populated as the ESP32 publishes.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Voltage</th>
                    <th>Current</th>
                    <th>Power</th>
                    <th>SOC</th>
                    <th>SOH</th>
                    <th>Temp</th>
                    <th>BHI Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.slice(0, 150).map((r, i) => (
                    <tr key={r.id || i}>
                      <td>{r.time ? new Date(r.time).toLocaleString() : '--'}</td>
                      <td style={{ color: '#FFD60A' }}>{formatNumber(r.voltage)} V</td>
                      <td style={{ color: r.current < 0 ? '#FF6B35' : '#00E8A0' }}>
                        {formatNumber(r.current)} A
                      </td>
                      <td style={{ color: '#38BDF8' }}>{formatNumber(r.power)} W</td>
                      <td style={{ color: '#00E8A0' }}>{formatNumber(r.soc, 0)}%</td>
                      <td style={{ color: '#38BDF8' }}>{formatNumber(r.soh, 0)}%</td>
                      <td style={{ color: '#FF2D55' }}>{formatNumber(r.temperature, 1)}°C</td>
                      <td style={{ color: r.bhi > 50 ? '#FF2D55' : '#00E8A0' }}>
                        {formatNumber(r.bhi, 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHARGE / DISCHARGE SESSIONS */}
      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.length === 0 ? (
            <div className={styles.empty}>No charge/discharge sessions detected yet.</div>
          ) : (
            sessions.map((s) => {
              const isCharge = s.sessionType === 'charge'
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                    padding: '16px 20px',
                    background: 'linear-gradient(160deg, rgba(30, 40, 70, 0.35), rgba(18, 24, 40, 0.6))',
                    border: `1px solid ${isCharge ? 'rgba(0, 232, 160, 0.25)' : 'rgba(255, 107, 53, 0.25)'}`,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        display: 'grid',
                        placeItems: 'center',
                        background: isCharge ? 'rgba(0, 232, 160, 0.15)' : 'rgba(255, 107, 53, 0.15)',
                        color: isCharge ? '#00E8A0' : '#FF6B35',
                      }}
                    >
                      {isCharge ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: isCharge ? '#00E8A0' : '#FF6B35' }}>
                          {s.sessionType} Session
                        </span>
                        <span className="chip" style={{ fontSize: 10 }}>
                          {formatUptime(s.duration)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(s.startTime).toLocaleString()} → {new Date(s.endTime).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Energy Moved
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#38BDF8', fontFamily: 'monospace' }}>
                        {s.energyMoved} Wh
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Peak Temp
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#FF2D55', fontFamily: 'monospace' }}>
                        {s.peakTemperature}°C
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        SOC Shift
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#00E8A0', fontFamily: 'monospace' }}>
                        {s.startSOC}% → {s.endSOC}%
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Max BHI
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: s.maxBHI > 50 ? '#FF2D55' : '#FFD60A', fontFamily: 'monospace' }}>
                        {s.maxBHI} / 100
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Efficiency
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#FFD60A', fontFamily: 'monospace' }}>
                        {s.efficiency}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* TAB 3: EVENT & STATE TIMELINE */}
      {activeTab === 'timeline' && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>State Transition &amp; Hazard Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            {[
              {
                time: '12 minutes ago',
                type: 'STATE_CHANGE',
                title: 'Operation switched to CHARGING',
                desc: 'Current rose to +2.4A from solar charger array. INA219 bus voltage nominal at 13.8V.',
                badge: 'CHARGING',
                color: '#00E8A0',
              },
              {
                time: '45 minutes ago',
                type: 'THERMAL_EVENT',
                title: 'DHT11 Temp stabilized at 28.4°C',
                desc: 'Cell temperature returned to optimal range following previous discharge run.',
                badge: 'SAFE',
                color: '#38BDF8',
              },
              {
                time: '2 hours ago',
                type: 'GAS_BASELINE',
                title: 'MQ-2 and MQ-135 Baseline Calibration Checked',
                desc: 'Sensor heater coil warmup concluded. Raw ADC baseline established at 1120 ADC.',
                badge: 'OK',
                color: '#A78BFA',
              },
              {
                time: '6 hours ago',
                type: 'COMMAND_EVENT',
                title: 'Device set to AUTOMATIC mode',
                desc: 'Autonomous buzzer and LED threshold controls engaged by system policy.',
                badge: 'AUTO',
                color: '#FFD60A',
              },
            ].map((ev, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: '12px 14px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 10,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: ev.color,
                    boxShadow: `0 0 8px ${ev.color}`,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F4F6FB' }}>{ev.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.time}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#9AA7BF', marginTop: 2 }}>{ev.desc}</div>
                </div>
                <span
                  className="chip"
                  style={{
                    color: ev.color,
                    borderColor: `${ev.color}44`,
                    background: `${ev.color}15`,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {ev.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: COMPARISON MODE */}
      {activeTab === 'compare' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Comparative Benchmark: This Week vs Last Week</h3>
            <span className="chip" style={{ color: '#00E8A0' }}>
              <GitCompare size={12} /> Performance Healthy
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {[
              {
                metric: 'Avg Battery Health (BHI)',
                thisWeek: '16.4 / 100',
                lastWeek: '18.2 / 100',
                change: '-9.8%',
                improved: true,
                note: 'Lower risk score indicates improved thermal balance',
              },
              {
                metric: 'Energy Throughput',
                thisWeek: '284.5 Wh',
                lastWeek: '265.1 Wh',
                change: '+7.3%',
                improved: true,
                note: 'Increased cycle utilization with stable voltage',
              },
              {
                metric: 'Peak Cell Temperature',
                thisWeek: '36.8°C',
                lastWeek: '41.2°C',
                change: '-4.4°C',
                improved: true,
                note: 'Ambient ventilation reduced peak heat generation',
              },
              {
                metric: 'Internal Resistance Trend',
                thisWeek: '43.1 mΩ',
                lastWeek: '42.8 mΩ',
                change: '+0.7%',
                improved: false,
                note: 'Expected normal chemical cell aging rate',
              },
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: '#9AA7BF', marginBottom: 6 }}>
                  {c.metric}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#F4F6FB', fontFamily: 'monospace' }}>
                    {c.thisWeek}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: c.improved ? '#00E8A0' : '#FFD60A',
                    }}
                  >
                    {c.change}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Last week: {c.lastWeek}
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 6 }}>{c.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
