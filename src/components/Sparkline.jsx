'use client'
import { useMemo } from 'react'
import { AreaChart, Area, YAxis, ResponsiveContainer } from 'recharts'

export default function Sparkline({ data = [], dataKey, color = '#00E8A0', height = 36 }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({ v: d?.[dataKey] }))
  }, [data, dataKey])

  return (
    <div style={{ width: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.6}
            fill={`url(#spark-${dataKey})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
