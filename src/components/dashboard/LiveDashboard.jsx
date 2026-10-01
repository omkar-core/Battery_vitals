'use client'

import React from 'react'
import SensorGrid from './SensorGrid'
import StatusIndicator from './StatusIndicator'
import MetricCard from '../MetricCard'
import LiveChart from '../LiveChart'
import AIInsights from '../AIInsights'
import AlertsList from '../AlertsList'
import ControlPanel from '../ControlPanel'
import SOCIndicator from '../battery/SOCIndicator'
import BatteryStatus from '../battery/BatteryStatus'
import TempHumidity from '../environmental/TempHumidity'
import GasDetection from '../environmental/GasDetection'
import AirQualityIndex from '../environmental/AirQualityIndex'
import styles from '../../styles/dashboard.module.css'

export default function LiveDashboard({
  data,
  history,
  connected,
  commands,
  alerts,
  onControl,
  analysis,
  loadingAI,
  onRunAnalysis,
}) {
  // Derived ambient/quality view fed from the normalized ESP32 packet shape
  // (`environment.*`, `gasIndex.*`) rather than stale `environmental`/`hardware` keys.
  const env = {
    temperature: data?.environment?.temperature ?? data?.temperature,
    humidity: data?.environment?.humidity ?? data?.humidity,
    mq2: data?.gasIndex?.mq2,
    mq135: data?.gasIndex?.mq135,
  }
  const isOffline = !connected || !data || data.isDisconnected
  const aqi = !isOffline ? (data?.environment?.aqi ?? (env.mq135 != null ? Math.round(env.mq135 * 0.45) : null)) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Multi-Sensor Grid */}
      <SensorGrid telemetry={data} />

      {/* 2. Hardware Actuators Feedback */}
      <StatusIndicator hardware={data?.outputs || commands} safety={data?.battery?.safety || data?.safety || (isOffline ? 'UNKNOWN' : 'SAFE')} />

      {/* 3. Main 2-Column Live Monitoring Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Left Column: Battery & SOC */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className={styles.metricCard}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              State of Charge (SOC)
            </div>
            <SOCIndicator
              soc={!isOffline ? (data?.battery?.soc ?? data?.soc ?? null) : null}
              voltage={!isOffline ? (data?.battery?.voltage ?? data?.voltage ?? null) : null}
              current={!isOffline ? (data?.battery?.current ?? data?.current ?? null) : null}
              size={180}
            />
          </div>

          <BatteryStatus battery={isOffline ? null : (data?.battery || data)} />
          <TempHumidity environmental={isOffline ? null : env} />
          <GasDetection environmental={isOffline ? null : env} />
        </div>

        {/* Right Column: Live Chart, Control Panel & AI Insights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className={styles.metricCard}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Live Telemetry Stream
            </div>
            <LiveChart data={history} />
          </div>

          <AirQualityIndex
            aqi={aqi}
            category={aqi != null ? (data?.environment?.aqiCategory ?? 'Good') : 'Awaiting Data'}
            color={aqi != null ? '#00E8A0' : 'var(--text-muted)'}
          />

          <ControlPanel
            commands={commands}
            onCommand={onControl}
            batteryState={data?.battery?.safety || data?.safety || (isOffline ? 'DISCONNECTED' : 'SAFE')}
          />

          <AIInsights
            analysis={analysis}
            loading={loadingAI}
            onAnalyze={onRunAnalysis}
            live={data}
          />
        </div>
      </div>
    </div>
  )
}
