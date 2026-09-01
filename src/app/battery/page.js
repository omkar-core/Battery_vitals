'use client'

import React, { useState, Suspense } from 'react'
import Layout from '../../components/Layout'
import PowerMetrics from '../../components/battery/PowerMetrics'
import SOCIndicator from '../../components/battery/SOCIndicator'
import BatteryStatus from '../../components/battery/BatteryStatus'
import HistoryChart from '../../components/charts/HistoryChart'
import { useBattery } from '../../hooks/useBattery'
import {
  BatteryCharging,
  Zap,
  Activity,
  Cpu,
  Clock,
  RefreshCw,
  Sliders,
  TrendingUp,
  Download,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function BatteryPage() {
  return (
    <Suspense fallback={<Layout><div style={{ padding: 40, textAlign: 'center' }}>Loading battery monitor...</div></Layout>}>
      <BatteryPageInner />
    </Suspense>
  )
}

function BatteryPageInner() {
  const { battery, history, connected, mode, lastSeen } = useBattery()
  const [activeMetric, setActiveMetric] = useState('voltage') // 'voltage', 'current', 'power', 'soc'

  return (
    <Layout connected={connected} lastSeen={lastSeen} data={{ battery }}>
      {/* 1. Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <BatteryCharging size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#00E8A0" />
            Battery Monitor &amp; <span className="gradText">Telemetry Hub</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Precision electrical telemetry via INA219 I2C sensor, State of Charge tracking, and cell-level balancing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span
            style={{
              background: 'rgba(0,232,160,0.12)',
              border: '1px solid rgba(0,232,160,0.3)',
              color: '#00E8A0',
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Pack: {battery.batteryId} (12V 3S Li-ion)
          </span>
        </div>
      </div>

      {/* 2. Top Metric Cards (INA219 Readings) */}
      <div style={{ marginBottom: 20 }}>
        <PowerMetrics battery={battery} />
      </div>

      {/* 3. Main Dashboard 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Left Col: SOC & Health Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color="#00E8A0" />
                <h3 className={styles.cardTitle}>State of Charge (SOC)</h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Open-Circuit Voltage Model</span>
            </div>

            <SOCIndicator
              soc={battery.soc}
              voltage={battery.voltage}
              current={battery.current}
              size={190}
            />
          </div>

          <BatteryStatus battery={battery} />
        </div>

        {/* Right Col: Interactive Live & Historical Chart */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#38BDF8" />
              <h3 className={styles.cardTitle}>Telemetry Curves</h3>
            </div>

            {/* Metric Switcher Tabs */}
            <div style={{ display: 'flex', gap: 6 }}>
              {['voltage', 'current', 'power', 'soc'].map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveMetric(m)}
                  style={{
                    background: activeMetric === m ? 'rgba(0,232,160,0.18)' : 'rgba(255,255,255,0.04)',
                    color: activeMetric === m ? '#00E8A0' : 'var(--text-secondary)',
                    border: activeMetric === m ? '1px solid rgba(0,232,160,0.4)' : '1px solid var(--border-subtle)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 300 }}>
            <HistoryChart data={history} height={320} metric={activeMetric} />
          </div>

          {/* Detailed Hardware Stats */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
              fontSize: 11,
            }}
          >
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>I2C Bus Address</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>0x40 (INA219)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Shunt Resistor</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>0.1 Ω / 2W</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Sampling Rate</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>1000 ms (1 Hz)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Current Resolution</span>
              <span style={{ color: '#00E8A0', fontWeight: 700 }}>±0.8 mA</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
