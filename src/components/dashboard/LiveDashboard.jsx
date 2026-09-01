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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Multi-Sensor Grid */}
      <SensorGrid telemetry={data} />

      {/* 2. Hardware Actuators Feedback */}
      <StatusIndicator hardware={data?.hardware || commands} safety={data?.battery?.safety || data?.safety} />

      {/* 3. Main 2-Column Live Monitoring Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Left Column: Battery & SOC */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className={styles.metricCard}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              State of Charge (SOC)
            </div>
            <SOCIndicator
              soc={data?.battery?.soc ?? data?.soc ?? 85}
              voltage={data?.battery?.voltage ?? data?.voltage ?? 12.6}
              current={data?.battery?.current ?? data?.current ?? 0}
              size={180}
            />
          </div>

          <BatteryStatus battery={data?.battery || data} />
          <TempHumidity environmental={data?.environmental || data} />
          <GasDetection environmental={data?.environmental || data} />
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
            aqi={data?.environmental?.aqi ?? 45}
            category={data?.environmental?.aqiCategory ?? 'Good'}
            color={data?.environmental?.aqiColor ?? '#00E8A0'}
          />

          <ControlPanel
            commands={commands}
            onCommand={onControl}
            batteryState={data?.battery?.safety || data?.safety || 'SAFE'}
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
