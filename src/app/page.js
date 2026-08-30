'use client'

import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import MetricCard from '../components/MetricCard'
import LiveChart from '../components/LiveChart'
import Sparkline from '../components/Sparkline'
import ControlPanel from '../components/ControlPanel'
import AIInsights from '../components/AIInsights'
import AlertsList from '../components/AlertsList'
import DataTicker from '../components/DataTicker'
import SocRing from '../components/SocRing'
import EnergyFlow from '../components/EnergyFlow'
import NeedleGauge from '../components/NeedleGauge'
import MoodBadge from '../components/MoodBadge'
import SkeletonLoader, { SkeletonMetric, SkeletonChart, SkeletonControl, SkeletonAI } from '../components/SkeletonLoader'
import { useRealTimeData } from '../hooks/useRealTimeData'
import { useAI } from '../hooks/useAI'
import useTabTitle from '../hooks/useTabTitle'
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
import animStyles from '../styles/anim.module.css'
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
  Volume2,
  VolumeX,
  AlertTriangle,
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

  // L18 - Browser tab live SOC (🔋 NN% | Battery Vital)
  useTabTitle(soc)

  // L4 - Ticker items with deltas against the previous sample (real data only)
  const tickerItems = useMemo(() => {
    const prev = sparkRows[sparkRows.length - 2] || {}
    const delta = (cur, p) => (cur == null || p == null ? null : Number(cur) - Number(p))
    const dTxt = (cur, p) => {
      const d = delta(cur, p)
      return d == null
        ? ''
        : `${d >= 0 ? '+' : ''}${Math.abs(d) >= 10 ? Math.round(d) : d.toFixed(2)}`
    }
    const items = []
    if (voltage != null) items.push({ key: 'v', label: 'VOLT', value: `${formatNumber(voltage)}V`, delta: delta(voltage, prev.voltage), deltaText: dTxt(voltage, prev.voltage) })
    if (current != null) items.push({ key: 'i', label: 'CURR', value: `${formatNumber(current)}A`, delta: delta(current, prev.current), deltaText: dTxt(current, prev.current) })
    if (power != null) items.push({ key: 'p', label: 'PWR', value: `${formatNumber(power)}W`, delta: delta(power, prev.power), deltaText: dTxt(power, prev.power) })
    if (soc != null) items.push({ key: 's', label: 'SOC', value: `${Math.round(soc)}%`, delta: delta(soc, prev.soc), deltaText: dTxt(soc, prev.soc) })
    if (temperature != null) items.push({ key: 't', label: 'TEMP', value: `${formatNumber(temperature, 1)}°C`, delta: delta(temperature, prev.temperature), deltaText: dTxt(temperature, prev.temperature) })
    if (bhi != null) items.push({ key: 'bhi', label: 'BHI', value: `${Math.round(bhi)}`, delta: delta(bhi, prev.bhi), deltaText: dTxt(bhi, prev.bhi) })
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparkRows, voltage, current, power, soc, temperature, bhi])

  // Remaining capacity label for the SOC ring (real SOC × nominal capacity)
  const capacityAh = data?.battery?.capacityAh ?? data?.capacityAh
  const remainingLabel =
    soc != null && Number(capacityAh) > 0
      ? `${Math.round((Number(soc) / 100) * Number(capacityAh) * 1000)} mAh left`
      : null

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
    <Layout connected={connected} mode={mode} lastSeen={lastSeen} data={data}>
      {/* L4 - Live data ticker strip */}
      <DataTicker items={tickerItems} />

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
                : connState.state === 'SLOW'
                ? styles.liveBadgeSlow
                : connState.state === 'STALE'
                ? styles.liveBadgeStale
                : connState.state === 'NO_DATA'
                ? styles.liveBadgeNoData
                : connState.state === 'CONNECTING'
                ? styles.liveBadgeConnecting
                : styles.liveBadgeOffline
            }`}
          >
            <span
              className={
                connState.state === 'LIVE'
                  ? styles.liveDot
                  : connState.state === 'SLOW'
                  ? styles.liveDotSlow
                  : connState.state === 'STALE'
                  ? styles.liveDotStale
                  : connState.state === 'NO_DATA'
                  ? styles.liveDotNoData
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
          <div className={styles.notice} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={styles.liveDotConnecting} />
            <span><strong>Loading live data from Firebase...</strong> Awaiting real-time ESP32 telemetry frames.</span>
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
          <span className="chip" style={{ color: net.errors > 0 ? 'var(--state-critical)' : 'var(--state-safe)' }}>
            <RefreshCw size={12} /> Errors: {net.errors}
          </span>
        )}
      </div>

      {/* Row 1: Weighted Bento Hero Row */}
      <div className={styles.heroBento}>
        {/* K5 - Live pulse ring that replays on every fresh telemetry frame */}
        {connState.state === 'LIVE' && (
          <span key={lastSeen ?? 'live'} className={animStyles.livePulseOverlay} />
        )}

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

        {/* Hero Card 3: Circular SOC Ring Gauge + Mood (3 cols) */}
        <div className={styles.heroSocCard}>
          <SocRing soc={soc} charging={op === 'CHARGING'} remainingLabel={remainingLabel} />
          <MoodBadge soc={soc} current={current} temperature={temperature} safety={safety} />
        </div>

        {/* Hero Card 4: Live Sparkline Mini-Chart (3 cols) */}
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

      {/* L1 - Energy flow strip */}
      <div className={styles.energyFlowRow}>
        <EnergyFlow op={op} current={current} power={power} />
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
          { label: 'Voltage Trend', key: 'voltage', color: 'var(--chart-3)' },
          { label: 'Current Flow', key: 'current', color: 'var(--orange)' },
          { label: 'Power Draw', key: 'power', color: 'var(--chart-2)' },
          { label: 'SOC Shift', key: 'soc', color: 'var(--chart-1)' },
          { label: 'Thermal Profile', key: 'temperature', color: 'var(--state-critical)' },
          { label: 'BHI Risk', key: 'bhi', color: 'var(--chart-4)' },
        ].map((s) => (
          <div
            key={s.key}
            className={styles.metricCard}
            style={{
              background: 'var(--card-bg)',
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

      {/* K3 - Professional instrument panel (needle gauges) */}
      <div className={styles.instrumentRow}>
        <div className={styles.instrumentCard}>
          <NeedleGauge
            label="Battery Current"
            value={current}
            min={-20}
            max={20}
            unit=" A"
            digits={2}
            zones={[
              { min: 0, max: 0.45, color: '#FF2D55' },
              { min: 0.45, max: 0.55, color: '#00E8A0' },
              { min: 0.55, max: 1, color: '#38BDF8' },
            ]}
          />
        </div>
        <div className={styles.instrumentCard}>
          <NeedleGauge
            label="Cell Temperature"
            value={temperature}
            min={-10}
            max={70}
            unit="°C"
            digits={1}
            zones={[
              { min: 0, max: 0.625, color: '#00E8A0' },
              { min: 0.625, max: 0.75, color: '#FFD60A' },
              { min: 0.75, max: 1, color: '#FF2D55' },
            ]}
          />
        </div>
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
