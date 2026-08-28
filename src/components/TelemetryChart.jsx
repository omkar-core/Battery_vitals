'use client'
import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceArea, Area, ComposedChart,
} from 'recharts'
import { format } from 'date-fns'

const DEFAULT_STYLE = {
  contentStyle: {
    background: 'rgba(13, 18, 34, 0.95)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  labelStyle: { color: '#9AA7BF' },
  itemStyle: { color: '#E2E8F0' },
}

export default function TelemetryChart({
  data = [],
  series = [],
  height = 240,
  showArea = false,
  bands = [],
  yDomain,
  timeFormat = 'HH:mm',
}) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      timeLabel: d.time ? format(new Date(d.time), timeFormat) : '',
    }))
  }, [data, timeFormat])

  if (series.length === 0) return null

  const ChartImpl = showArea ? ComposedChart : LineChart

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartImpl data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="timeLabel" stroke="#5C6B85" fontSize={10} tickMargin={6} minTickGap={30} />
        <YAxis stroke="#5C6B85" fontSize={10} domain={yDomain} width={40} />
        {series.some((s) => s.yAxisId === 'right') && (
          <YAxis yAxisId="right" orientation="right" stroke="#5C6B85" fontSize={10} width={40} />
        )}
        <Tooltip {...DEFAULT_STYLE} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {bands.map((b, i) => (
          <ReferenceArea
            key={i}
            y1={b.from}
            y2={b.to}
            fill={b.color || '#FF2D55'}
            fillOpacity={b.opacity ?? 0.06}
            strokeOpacity={0}
          />
        ))}
        {series.map((s) =>
          showArea ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              dot={false}
              isAnimationActive={false}
              yAxisId={s.yAxisId || 'left'}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              yAxisId={s.yAxisId || 'left'}
            />
          )
        )}
      </ChartImpl>
    </ResponsiveContainer>
  )
}
