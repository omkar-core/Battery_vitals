import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import styles from './components.module.css'

export default function LiveChart({ data, series = ['voltage', 'temperature', 'soc'], height = 260 }) {
  const chartData = useMemo(() => {
    return (data || []).map((d) => ({
      ...d,
      timeLabel: d.time ? format(new Date(d.time), 'HH:mm:ss') : '',
      voltage: d.voltage,
      temperature: d.temperature,
      soc: d.soc,
      current: d.current,
      bhi: d.bhi,
    }))
  }, [data])

  const COLORS = {
    voltage: '#00E8A0',
    temperature: '#FF6B35',
    soc: '#00BFFF',
    current: '#FFD60A',
    bhi: '#BF5AF2',
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>Live Sensor Trends</h3>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="timeLabel" stroke="#64748B" fontSize={11} />
            <YAxis stroke="#64748B" fontSize={11} />
            <Tooltip
              contentStyle={{ background: '#0D1421', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94A3B8' }}
            />
            <Legend />
            {series.map((s) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={COLORS[s] || '#00E8A0'}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
