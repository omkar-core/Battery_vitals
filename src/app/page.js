'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import LiveChart from '../components/LiveChart'
import Sparkline from '../components/Sparkline'
import ControlPanel from '../components/ControlPanel'
import AIInsights from '../components/AIInsights'
import AlertsList from '../components/AlertsList'
import SkeletonLoader, { SkeletonMetric, SkeletonChart, SkeletonControl, SkeletonAI } from '../components/SkeletonLoader'
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
  Play,
  Square,
  Volume2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react'
import styles from '../styles/dashboard.module.css'

const CIRC = 2 * Math.PI * 82

export default function Dashboard() {
  const { data, history, connected, mode, error, sendControl, simulating, toggleSimulation } = useRealTimeData()
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
            Real-time telemetry stream from ESP32 • Firebase Realtime Database • AI Predictive Safety
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Demo Simulation Mode Toggle */}
          <button
            onClick={toggleSimulation}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 100,
              background: simulating ? 'linear-gradient(120deg, rgba(167, 139, 250, 0.2), rgba(56, 189, 248, 0.15))' : 'var(--input-bg)',
              border: `1px solid ${simulating ? 'rgba(167, 139, 250, 0.5)' : 'var(--border)'}`,
              color: simulating ? '#A78BFA' : 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: simulating ? '0 0 14px rgba(167, 139, 250, 0.3)' : 'none',
              transition: 'all 0.25s ease',
            }}
            title="Toggle Demo Simulation Mode for offline presentations"
          >
            {simulating ? <Square size={13} fill="#A78BFA" /> : <Play size={13} />}
            <span>Demo Mode: {simulating ? 'ACTIVE' : 'OFF'}</span>
          </button>

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
              background: soundEnabled ? 'rgba(0, 232, 160, 0.12)' : 'var(--input-bg)',
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
        <div style={{ margin: '20px 0' }}>
          <div className={styles.notice} style={{ marginBottom: 20 }}>
            Initializing connection — rendering lazy skeleton placeholders while awaiting telemetry stream...
          </div>
          <div className={styles.metricsGrid} style={{ marginBottom: 20 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonMetric key={i} />
            ))}
          </div>
          <div className={styles.bento}>
            <SkeletonChart height={300} />
            <SkeletonControl />
          </div>
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

      {/* Row 1: Weighted Bento Hero Row */}
      <div className={styles.heroBento}>
        {/* Hero Card 1: Dominant Safety State Anchor (4 cols) */}
        <div className={`${styles.heroSafetyCard} ${safetyClass}`}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
              System Safety Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              {safety === 'CRITICAL' || safety === 'EMERGENCY' ? (
                <ShieldAlert size={36} color="var(--state-critical)" />
              ) : (
                <ShieldCheck size={36} color="var(--state-safe)" />
              )}
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {safetyLabel(safety)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  BHI Index: {bhi == null ? '--' : Math.round(bhi)} / 100 ({bhiLocal.label})
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', marginTop: 20 }}>
            <span className={`${styles.opMode} ${op === 'CHARGING' ? styles.opCharging : op === 'DISCHARGING' ? styles.opDischarging : styles.opIdle}`}>
              {op === 'CHARGING' ? <ArrowUpRight size={14} /> : op === 'DISCHARGING' ? <ArrowDownRight size={14} /> : <Minus size={14} />}
              Mode: {op}
            </span>
            {profile && <span className="chip"><Cpu size={12} /> {profile}</span>}
          </div>
        </div>

        {/* Hero Card 2: Battery SOH % Gauge (4 cols) */}
        <div className={styles.heroSohCard}>
          <div className={styles.gaugeWrap}>
            <svg viewBox="0 0 200 200" className={styles.gauge}>
              <circle className={styles.gaugeBg} cx="100" cy="100" r="82" />
              <circle
                className={styles.gaugeArc}
                cx="100"
                cy="100"
                r="82"
                stroke="var(--state-info)"
                strokeDasharray={CIRC}
                strokeDashoffset={sohOffset}
              />
            </svg>
            <div className={styles.gaugeCenter}>
              <div className={styles.gaugeScore} style={{ color: 'var(--state-info)' }}>
                {soh == null ? '--' : Math.round(soh)}%
              </div>
              <div className={styles.gaugeLabel}>Battery SOH</div>
            </div>
          </div>
        </div>

        {/* Hero Card 3: Live Sparkline Mini-Chart (4 cols) */}
        <div className={styles.heroSparklineCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
              Voltage Stream
            </span>
            <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--state-caution)' }}>
              {formatNumber(voltage)} V
            </span>
          </div>
          <Sparkline data={sparkData} dataKey="voltage" color="var(--state-caution)" height={120} />
        </div>
      </div>

      {/* Row 2: Primary Telemetry Metric Strip (6 equal cols) */}
      <div className={styles.metricStrip6}>
        <MetricCard
          title="Voltage"
          value={formatNumber(voltage)}
          unit="V"
          color="var(--state-caution)"
          icon={Gauge}
          chip={voltageChip}
          subtext="Nominal 10.5V–14.4V"
        />
        <MetricCard
          title="Current"
          value={formatNumber(current)}
          unit="A"
          color={current < 0 ? 'var(--state-critical)' : 'var(--state-safe)'}
          icon={Zap}
          chip={currentChip}
          subtext={current < 0 ? 'Discharging' : current > 0 ? 'Charging' : 'Idle'}
        />
        <MetricCard
          title="Power"
          value={formatNumber(power)}
          unit="W"
          color="var(--state-info)"
          icon={Zap}
          subtext={power != null ? `${(power * 1000).toFixed(0)} mW` : '--'}
        />
        <MetricCard
          title="Temperature"
          value={formatNumber(temperature, 1)}
          unit="°C"
          color="var(--state-critical)"
          icon={Flame}
          chip={tempChip}
          subtext="Limit < 50°C"
        />
        <MetricCard
          title="Humidity"
          value={formatNumber(humidity, 1)}
          unit="%"
          color="var(--state-safe)"
          icon={Droplets}
          chip={humChip}
          subtext="Ambient RH"
        />
        <MetricCard
          title="SOC (Charge)"
          value={formatNumber(soc, 0)}
          unit="%"
          color="var(--state-safe)"
          icon={Battery}
          delta={soc == null ? null : Number(soc) - (sparkRows[sparkRows.length - 2]?.soc ?? soc)}
          subtext="State of Charge"
        />
      </div>

      {/* Row 3: Secondary Telemetry Metric Strip (6 equal cols) */}
      <div className={styles.metricStrip6}>
        <MetricCard
          title="Gas (MQ-2)"
          value={formatNumber(gasMq2, 0)}
          unit="ADC"
          color="var(--state-caution)"
          icon={Flame}
          chip={gasMq2Chip}
          subtext="Combustible Gases"
        />
        <MetricCard
          title="Gas (MQ-135)"
          value={formatNumber(gasMq135, 0)}
          unit="ADC"
          color="var(--purple)"
          icon={Flame}
          chip={gasMq135Chip}
          subtext="Air Quality & VOC"
        />
        <MetricCard
          title="Internal Res."
          value={formatNumber(resistance, 2)}
          unit="mΩ"
          color="var(--purple)"
          icon={Gauge}
          subtext="Cell Degradation"
        />
        <MetricCard
          title="Efficiency"
          value={formatNumber(efficiency, 0)}
          unit="%"
          color="var(--state-caution)"
          icon={Activity}
          subtext="Coulombic Return"
        />
        <MetricCard
          title="Cycles"
          value={formatNumber(cycles, 0)}
          unit="cyc"
          color="var(--purple)"
          icon={RefreshCw}
          subtext="Equivalent Full Cycles"
        />
        <MetricCard
          title="Est. RUL"
          value={rul != null ? formatNumber(rul, 0) : '--'}
          unit="days"
          color="var(--state-safe)"
          icon={Activity}
          subtext="Remaining Useful Life"
        />
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
