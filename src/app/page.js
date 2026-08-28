'use client'
import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import LiveChart from '../components/LiveChart'
import ControlPanel from '../components/ControlPanel'
import AIInsights from '../components/AIInsights'
import AlertsList from '../components/AlertsList'
import { useRealTimeData } from '../hooks/useRealTimeData'
import { useAI } from '../hooks/useAI'
import { bhiStatus, safetyColor, safetyLabel, formatNumber } from '../lib/utils'
import styles from '../styles/dashboard.module.css'

const CIRC = 2 * Math.PI * 88

export default function Dashboard() {
  const { data, history, connected, mode, error, sendControl } = useRealTimeData()
  const { analysis, loading, runAnalysis } = useAI()
  const [commands, setCommands] = useState({ auto_mode: true })
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)

  useEffect(() => {
    fetch('/api/control').then((r) => r.json()).then(setCommands).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setAlertsLoading(true)
    fetch('/api/alerts?limit=8')
      .then((r) => r.json())
      .then((list) => { if (!cancelled) setAlerts(list) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAlertsLoading(false) })
    return () => { cancelled = true }
  }, [data])

  const handleControl = (name) => {
    return sendControl(name).then(() => {
      fetch('/api/control').then((r) => r.json()).then(setCommands).catch(() => {})
    })
  }

  const handleAnalyze = (form) => {
    runAnalysis({ payload: form })
  }

  const bhi = data?.risk?.bhi ?? data?.bhi
  const bhiLocal = bhiStatus(bhi)
  const voltage = data?.battery?.voltage ?? data?.voltage
  const current = data?.battery?.current ?? data?.current
  const power = data?.battery?.power ?? data?.power
  const soc = data?.battery?.soc ?? data?.soc
  const soh = data?.battery?.soh ?? data?.soh
  const safety = data?.battery?.safety ?? data?.safety ?? 'SAFE'
  const temperature = data?.environment?.temperature ?? data?.temperature
  const humidity = data?.environment?.humidity ?? data?.humidity
  const gasMq2 = data?.gas?.index_mq2
  const gasMq135 = data?.gas?.index_mq135

  const bhiOffset = CIRC - (Math.min(100, Math.max(0, bhi ?? 0)) / 100) * CIRC
  const sohOffset = CIRC - (Math.min(100, Math.max(0, soh ?? 0)) / 100) * CIRC

  return (
    <Layout connected={connected} mode={mode}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Real-Time Dashboard</h1>
        <div className={`${styles.liveBadge} ${!connected ? styles.liveBadgeOff : ''}`}>
          <span className={!connected ? styles.liveDotOff : styles.liveDot} />
          {connected
            ? `Live â€¢ ${data?.ts ? new Date(data.ts).toLocaleTimeString() : '--'}`
            : 'Waiting for data (ESP32 offline)'}
        </div>
      </div>

      {!connected && data == null && (
        <div className={styles.notice}>No telemetry yet â€” the dashboard will populate as soon as the ESP32 (or MQTT stream) sends a reading.</div>
      )}
      {!connected && data != null && (
        <div className={styles.notice}>Showing last known reading. The live stream is currently unavailable{error ? ` (${error})` : ''}.</div>
      )}

      <div className={styles.hero}>
        <div className={styles.gauges}>
          <div className={styles.gaugeCard}>
            <div className={styles.gaugeWrap}>
              <svg viewBox="0 0 200 200" className={styles.gauge}>
                <circle className={styles.gaugeBg} cx="100" cy="100" r="88" />
                <circle
                  className={styles.gaugeArc}
                  cx="100" cy="100" r="88"
                  stroke={bhiLocal.color}
                  strokeDasharray={CIRC}
                  strokeDashoffset={bhiOffset}
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <div className={styles.gaugeScore} style={{ color: bhiLocal.color }}>
                  {bhi == null ? '--' : Math.round(bhi)}
                </div>
                <div className={styles.gaugeLabel}>BHI Score</div>
                <div className={styles.gaugeSub}>{bhiLocal.label}</div>
              </div>
            </div>
          </div>

          <div className={styles.gaugeCard}>
            <div className={styles.gaugeWrap}>
              <svg viewBox="0 0 200 200" className={styles.gauge}>
                <circle className={styles.gaugeBg} cx="100" cy="100" r="88" />
                <circle
                  className={styles.gaugeArc}
                  cx="100" cy="100" r="88"
                  stroke="#00BFFF"
                  strokeDasharray={CIRC}
                  strokeDashoffset={sohOffset}
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <div className={styles.gaugeScore} style={{ color: '#00BFFF' }}>
                  {soh == null ? '--' : Math.round(soh)}
                </div>
                <div className={styles.gaugeLabel}>SOH</div>
              </div>
            </div>
          </div>

          <div className={styles.safetyBadge} style={{ borderColor: safetyColor(safety), color: safetyColor(safety) }}>
            {safetyLabel(safety)}
          </div>
        </div>

        <div className={styles.heroCards}>
          <div className={styles.metricsGrid}>
            <MetricCard title="Voltage" value={formatNumber(voltage)} unit="V" color="#FFD60A" />
            <MetricCard title="Current" value={formatNumber(current)} unit="A" color="#FF6B35" />
            <MetricCard title="Power" value={formatNumber(power)} unit="W" color="#00BFFF" />
            <MetricCard title="Temp" value={formatNumber(temperature, 1)} unit="Â°C" color="#FF2D55" />
            <MetricCard title="Humidity" value={formatNumber(humidity, 1)} unit="%" color="#00E8A0" />
            <MetricCard title="SOC" value={formatNumber(soc, 0)} unit="%" color="#00E8A0" />
            <MetricCard title="Gas (MQ2)" value={formatNumber(gasMq2, 0)} unit="idx" color="#FF6B35" />
            <MetricCard title="VOC (MQ135)" value={formatNumber(gasMq135, 0)} unit="idx" color="#BF5AF2" />
          </div>
        </div>
      </div>

      <div className={styles.grid3}>
        <div className={styles.chartSpan}>
          <LiveChart data={history} />
        </div>
      </div>

      <div className={styles.grid2}>
        <ControlPanel commands={commands} onCommand={handleControl} />
        <AIInsights analysis={analysis} loading={loading} onAnalyze={handleAnalyze} />
      </div>

      <div className={styles.alertsRow}>
        <AlertsList alerts={alerts} loading={alertsLoading} />
      </div>
    </Layout>
  )
}