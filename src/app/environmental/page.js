'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Layout from '../../components/Layout'
import TempHumidity from '../../components/environmental/TempHumidity'
import GasDetection from '../../components/environmental/GasDetection'
import AirQualityIndex from '../../components/environmental/AirQualityIndex'
import EnvironmentalChart from '../../components/charts/EnvironmentalChart'
import { useEnvironmental } from '../../hooks/useEnvironmental'
import {
  Flame,
  Wind,
  Droplets,
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Radio,
  Clock,
  TrendingUp,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function EnvironmentalPage() {
  return (
    <Suspense fallback={<Layout><div style={{ padding: 40, textAlign: 'center' }}>Loading environmental monitor...</div></Layout>}>
      <EnvironmentalPageInner />
    </Suspense>
  )
}

function EnvironmentalPageInner() {
  const { environmental, history, connected, lastSeen } = useEnvironmental()
  const [violations, setViolations] = useState([])
  const [loadingViolations, setLoadingViolations] = useState(false)

  useEffect(() => {
    setLoadingViolations(true)
    fetch('/api/environmental/alerts')
      .then((r) => r.json())
      .then((res) => {
        if (res && Array.isArray(res.violations)) {
          setViolations(res.violations)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingViolations(false))
  }, [environmental])

  const hasHazards = environmental.isGasAlert || environmental.isTempAlert || violations.length > 0

  return (
    <Layout connected={connected} lastSeen={lastSeen} data={{ environmental }}>
      {/* 1. Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Wind size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#38BDF8" />
            Environmental <span className="gradText">Safety Station</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Real-time ambient monitoring: DHT11 temperature/humidity, MQ-2 LPG/smoke detector, and MQ-135 AQI analytics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span
            style={{
              background: hasHazards ? 'rgba(255,45,85,0.15)' : 'rgba(0,232,160,0.12)',
              border: `1px solid ${hasHazards ? 'rgba(255,45,85,0.4)' : 'rgba(0,232,160,0.3)'}`,
              color: hasHazards ? '#FF2D55' : '#00E8A0',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {hasHazards ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
            {hasHazards ? 'HAZARD ELEVATED' : 'ENVIRONMENT SECURE'}
          </span>
        </div>
      </div>

      {/* 2. Top Sensor Metrics (DHT11 & MQ-2 / MQ-135) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        <TempHumidity environmental={environmental} />
        <GasDetection environmental={environmental} />
      </div>

      {/* 3. Main 2-Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
        {/* Left Col: AQI Gauge & Safety Violations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <AirQualityIndex
            aqi={environmental.aqi}
            category={environmental.aqiCategory}
            color={environmental.aqiColor}
          />

          {/* Active Threshold Violations Feed */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} color={hasHazards ? '#FF2D55' : '#00E8A0'} />
                <h3 className={styles.cardTitle}>Threshold Violation Feed</h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {violations.length} Active Events
              </span>
            </div>

            {violations.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={32} color="#00E8A0" style={{ margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontWeight: 600, fontSize: 14 }}>All Environmental Sensors In Safe Limits</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  No gas leaks, smoke traces, or thermal runaway risks detected.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {violations.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      background: v.severity === 'CRITICAL' ? 'rgba(255,45,85,0.12)' : 'rgba(255,184,0,0.12)',
                      border: `1px solid ${v.severity === 'CRITICAL' ? 'rgba(255,45,85,0.4)' : 'rgba(255,184,0,0.4)'}`,
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: v.severity === 'CRITICAL' ? '#FF2D55' : '#FFB800',
                          textTransform: 'uppercase',
                        }}
                      >
                        {v.severity} • {v.type}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                        {new Date(v.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {v.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Environmental Trends Chart & Sensor Pinout */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className={styles.cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={18} color="#00E8A0" />
              <h3 className={styles.cardTitle}>Ambient History &amp; Gas Dynamics</h3>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Rolling time-series</span>
          </div>

          <div style={{ flex: 1, minHeight: 300 }}>
            <EnvironmentalChart data={history} height={320} />
          </div>

          {/* Environmental Sensor Specs */}
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
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>DHT11 Pin</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>GPIO 4 (Digital)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>MQ-2 Pin</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>GPIO 34 (ADC1_CH6)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>MQ-135 Pin</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>GPIO 35 (ADC1_CH7)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Max Temperature</span>
              <span style={{ color: '#FF2D55', fontWeight: 700 }}>45.0 °C</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
