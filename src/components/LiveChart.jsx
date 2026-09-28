'use client'

import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import styles from './components.module.css'

const METRIC_CONFIGS = {
  all: {
    label: 'Overview',
    icon: '📊',
    series: [
      { key: 'voltage', name: 'Voltage (V)', color: '#00E8A0', unit: 'V' },
      { key: 'temperature', name: 'Temp (°C)', color: '#FF6B35', unit: '°C' },
      { key: 'soc', name: 'SOC (%)', color: '#00BFFF', unit: '%' },
    ],
  },
  voltage: {
    label: 'Voltage',
    icon: '⚡',
    series: [{ key: 'voltage', name: 'Voltage (V)', color: '#00E8A0', unit: 'V' }],
  },
  current: {
    label: 'Current Flow',
    icon: '🔌',
    series: [{ key: 'current', name: 'Current (A)', color: '#38BDF8', unit: 'A' }],
  },
  power: {
    label: 'Power',
    icon: '💡',
    series: [{ key: 'power', name: 'Power (W)', color: '#FFD60A', unit: 'W' }],
  },
  temperature: {
    label: 'Temperature',
    icon: '🌡️',
    series: [
      { key: 'temperature', name: 'Cell Temp (°C)', color: '#FF6B35', unit: '°C' },
      { key: 'humidity', name: 'Humidity (%RH)', color: '#38BDF8', unit: '%' },
    ],
  },
  soc: {
    label: 'SOC / SOH',
    icon: '🔋',
    series: [
      { key: 'soc', name: 'SOC (%)', color: '#00BFFF', unit: '%' },
      { key: 'bhi', name: 'BHI Risk', color: '#BF5AF2', unit: '' },
    ],
  },
  gas: {
    label: 'Gas (MQ2/135)',
    icon: '💨',
    series: [
      { key: 'mq2', name: 'MQ-2 Gas (ADC)', color: '#FF6B35', unit: 'ADC' },
      { key: 'mq135', name: 'MQ-135 (ADC)', color: '#A78BFA', unit: 'ADC' },
    ],
  },
}

export default function LiveChart({ data = [], height = 260 }) {
  const [activeTab, setActiveTab] = useState('all')

  const chartData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return []
    return data.map((d) => {
      const v = d.voltage != null ? Number(d.voltage) : null
      const cur = d.current != null ? Number(d.current) : (d.battery?.current != null ? Number(d.battery.current) : null)
      const p = d.power != null ? Number(d.power) : (v != null && cur != null ? v * cur : null)
      const t = d.temperature != null ? Number(d.temperature) : null
      const h = d.humidity != null ? Number(d.humidity) : null
      const s = d.soc != null ? Number(d.soc) : null
      const bhi = d.bhi != null ? Number(d.bhi) : null
      const mq2 = d.mq2 != null ? Number(d.mq2) : (d.gasIndex?.mq2 != null ? Number(d.gasIndex.mq2) : (d.gas?.index_mq2 != null ? Number(d.gas.index_mq2) : null))
      const mq135 = d.mq135 != null ? Number(d.mq135) : (d.gasIndex?.mq135 != null ? Number(d.gasIndex.mq135) : (d.gas?.index_mq135 != null ? Number(d.gas.index_mq135) : null))

      return {
        timeLabel: d.time ? format(new Date(d.time), 'HH:mm:ss') : '',
        voltage: v != null ? Number(v.toFixed(2)) : undefined,
        current: cur != null ? Number(cur.toFixed(4)) : undefined,
        power: p != null ? Number(p.toFixed(3)) : undefined,
        temperature: t != null ? Number(t.toFixed(1)) : undefined,
        humidity: h != null ? Number(h.toFixed(1)) : undefined,
        soc: s != null ? Math.round(s) : undefined,
        bhi: bhi != null ? Math.round(bhi) : undefined,
        mq2: mq2 != null ? Math.round(mq2) : undefined,
        mq135: mq135 != null ? Math.round(mq135) : undefined,
      }
    })
  }, [data])

  const activeCfg = METRIC_CONFIGS[activeTab] || METRIC_CONFIGS.all

  const formatTooltipValue = (val, name) => {
    if (val == null || isNaN(val)) return ['--', name]
    const n = String(name).toLowerCase()
    if (n.includes('current')) {
      const mA = (val * 1000).toFixed(1)
      return [`${val.toFixed(4)} A (${mA} mA)`, name]
    }
    if (n.includes('power')) {
      const mW = (val * 1000).toFixed(1)
      return [`${val.toFixed(3)} W (${mW} mW)`, name]
    }
    if (n.includes('voltage')) return [`${val.toFixed(2)} V`, name]
    if (n.includes('temp')) return [`${val.toFixed(1)} °C`, name]
    if (n.includes('humidity') || n.includes('soc')) return [`${val}%`, name]
    if (n.includes('gas') || n.includes('mq')) return [`${val} ADC`, name]
    return [val, name]
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 className={styles.chartTitle} style={{ margin: 0 }}>Live Sensor Trends</h3>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            ({chartData.length} live samples)
          </span>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.entries(METRIC_CONFIGS).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                background: activeTab === key ? 'rgba(0, 232, 160, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: activeTab === key ? '1px solid #00E8A0' : '1px solid var(--border)',
                color: activeTab === key ? '#00E8A0' : 'var(--text-secondary)',
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <span>{cfg.icon}</span> {cfg.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        {chartData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Awaiting real-time ESP32 sensor telemetry stream...
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="timeLabel" stroke="var(--chart-axis)" fontSize={11} minTickGap={20} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-tertiary)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
                formatter={formatTooltipValue}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
              {activeCfg.series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
