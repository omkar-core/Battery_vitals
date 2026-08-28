'use client'

import { useState, useMemo, useRef } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  Legend,
} from 'recharts'
import { format } from 'date-fns'
import {
  Download,
  Calendar,
  Layers,
  TrendingUp,
  Maximize2,
  Minimize2,
  RefreshCw,
  GitCompare,
  Sliders,
} from 'lucide-react'
import { exportToCSV, formatNumber } from '../lib/utils'
import styles from '../styles/pages.module.css'

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(10, 14, 28, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    fontSize: 12,
    boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
    padding: '8px 12px',
  },
  labelStyle: { color: '#94A3B8', fontWeight: 600, marginBottom: 4 },
  itemStyle: { fontSize: 11, padding: '2px 0' },
}

export default function RealtimeGraphs({ rawData = [], liveState = {} }) {
  const [timeRange, setTimeRange] = useState('1H') // 1H, 6H, 24H, 7D, 30D
  const [compareMode, setCompareMode] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all' or specific chart id
  const [visibleMetrics, setVisibleMetrics] = useState({
    voltage: true,
    current: true,
    temp: true,
    humidity: true,
    mq2: true,
    mq135: true,
    bhi: true,
    soc: true,
    soh: true,
    power: true,
    resistance: true,
  })

  // Prepare time-filtered and normalized dataset strictly from real ESP32 data
  const chartData = useMemo(() => {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return []
    }

    const now = Date.now()
    const msLimit =
      timeRange === '1H'
        ? 3600000
        : timeRange === '6H'
        ? 21600000
        : timeRange === '24H'
        ? 86400000
        : timeRange === '7D'
        ? 604800000
        : 2592000000

    const filtered = rawData.filter((r) => r.time >= now - msLimit)
    const dataset = filtered.length > 0 ? filtered : rawData

    let cumulativeWh = 0
    return dataset.map((d) => {
      const v = d.voltage
      const cur = d.current
      const p = d.power ?? (v != null && cur != null ? Math.abs(v * cur) : 0)
      if (p != null) cumulativeWh += (p * (2 / 3600))
      const t = d.time ? new Date(d.time) : new Date()

      return {
        ...d,
        timeLabel: format(t, timeRange === '24H' || timeRange === '7D' ? 'MM/dd HH:mm' : 'HH:mm:ss'),
        voltage: d.voltage != null ? Number(d.voltage.toFixed(2)) : undefined,
        current: d.current != null ? Number(d.current.toFixed(2)) : undefined,
        power: d.power != null ? Number(d.power.toFixed(1)) : p != null ? Number(p.toFixed(1)) : undefined,
        energyWh: Number(cumulativeWh.toFixed(2)),
        temperature: d.temperature != null ? Number(d.temperature.toFixed(1)) : undefined,
        humidity: d.humidity != null ? Number(d.humidity.toFixed(1)) : undefined,
        gasMq2: d.gasMq2 != null ? Math.round(d.gasMq2) : undefined,
        gasMq135: d.gasMq135 != null ? Math.round(d.gasMq135) : undefined,
        bhi: d.bhi != null ? Math.round(d.bhi) : undefined,
        soc: d.soc != null ? Math.round(d.soc) : undefined,
        soh: d.soh != null ? Math.round(d.soh) : undefined,
        resistance: d.resistance != null ? Number(d.resistance.toFixed(2)) : undefined,
      }
    })
  }, [rawData, timeRange])

  // Cumulative energy calculation
  const totalEnergyMoved = useMemo(() => {
    if (chartData.length === 0) return 0
    return chartData[chartData.length - 1]?.energyWh || 0
  }, [chartData])

  const toggleMetric = (key) => {
    setVisibleMetrics((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleExportCSV = () => {
    exportToCSV(chartData, `battery_vitals_${timeRange}_graphs.csv`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Chart Global Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: 'rgba(18, 24, 40, 0.65)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {/* Time Range Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Time Window:
          </span>
          {['1H', '6H', '24H', '7D', '30D'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border:
                  timeRange === range ? '1px solid rgba(0, 232, 160, 0.5)' : '1px solid var(--border)',
                background:
                  timeRange === range
                    ? 'linear-gradient(120deg, rgba(0, 232, 160, 0.15), rgba(56, 189, 248, 0.1))'
                    : 'rgba(255, 255, 255, 0.03)',
                color: timeRange === range ? '#00E8A0' : 'var(--text-secondary)',
              }}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Action Controls: Comparison Mode, Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setCompareMode(!compareMode)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              border: compareMode ? '1px solid #38BDF8' : '1px solid var(--border)',
              background: compareMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: compareMode ? '#38BDF8' : 'var(--text-secondary)',
            }}
            title="Overlay historical reference curve"
          >
            <GitCompare size={13} />
            <span>{compareMode ? 'Comparing vs Baseline' : 'Compare Baseline'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-primary)',
            }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 8 Specialized Graphs Grid */}
      <div className={styles.chartGrid}>
        {/* ========================================================
            CHART A: VOLTAGE TREND
            Min/Max bands at 10.5V and 14.4V, Color zones
        ======================================================== */}
        <div className={`${styles.chartPanel} ${styles.chartFull}`}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              A. Voltage Trend &amp; Safe Operating Limits
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#FFD60A' }} /> Voltage (V)
              </span>
              {compareMode && (
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#64748B' }} /> Baseline Ref
                </span>
              )}
              <span className={styles.legendItem} style={{ color: '#00E8A0' }}>
                Safe (10.5V - 14.4V)
              </span>
              <span className={styles.legendItem} style={{ color: '#FF2D55' }}>
                Cutoff (&lt;10.5V / &gt;14.4V)
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis stroke="#64748B" fontSize={10} domain={[9.5, 15.5]} />
              <Tooltip {...TOOLTIP_STYLE} />
              {/* Safe Operating Zone Band */}
              <ReferenceArea
                y1={10.5}
                y2={14.4}
                fill="#00E8A0"
                fillOpacity={0.05}
                stroke="#00E8A0"
                strokeOpacity={0.2}
              />
              {/* Overvoltage Critical Band */}
              <ReferenceArea y1={14.4} y2={15.5} fill="#FF2D55" fillOpacity={0.08} />
              {/* Undervoltage Critical Band */}
              <ReferenceArea y1={9.5} y2={10.5} fill="#FF2D55" fillOpacity={0.08} />
              <ReferenceLine y={10.5} stroke="#FF2D55" strokeDasharray="4 4" label={{ value: 'Min 10.5V', fill: '#FF2D55', fontSize: 10 }} />
              <ReferenceLine y={14.4} stroke="#FFD60A" strokeDasharray="4 4" label={{ value: 'Max 14.4V', fill: '#FFD60A', fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="voltage"
                stroke="#FFD60A"
                strokeWidth={2.4}
                dot={false}
                isAnimationActive={false}
              />
              {compareMode && (
                <Line
                  type="monotone"
                  dataKey="voltageCompare"
                  stroke="#64748B"
                  strokeDasharray="3 3"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ========================================================
            CHART B: CURRENT FLOW
            Zero-centered, Positive = charging (green), Negative = discharging (red)
        ======================================================== */}
        <div className={styles.chartPanel}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              B. Current Flow (Zero-Centered Directional)
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem} style={{ color: '#00E8A0' }}>
                Charge (+)
              </span>
              <span className={styles.legendItem} style={{ color: '#FF2D55' }}>
                Discharge (−)
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis stroke="#64748B" fontSize={10} domain={['auto', 'auto']} />
              <Tooltip {...TOOLTIP_STYLE} />
              <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} />
              <ReferenceArea y1={0} y2={10} fill="#00E8A0" fillOpacity={0.04} />
              <ReferenceArea y1={-15} y2={0} fill="#FF2D55" fillOpacity={0.04} />
              <Line
                type="monotone"
                dataKey="current"
                stroke="#38BDF8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ========================================================
            CHART C: TEMPERATURE & HUMIDITY
            Dual Y-axis with thresholds at 40°C, 50°C, 60°C
        ======================================================== */}
        <div className={styles.chartPanel}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              C. Thermal &amp; Humidity Dual Y-Axis
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#FF2D55' }} /> Temp (°C)
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#00BFFF' }} /> Humidity (%)
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis yAxisId="left" stroke="#FF2D55" fontSize={10} domain={[15, 75]} />
              <YAxis yAxisId="right" orientation="right" stroke="#00BFFF" fontSize={10} domain={[0, 100]} />
              <Tooltip {...TOOLTIP_STYLE} />
              <ReferenceLine yAxisId="left" y={40} stroke="#FFD60A" strokeDasharray="3 3" label={{ value: '40°C Warn', fill: '#FFD60A', fontSize: 9 }} />
              <ReferenceLine yAxisId="left" y={50} stroke="#FF6B35" strokeDasharray="3 3" label={{ value: '50°C High', fill: '#FF6B35', fontSize: 9 }} />
              <ReferenceLine yAxisId="left" y={60} stroke="#FF2D55" strokeDasharray="3 3" label={{ value: '60°C Critical', fill: '#FF2D55', fontSize: 9 }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="temperature"
                stroke="#FF2D55"
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="humidity"
                stroke="#00BFFF"
                strokeWidth={1.8}
                strokeDasharray="4 2"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ========================================================
            CHART D: GAS SENSOR TRENDS
            MQ-2 and MQ-135 with threshold bands at 1500, 2200, 3000
        ======================================================== */}
        <div className={styles.chartPanel}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              D. Gas Sensor Trends (MQ-2 &amp; MQ-135)
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#FF6B35' }} /> MQ-2 Combustible
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#A78BFA' }} /> MQ-135 VOC
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis stroke="#64748B" fontSize={10} domain={[0, 4000]} />
              <Tooltip {...TOOLTIP_STYLE} />
              {/* Threshold Bands */}
              <ReferenceArea y1={1500} y2={2200} fill="#FFD60A" fillOpacity={0.06} />
              <ReferenceArea y1={2200} y2={3000} fill="#FF6B35" fillOpacity={0.08} />
              <ReferenceArea y1={3000} y2={4000} fill="#FF2D55" fillOpacity={0.12} />
              <ReferenceLine y={1500} stroke="#FFD60A" strokeDasharray="3 3" label={{ value: '1500 Caution', fill: '#FFD60A', fontSize: 9 }} />
              <ReferenceLine y={2200} stroke="#FF6B35" strokeDasharray="3 3" label={{ value: '2200 Warning', fill: '#FF6B35', fontSize: 9 }} />
              <ReferenceLine y={3000} stroke="#FF2D55" strokeDasharray="3 3" label={{ value: '3000 Critical', fill: '#FF2D55', fontSize: 9 }} />
              <Line
                type="monotone"
                dataKey="gasMq2"
                stroke="#FF6B35"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="gasMq135"
                stroke="#A78BFA"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ========================================================
            CHART E: BATTERY HEALTH INDEX (BHI)
            Gradient fill + threshold zones: 0-20, 20-50, 50-70, 70+
        ======================================================== */}
        <div className={styles.chartPanel}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              E. Battery Health Index (BHI Risk Profile)
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem} style={{ color: '#00E8A0' }}>0-20 Safe</span>
              <span className={styles.legendItem} style={{ color: '#FFD60A' }}>20-50 Caution</span>
              <span className={styles.legendItem} style={{ color: '#FF6B35' }}>50-70 Warning</span>
              <span className={styles.legendItem} style={{ color: '#FF2D55' }}>70+ Critical</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <defs>
                <linearGradient id="bhiAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF2D55" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#FFD60A" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00E8A0" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis stroke="#64748B" fontSize={10} domain={[0, 100]} />
              <Tooltip {...TOOLTIP_STYLE} />
              <ReferenceArea y1={0} y2={20} fill="#00E8A0" fillOpacity={0.04} />
              <ReferenceArea y1={20} y2={50} fill="#FFD60A" fillOpacity={0.06} />
              <ReferenceArea y1={50} y2={70} fill="#FF6B35" fillOpacity={0.08} />
              <ReferenceArea y1={70} y2={100} fill="#FF2D55" fillOpacity={0.12} />
              <Area
                type="monotone"
                dataKey="bhi"
                stroke="#FFD60A"
                strokeWidth={2.4}
                fill="url(#bhiAreaGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ========================================================
            CHART F: SOC / SOH COMBINED VIEW
            Two lines on same chart: SOC (short term), SOH (long term)
        ======================================================== */}
        <div className={styles.chartPanel}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              F. SOC (Transient) vs SOH (Degradation) Combined
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#00E8A0' }} /> SOC (State of Charge %)
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#38BDF8' }} /> SOH (State of Health %)
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis stroke="#64748B" fontSize={10} domain={[0, 105]} />
              <Tooltip {...TOOLTIP_STYLE} />
              <ReferenceLine y={80} stroke="#FFD60A" strokeDasharray="3 3" label={{ value: '80% EOL Threshold', fill: '#FFD60A', fontSize: 9 }} />
              <ReferenceLine y={20} stroke="#FF6B35" strokeDasharray="3 3" label={{ value: '20% Low Cutoff', fill: '#FF6B35', fontSize: 9 }} />
              <Line
                type="monotone"
                dataKey="soc"
                stroke="#00E8A0"
                strokeWidth={2.4}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="soh"
                stroke="#38BDF8"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ========================================================
            CHART G: POWER & CUMULATIVE ENERGY (Wh)
            Area chart showing power + cumulative energy in/out
        ======================================================== */}
        <div className={styles.chartPanel}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              G. Power Consumption &amp; Cumulative Energy
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#38BDF8' }} /> Power (W)
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#F472B6' }} /> Energy: {totalEnergyMoved} Wh
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <defs>
                <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis yAxisId="left" stroke="#38BDF8" fontSize={10} />
              <YAxis yAxisId="right" orientation="right" stroke="#F472B6" fontSize={10} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="power"
                stroke="#38BDF8"
                strokeWidth={2}
                fill="url(#powerGrad)"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="energyWh"
                stroke="#F472B6"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ========================================================
            CHART H: INTERNAL RESISTANCE TREND
            Aging indicator correlated with temperature
        ======================================================== */}
        <div className={`${styles.chartPanel} ${styles.chartFull}`}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>
              H. Internal Resistance vs. Temperature Correlation (Cell Aging)
            </span>
            <div className={styles.chartLegend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#A78BFA' }} /> Internal Resistance (mΩ)
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: '#FF2D55' }} /> Temp (°C)
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={10} minTickGap={25} />
              <YAxis yAxisId="ir" stroke="#A78BFA" fontSize={10} domain={['dataMin - 5', 'dataMax + 10']} />
              <YAxis yAxisId="tp" orientation="right" stroke="#FF2D55" fontSize={10} domain={[10, 70]} />
              <Tooltip {...TOOLTIP_STYLE} />
              <ReferenceLine yAxisId="ir" y={65} stroke="#FF2D55" strokeDasharray="4 4" label={{ value: 'Aging Alert (65 mΩ)', fill: '#FF2D55', fontSize: 10 }} />
              <Line
                yAxisId="ir"
                type="monotone"
                dataKey="resistance"
                stroke="#A78BFA"
                strokeWidth={2.4}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="tp"
                type="monotone"
                dataKey="temperature"
                stroke="#FF2D55"
                strokeWidth={1.8}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
