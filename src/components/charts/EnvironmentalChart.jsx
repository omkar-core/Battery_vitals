'use client'

import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

export default function EnvironmentalChart({ data = [], height = 280 }) {
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
        Awaiting environmental sensor time-series data...
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="time"
            stroke="var(--text-tertiary)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="var(--text-tertiary)"
            fontSize={11}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="var(--text-tertiary)"
            fontSize={11}
            tickLine={false}
            domain={[0, 1000]}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--tooltip-bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="temperature"
            name="Temp (°C)"
            stroke="#00E8A0"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="humidity"
            name="Humidity (%RH)"
            stroke="#38BDF8"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="mq2"
            name="MQ-2 Gas (ppm)"
            stroke="#FFB800"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
