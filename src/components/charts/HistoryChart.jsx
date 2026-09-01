'use client'

import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

export default function HistoryChart({ data = [], height = 320, metric = 'voltage' }) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        No historical records found for this query range.
      </div>
    )
  }

  const metricConfig = {
    voltage: { key: 'voltage', name: 'Voltage (V)', color: '#00E8A0', unit: 'V' },
    current: { key: 'current', name: 'Current (A)', color: '#38BDF8', unit: 'A' },
    power: { key: 'power', name: 'Power (W)', color: '#FFB800', unit: 'W' },
    soc: { key: 'soc', name: 'State of Charge (%)', color: '#BF5AF2', unit: '%' },
    temperature: { key: 'temperature', name: 'Temperature (°C)', color: '#FF2D55', unit: '°C' },
  }

  const activeCfg = metricConfig[metric] || metricConfig.voltage

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad_${activeCfg.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={activeCfg.color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={activeCfg.color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="time"
            stroke="var(--text-tertiary)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-tertiary)"
            fontSize={11}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(14, 19, 28, 0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              fontSize: 12,
              color: '#F0F4F8',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
          <Area
            type="monotone"
            dataKey={activeCfg.key}
            name={activeCfg.name}
            stroke={activeCfg.color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#grad_${activeCfg.key})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
