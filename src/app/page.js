'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import LiveChart from '../components/LiveChart'
import Sparkline from '../components/Sparkline'
import ControlPanel from '../components/ControlPanel'
import AIInsights from '../components/AIInsights'
import AlertsList from '../components/AlertsList'
import { useRealTimeData } from '../hooks/useRealTimeData'
import { useAI } from '../hooks/useAI'
import {
  bhiStatus,
  safetyColor,
  safetyLabel,
  formatNumber,
  normalizeTelemetry,
  getConnectionState,
  formatUptime,
  rssiToBars,
  playAlertChime,
} from '../lib/utils'
import {
  Zap,
  Flame,
  Gauge,
  Activity,
  Cpu,
  Signal,
  RefreshCw,
  Droplets,
  Battery,
  ShieldAlert,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  HardDrive,
  Clock,
  Radio,
  Volume2,
  VolumeX,
} from 'lucide-react'
import styles from '../styles/dashboard.module.css'

const CIRC = 2 * Math.PI * 82

export default function Dashboard() {
  const { data, history, connected, mode, error, sendControl } = useRealTimeData()
  const { analysis, loading, runAnalysis } = useAI()
  const [commands, setCommands] = useState({ auto_mode: true })
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [lastChimeTs, setLastChimeTs] = useState(0)

  useEffect(() => {
    fetch('/api/control')
      .then((r) => r.json())
      .then(setCommands)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setAlertsLoading(true)
    fetch('/api/alerts?limit=8')
      .then((r) => r.json())
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setAlerts(list)
          // Play chime for fresh critical/warning alerts if sound enabled
          if (soundEnabled && list.length > 0) {
            const newest = list[0]
            const alertTime = new Date(newest.time).getTime()
            if (alertTime > lastChimeTs && !newest.acknowledged) {
              setLastChimeTs(alertTime)
              playAlertChime(newest.severity)
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAlertsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [data, soundEnabled, lastChimeTs])

  const handleControl = (name, value, label) => {
    return sendControl(name, value).then(() => {
      fetch('/api/control')
        .then((r) => r.json())
        .then(setCommands)
        .catch(() => {})
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

  // Safety State with 5 variants
  const rawSafety = (data?.battery?.safety ?? data?.safety ?? 'SAFE').toUpperCase()
  const isSensorFault =
    rawSafety === 'SENSOR_FAULT' ||
    data?.ina_ok === false ||
    data?.dht_ok === false ||
    data?.battery?.ina_ok === false
  const safety = isSensorFault ? 'SENSOR_FAULT' : rawSafety

  const profile = data?.battery?.profile ?? data?.profile ?? null
  const rawOp = (data?.battery?.op ?? data?.op ?? 'IDLE').toUpperCase()
  const op =
    current != null
      ? current > 0.05
        ? 'CHARGING'
        : current < -0.05
        ? 'DISCHARGING'
        : rawOp
      : rawOp

  const phase = data?.battery?.phase ?? data?.phase
  const ddLock = data?.battery?.ddLock ?? data?.ddLock
  const gasWarm = data?.gas?.warm ?? data?.warm
  const gasWRem = data?.gas?.wRem ?? data?.wRem

  const lastSeen = data?.timestamp || data?.receivedAt || data?.ts

  // Connection State
  const connState = useMemo(() => {
    if (!connected && !data) return { state: 'CONNECTING', label: 'Connecting to ESP32...', color: '#38BDF8' }
    return getConnectionState(lastSeen)
  }, [connected, data, lastSeen])

  // Network metrics
  const net = {
    uptime: data?.network?.uptime ?? data?.uptime,
    rssi: data?.network?.rssi ?? data?.wifi_rssi ?? data?.rssi,
    heap: data?.network?.free_heap ?? data?.free_heap ?? data?.heap,
    requests: data?.network?.requests ?? data?.requests,
    errors: data?.errors ?? data?.error_count ?? 0,
  }
  const wifiInfo = rssiToBars(net.rssi)

  // Sensor Health Chips
  const batterySec = data?.battery || data
  const envSec = data?.environment || data
  const gasSec = data?.gas || data

  const voltageChip =
    data?.ina_ok === false ? 'FAULT' : voltage != null && (voltage < 9.5 || voltage > 15) ? 'RANGE' : 'OK'
  const currentChip = data?.ina_ok === false ? 'FAULT' : 'OK'
  const tempChip =
    data?.dht_ok === false
      ? 'FAULT'
      : temperature != null && (temperature < 0 || temperature > 65)
      ? 'RANGE'
      : 'OK'
  const humChip = data?.dht_ok === false ? 'FAULT' : 'OK'
  const gasMq2Chip = gasWarm ? 'WARM' : gasSec?.status_mq2 || 'OK'
  const gasMq135Chip = gasWarm ? 'WARM' : gasSec?.status_mq135 || 'OK'

  const bhiOffset = CIRC - (Math.min(100, Math.max(0, bhi ?? 0)) / 100) * CIRC
  const sohOffset = CIRC - (Math.min(100, Math.max(0, soh ?? 0)) / 100) * CIRC

  // Safety Badge class mapping
  const safetyClass =
    safety === 'CRITICAL' || safety === 'EMERGENCY'
      ? styles.safety_critical
      : safety === 'WARNING'
      ? styles.safety_warning
      : safety === 'CAUTION'
      ? styles.safety_caution
      : safety === 'SENSOR_FAULT'
      ? styles.safety_sensor_fault
      : styles.safety_safe

  return (
    <Layout connected={connected} mode={mode} lastSeen={lastSeen}>
      {/* Header with Title and 4-State Connection Indicator */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>
            Live Battery <span className="gradText">Telemetry &amp; Vitals</span>
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Real-time telemetry stream from ESP32 • HiveMQ Cloud • AI Predictive Safety
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              if (!soundEnabled) playAlertChime('INFO')
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 100,
              background: soundEnabled ? 'rgba(0, 232, 160, 0.12)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${soundEnabled ? 'rgba(0, 232, 160, 0.3)' : 'var(--border)'}`,
              color: soundEnabled ? '#00E8A0' : 'var(--text-muted)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Toggle Audio Alert Chime"
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>Sound {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Connection State Badge */}
          <div
            className={`${styles.liveBadge} ${
              connState.state === 'LIVE'
                ? styles.liveBadgeLive
                : connState.state === 'STALE'
                ? styles.liveBadgeStale
                : connState.state === 'CONNECTING'
                ? styles.liveBadgeConnecting
                : styles.liveBadgeOffline
            }`}
          >
            <span
              className={
                connState.state === 'LIVE'
                  ? styles.liveDot
                  : connState.state === 'STALE'
                  ? styles.liveDotStale
                  : connState.state === 'CONNECTING'
                  ? styles.liveDotConnecting
                  : styles.liveDotOffline
              }
            />
            <span>{connState.label}</span>
          </div>
        </div>
      </div>

      {!connected && data == null && (
        <div className={styles.notice}>
          Initializing connection — the live dashboard will populate automatically as soon as the
          ESP32 hardware or MQTT stream publishes a data frame.
        </div>
      )}
      {!connected && data != null && (
        <div className={styles.notice}>
          Displaying cached telemetry. The real-time stream is currently awaiting new samples
          {error ? ` (${error})` : ''}.
        </div>
      )}

      {ddLock && (
        <div className={styles.lockBanner}>
          <Battery size={18} color="#A78BFA" />
          <span>
            Deep-Discharge Lock Active — Battery output held in safety isolation mode to prevent cell
            inversion.
          </span>
        </div>
      )}

      {gasWarm && (gasWRem > 0 || gasWarm === true) && (
        <div className={styles.mqBanner}>
          <Flame size={16} /> MQ-2 / MQ-135 heating coil stabilization in progress (~
          {gasWRem || '45'}s remaining). Gas ppm calculations are warming up.
        </div>
      )}

      {/* Top Profile & Hardware Strip */}
      <div className={styles.profileStrip}>
        {/* Operation Mode */}
        <span
          className={`${styles.opMode} ${
            op === 'CHARGING'
              ? styles.opCharging
              : op === 'DISCHARGING'
              ? styles.opDischarging
              : styles.opIdle
          }`}
        >
          {op === 'CHARGING' ? (
            <ArrowUpRight size={14} />
          ) : op === 'DISCHARGING' ? (
            <ArrowDownRight size={14} />
          ) : (
            <Minus size={14} />
          )}
          Mode: {op}
        </span>

        {profile && (
          <span className="chip">
            <Cpu size={12} /> {profile}
          </span>
        )}
        {phase && (
          <span className="chip">
            <Zap size={12} /> {phase}
          </span>
        )}
        {net.uptime != null && (
          <span className="chip" title={`Raw uptime: ${net.uptime}s`}>
            <Clock size={12} /> Uptime {formatUptime(net.uptime)}
          </span>
        )}
        {net.rssi != null && (
          <span className="chip" style={{ color: wifiInfo.color }}>
            <Signal size={12} /> WiFi {net.rssi} dBm ({wifiInfo.bars}/4 {wifiInfo.label})
          </span>
        )}
        {net.heap != null && (
          <span className="chip">
            <HardDrive size={12} /> Heap {Math.round(net.heap / 1024)} KB free
          </span>
        )}
        {net.errors != null && (
          <span className="chip" style={{ color: net.errors > 0 ? '#FF2D55' : '#00E8A0' }}>
            <RefreshCw size={12} /> Errors: {net.errors}
          </span>
        )}
      </div>

      {/* Hero Section: Gauges + Safety Badge + Metrics Grid */}
      <div className={styles.hero}>
        <div className={styles.gauges}>
          {/* BHI Score Gauge */}
          <div className={styles.gaugeCard}>
            <div className={styles.gaugeWrap}>
              <svg viewBox="0 0 200 200" className={styles.gauge}>
                <circle className={styles.gaugeBg} cx="100" cy="100" r="82" />
                <circle
                  className={styles.gaugeArc}
                  cx="100"
                  cy="100"
                  r="82"
                  stroke={bhiLocal.color}
                  strokeDasharray={CIRC}
                  strokeDashoffset={bhiOffset}
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <div className={styles.gaugeScore} style={{ color: bhiLocal.color }}>
                  {bhi == null ? '--' : Math.round(bhi)}
                </div>
                <div className={styles.gaugeLabel}>BHI Index</div>
                <div className={styles.gaugeSub} style={{ color: bhiLocal.color }}>
                  {bhiLocal.label}
                </div>
              </div>
            </div>
          </div>

          {/* SOH Score Gauge */}
          <div className={styles.gaugeCard}>
            <div className={styles.gaugeWrap}>
              <svg viewBox="0 0 200 200" className={styles.gauge}>
                <circle className={styles.gaugeBg} cx="100" cy="100" r="82" />
                <circle
                  className={styles.gaugeArc}
                  cx="100"
                  cy="100"
                  r="82"
                  stroke="#38BDF8"
                  strokeDasharray={CIRC}
                  strokeDashoffset={sohOffset}
                />
              </svg>
              <div className={styles.gaugeCenter}>
                <div className={styles.gaugeScore} style={{ color: '#38BDF8' }}>
                  {soh == null ? '--' : Math.round(soh)}%
                </div>
                <div className={styles.gaugeLabel}>Battery SOH</div>
                <div className={styles.gaugeSub} style={{ color: '#38BDF8' }}>
                  Health State
                </div>
              </div>
            </div>
          </div>

          {/* Safety State Badge with color coding & pulse */}
          <div className={`${styles.safetyBadge} ${safetyClass}`}>
            {safety === 'CRITICAL' || safety === 'EMERGENCY' ? (
              <ShieldAlert size={16} />
            ) : (
              <ShieldCheck size={16} />
            )}
            <span>Safety State: {safetyLabel(safety)}</span>
          </div>
        </div>

        {/* 10+ Real-Time Metric Cards Grid with Sensor Health Chips */}
        <div className={styles.heroCards}>
          <div className={styles.metricsGrid}>
            <MetricCard
              title="Voltage"
              value={formatNumber(voltage)}
              unit="V"
              color="#FFD60A"
              icon={Gauge}
              chip={voltageChip}
              subtext="Nominal 12.0V - 14.4V"
            />
            <MetricCard
              title="Current"
              value={formatNumber(current)}
              unit="A"
              color={current < 0 ? '#FF6B35' : '#00E8A0'}
              icon={Zap}
              chip={currentChip}
              subtext={current < 0 ? 'Discharging' : current > 0 ? 'Charging' : 'Idle'}
            />
            <MetricCard
              title="Power"
              value={formatNumber(power)}
              unit="W"
              color="#38BDF8"
              icon={Zap}
              subtext={power != null ? `${(power * 1000).toFixed(0)} mW` : '--'}
            />
            <MetricCard
              title="Temperature"
              value={formatNumber(temperature, 1)}
              unit="°C"
              color="#FF2D55"
              icon={Flame}
              chip={tempChip}
              subtext="Limit < 50°C"
            />
            <MetricCard
              title="Humidity"
              value={formatNumber(humidity, 1)}
              unit="%"
              color="#00E8A0"
              icon={Droplets}
              chip={humChip}
              subtext="Ambient RH"
            />
            <MetricCard
              title="SOC (Charge)"
              value={formatNumber(soc, 0)}
              unit="%"
              color="#00E8A0"
              icon={Battery}
              delta={
                soc == null
                  ? null
                  : Number(soc) - (sparkRows[sparkRows.length - 2]?.soc ?? soc)
              }
              subtext="State of Charge"
            />
            <MetricCard
              title="Gas (MQ-2)"
              value={formatNumber(gasMq2, 0)}
              unit="ADC"
              color="#FF6B35"
              icon={Flame}
              chip={gasMq2Chip}
              subtext="Combustible Gases"
            />
            <MetricCard
              title="Gas (MQ-135)"
              value={formatNumber(gasMq135, 0)}
              unit="ADC"
              color="#A78BFA"
              icon={Flame}
              chip={gasMq135Chip}
              subtext="Air Quality &amp; VOC"
            />
            <MetricCard
              title="Internal Res."
              value={formatNumber(resistance, 2)}
              unit="mΩ"
              color="#A78BFA"
              icon={Gauge}
              subtext="Cell Degradation"
            />
            <MetricCard
              title="Efficiency"
              value={formatNumber(efficiency, 0)}
              unit="%"
              color="#FFD60A"
              icon={Activity}
              subtext="Coulombic Return"
            />
            <MetricCard
              title="Cycles"
              value={formatNumber(cycles, 0)}
              unit="cyc"
              color="#F472B6"
              icon={RefreshCw}
              subtext="Equivalent Full Cycles"
            />
            <MetricCard
              title="Est. RUL"
              value={rul != null ? formatNumber(rul, 0) : '--'}
              unit="days"
              color="#00E8A0"
              icon={Activity}
              subtext="Remaining Useful Life"
            />
          </div>
        </div>
      </div>

      {/* Sparkline Strip */}
      <div className={styles.metricsGrid} style={{ marginBottom: 16 }}>
        {[
          { label: 'Voltage Trend', key: 'voltage', color: '#FFD60A' },
          { label: 'Current Flow', key: 'current', color: '#FF6B35' },
          { label: 'Power Draw', key: 'power', color: '#38BDF8' },
          { label: 'SOC Shift', key: 'soc', color: '#00E8A0' },
          { label: 'Thermal Profile', key: 'temperature', color: '#FF2D55' },
          { label: 'BHI Risk', key: 'bhi', color: '#A78BFA' },
        ].map((s) => (
          <div
            key={s.key}
            className={styles.metricCard}
            style={{
              background: 'linear-gradient(160deg, rgba(30,40,70,0.28), rgba(18,24,40,0.45))',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 4,
              }}
            >
              {s.label}
            </div>
            <Sparkline data={sparkData} dataKey={s.key} color={s.color} height={30} />
          </div>
        ))}
      </div>

      {/* Bento: Live Sensor Trends + Quick Controls */}
      <div className={styles.bento}>
        <LiveChart data={history} />
        <div className={styles.bentoRight}>
          <div className={styles.grid2} style={{ gridTemplateColumns: '1fr', marginBottom: 0 }}>
            <ControlPanel commands={commands} onCommand={handleControl} />
          </div>
        </div>
      </div>

      {/* Bottom Bento: Gemini AI Insights + Live Alert Center Feed */}
      <div className={styles.grid2}>
        <AIInsights analysis={analysis} loading={loading} onAnalyze={handleAnalyze} />
        <div className={styles.alertsRow}>
          <AlertsList alerts={alerts} loading={alertsLoading} />
        </div>
      </div>
    </Layout>
  )
}
