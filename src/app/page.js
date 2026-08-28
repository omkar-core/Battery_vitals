'use client'
import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import LiveChart from '../components/LiveChart'
import Sparkline from '../components/Sparkline'
import ControlPanel from '../components/ControlPanel'
import AIInsights from '../components/AIInsights'
import AlertsList from '../components/AlertsList'
import {
  useRealTimeData,
} from '../hooks/useRealTimeData'
import { useAI } from '../hooks/useAI'
import { bhiStatus, safetyColor, safetyLabel, formatNumber, normalizeTelemetry } from '../lib/utils'
import {
  Zap, Flame, Gauge, Activity, Cpu, Signal, RefreshCw, Droplets, Battery,
} from 'lucide-react'
import styles from '../styles/dashboard.module.css'

const CIRC = 2 * Math.PI * 82

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

  // --- normalized live reading ---
  const live = useMemo(() => {
    const [row] = normalizeTelemetry(data ? [data] : [])
    return row || {}
  }, [data])

  const sparkRows = useMemo(() => normalizeTelemetry(history).slice(-24), [history])
  const sparkData = useMemo(() => sparkRows, [sparkRows])

  const bhi = live.bhi
  const bhiLocal = bhiStatus(bhi)
  const voltage = live.voltage
  const current = live.current
  const power = live.power
  const soc = live.soc
  const soh = live.soh
  const resistance = live.resistance
  const temperature = live.temperature
  const humidity = live.humidity
  const gasMq2 = live.gasMq2
  const gasMq135 = live.gasMq135
  const cycles = live.cycles
  const efficiency = live.efficiency
  const rul = live.rul

  const safety = data?.battery?.safety ?? data?.safety ?? 'SAFE'
  const profile = data?.battery?.profile ?? data?.profile
  const op = data?.battery?.op ?? data?.op
  const phase = data?.battery?.phase ?? data?.phase
  const ddLock = data?.battery?.ddLock ?? data?.ddLock
  const gasWarm = data?.gas?.warm ?? data?.warm
  const gasWRem = data?.gas?.wRem ?? data?.wRem
  const st = data?.battery?.st

  const net = {
    uptime: data?.network?.uptime ?? data?.uptime,
    rssi: data?.network?.rssi ?? data?.rssi,
    heap: data?.network?.free_heap ?? data?.heap,
    requests: data?.network?.requests ?? data?.requests,
    errors: data?.errors ?? data?.error_count,
  }

  const batterySec = data?.battery || data
  const envSec = data?.environment || data
  const gasSec = data?.gas || data

  const voltageConf = batterySec?.vc
  const currentConf = batterySec?.ic
  const tempConf = envSec?.tc
  const humConf = envSec?.hc
  const gasMq2Conf = gasSec?.status_mq2
  const gasMq135Conf = gasSec?.status_mq135

  const bhiOffset = CIRC - (Math.min(100, Math.max(0, bhi ?? 0)) / 100) * CIRC
  const sohOffset = CIRC - (Math.min(100, Math.max(0, soh ?? 0)) / 100) * CIRC

  return (
    <Layout connected={connected} mode={mode}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Real-Time <span className="gradText">Dashboard</span></h1>
        <div className={`${styles.liveBadge} ${!connected ? styles.liveBadgeOff : ''}`}>
          <span className={!connected ? styles.liveDotOff : styles.liveDot} />
          {connected
            ? `Live • ${data?.ts ? new Date(data.ts).toLocaleTimeString() : '--'}`
            : 'Waiting for data (ESP32 offline)'}
        </div>
      </div>

      {!connected && data == null && (
        <div className={styles.notice}>No telemetry yet — the dashboard will populate as soon as the ESP32 (or MQTT stream) sends a reading.</div>
      )}
      {!connected && data != null && (
        <div className={styles.notice}>Showing last known reading. The live stream is currently unavailable{error ? ` (${error})` : ''}.</div>
      )}

      {ddLock && (
        <div className={styles.lockBanner}>
          <Battery size={18} color="#A78BFA" />
          <span>Deep-discharge lock active — battery held in protective state. Lock can only be cleared by device recovery.</span>
        </div>
      )}

      {gasWarm && gasWRem > 0 && (
        <div className={styles.mqBanner}>
          <Flame size={16} /> Gas sensor warming up — approximately {gasWRem}s remaining. Gas readings are not yet trusted.
        </div>
      )}

      <div className={styles.profileStrip}>
        {profile ? <span className="chip"><Cpu size={12} /> {profile}</span> : null}
        {op ? <span className="chip"><Activity size={12} /> Mode: {op}</span> : null}
        {phase ? <span className="chip"><Zap size={12} /> {phase}</span> : null}
        {net.uptime != null ? (
          <span className="chip"><RefreshCw size={12} /> Uptime {Number(net.uptime) >= 3600 ? `${Math.round(net.uptime / 3600)}h` : `${Math.round(net.uptime / 60)}m`}</span>
        ) : null}
        {net.rssi != null ? (
          <span className="chip"><Signal size={12} /> RSSI {net.rssi} dBm</span>
        ) : null}
        {net.heap != null ? (
          <span className="chip"><Cpu size={12} /> Heap {Math.round(net.heap / 1024)} KB</span>
        ) : null}
        {net.errors != null ? (
          <span className="chip" style={{ color: net.errors > 0 ? '#FF2D55' : '#00E8A0' }}>
            <RefreshCw size={12} /> Errors {net.errors}
          </span>
        ) : null}
      </div>

      <div className={styles.hero}>
        <div className={styles.gauges}>
          <div className={styles.gaugeCard}>
            <div className={styles.gaugeWrap}>
              <svg viewBox="0 0 200 200" className={styles.gauge}>
                <circle className={styles.gaugeBg} cx="100" cy="100" r="82" />
                <circle
                  className={styles.gaugeArc}
                  cx="100" cy="100" r="82"
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
                <circle className={styles.gaugeBg} cx="100" cy="100" r="82" />
                <circle
                  className={styles.gaugeArc}
                  cx="100" cy="100" r="82"
                  stroke="#38BDF8"
                  strokeDasharray={CIRC}
                  strokeDashoffset={sohOffset}
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <div className={styles.gaugeScore} style={{ color: '#38BDF8' }}>
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
            <MetricCard title="Voltage" value={formatNumber(voltage)} unit="V" color="#FFD60A" icon={Gauge} chip={voltageConf} />
            <MetricCard title="Current" value={formatNumber(current)} unit="A" color="#FF6B35" icon={Zap} chip={currentConf} />
            <MetricCard title="Power" value={formatNumber(power)} unit="W" color="#38BDF8" icon={Zap} />
            <MetricCard title="Temp" value={formatNumber(temperature, 1)} unit="°C" color="#FF2D55" icon={Flame} chip={tempConf} />
            <MetricCard title="Humidity" value={formatNumber(humidity, 1)} unit="%" color="#00E8A0" icon={Droplets} chip={humConf} />
            <MetricCard title="SOC" value={formatNumber(soc, 0)} unit="%" color="#00E8A0" icon={Battery} delta={soc == null ? null : Number(soc) - (sparkRows[sparkRows.length - 2]?.soc ?? soc)} />
            <MetricCard title="Gas (MQ2)" value={formatNumber(gasMq2, 0)} unit="idx" color="#FF6B35" icon={Flame} chip={gasMq2Conf} />
            <MetricCard title="VOC (MQ135)" value={formatNumber(gasMq135, 0)} unit="idx" color="#A78BFA" icon={Flame} chip={gasMq135Conf} />
            <MetricCard title="Resistance" value={formatNumber(resistance, 2)} unit="mΩ" color="#A78BFA" icon={Gauge} />
            <MetricCard title="Efficiency" value={formatNumber(efficiency, 0)} unit="%" color="#FFD60A" icon={Activity} />
            <MetricCard title="Cycles" value={formatNumber(cycles, 0)} unit="" color="#F472B6" icon={RefreshCw} />
            <MetricCard title="RUL" value={rul != null ? formatNumber(rul, 0) : '--'} unit="days" color="#00E8A0" icon={Activity} />
          </div>
        </div>
      </div>

      {/* Sparkline strip */}
      <div className={styles.metricsGrid} style={{ marginBottom: 16 }}>
        {[
          { label: 'V', key: 'voltage', color: '#FFD60A' },
          { label: 'I', key: 'current', color: '#FF6B35' },
          { label: 'P', key: 'power', color: '#38BDF8' },
          { label: 'SOC', key: 'soc', color: '#00E8A0' },
          { label: 'Temp', key: 'temperature', color: '#FF2D55' },
          { label: 'BHI', key: 'bhi', color: '#A78BFA' },
        ].map((s) => (
          <div key={s.key} className={styles.metricCard} style={{
            background: 'linear-gradient(160deg, rgba(30,40,70,0.28), rgba(18,24,40,0.45))',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {s.label}
            </div>
            <Sparkline data={sparkData} dataKey={s.key} color={s.color} height={30} />
          </div>
        ))}
      </div>

      <div className={styles.bento}>
        <LiveChart data={history} />
        <div className={styles.bentoRight}>
          <div className={styles.grid2} style={{ gridTemplateColumns: '1fr', marginBottom: 0 }}>
            <ControlPanel commands={commands} onCommand={handleControl} />
          </div>
        </div>
      </div>

      <div className={styles.grid2}>
        <AIInsights analysis={analysis} loading={loading} onAnalyze={handleAnalyze} />
        <div className={styles.alertsRow}>
          <AlertsList alerts={alerts} loading={alertsLoading} />
        </div>
      </div>
    </Layout>
  )
}
