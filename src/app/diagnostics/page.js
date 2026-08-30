'use client'

import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import MetricCard from '../../components/MetricCard'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import {
  formatNumber,
  formatUptime,
  rssiToBars,
  getConnectionState,
} from '../../lib/utils'
import {
  Cpu,
  Database,
  Radio,
  Server,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Download,
  Wifi,
  HardDrive,
  Clock,
  ArrowRight,
  RefreshCw,
  Flame,
  Gauge,
  Droplets,
  Share2,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function DiagnosticsPage() {
  const { connected, data, mode } = useRealTimeData()
  const [healthInfo, setHealthInfo] = useState(null)
  const [apiLatency, setApiLatency] = useState(null)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const checkHealth = async () => {
    setRefreshing(true)
    const t0 = performance.now()
    try {
      const res = await fetch('/api/health')
      const json = await res.json()
      setHealthInfo(json)
      setApiLatency(Math.round(performance.now() - t0))
    } catch (e) {
      setApiLatency(Math.round(performance.now() - t0))
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    checkHealth()
    const timer = setInterval(checkHealth, 10000)
    return () => clearInterval(timer)
  }, [])

  const lastSeen = data?.timestamp || data?.receivedAt
  const conn = getConnectionState(lastSeen)

  const net = {
    uptime: data?.network?.uptime ?? data?.uptime ?? null,
    rssi: data?.network?.rssi ?? data?.wifi_rssi ?? data?.rssi ?? null,
    heap: data?.network?.free_heap ?? data?.free_heap ?? data?.heap ?? null,
    firmware: data?.firmware || data?.mac || '--',
  }
  const wifiBars = rssiToBars(net.rssi)

  // Sensor status assessments (only claim a status when real data exists)
  const inaStatus = data?.ina_ok == null ? '--' : data.ina_ok ? 'OK' : 'FAULT'
  const dhtStatus = data?.dht_ok == null ? '--' : data.dht_ok ? 'OK' : 'FAULT'
  const mq2Status = data?.gas?.warm ? 'WARM' : data?.gas?.index_mq2 != null ? 'OK' : '--'
  const mq135Status = data?.gas?.warm ? 'WARM' : data?.gas?.index_mq135 != null ? 'OK' : '--'

  const copyJson = () => {
    if (!data) return
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `esp32_telemetry_packet_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Layout connected={connected} lastSeen={lastSeen} data={data}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Cpu size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#00E8A0" />
            Hardware &amp; System <span className="gradText">Diagnostics</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            End-to-end telemetry pipeline verification, sensor health matrix, and live packet debugging.
          </p>
        </div>

        <button
          onClick={checkHealth}
          disabled={refreshing}
          className={styles.filterBtn}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={12} className={refreshing ? styles.spin : ''} />
          <span>Ping System Status</span>
        </button>
      </div>

      {/* 1. INTERACTIVE 5-HOP DATA FLOW DIAGRAM */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Share2 size={16} color="#38BDF8" />
          Live Architecture Data Flow
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            padding: '16px 8px',
          }}
        >
          {/* Hop 1: ESP32 */}
          <div style={{ textAlign: 'center', flex: 1, minWidth: 140 }}>
            <div
              style={{
                padding: '14px 10px',
                background: conn.state === 'LIVE' ? 'rgba(0, 232, 160, 0.1)' : 'rgba(255, 45, 85, 0.1)',
                border: `1.5px solid ${conn.state === 'LIVE' ? '#00E8A0' : '#FF2D55'}`,
                borderRadius: 12,
              }}
            >
              <Cpu size={24} color={conn.state === 'LIVE' ? '#00E8A0' : '#FF2D55'} />
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>ESP32 Node</div>
              <div style={{ fontSize: 10, color: conn.color, fontWeight: 700, marginTop: 2 }}>
                {conn.state}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>2.0s Telemetry</div>
          </div>

          <ArrowRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />

          {/* Hop 2: Firebase Realtime Database */}
          <div style={{ textAlign: 'center', flex: 1, minWidth: 140 }}>
            <div
              style={{
                padding: '14px 10px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1.5px solid #38BDF8',
                borderRadius: 12,
              }}
            >
              <Radio size={24} color="#38BDF8" />
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>Firebase RTDB</div>
              <div style={{ fontSize: 10, color: '#38BDF8', fontWeight: 700, marginTop: 2 }}>
                Real-Time Database
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Zero-Broker Push</div>
          </div>

          <ArrowRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />

          {/* Hop 3: Vercel / Admin SDK */}
          <div style={{ textAlign: 'center', flex: 1, minWidth: 140 }}>
            <div
              style={{
                padding: '14px 10px',
                background: 'rgba(167, 139, 250, 0.1)',
                border: '1.5px solid #A78BFA',
                borderRadius: 12,
              }}
            >
              <Server size={24} color="#A78BFA" />
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>Admin SDK API</div>
              <div style={{ fontSize: 10, color: '#A78BFA', fontWeight: 700, marginTop: 2 }}>
                Next.js Backend
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Latency: {apiLatency != null ? `${apiLatency}ms` : '--'}
            </div>
          </div>

          <ArrowRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />

          {/* Hop 4: MongoDB Atlas */}
          <div style={{ textAlign: 'center', flex: 1, minWidth: 140 }}>
            <div
              style={{
                padding: '14px 10px',
                background: healthInfo?.database === 'connected' ? 'rgba(0, 232, 160, 0.1)' : 'rgba(255, 214, 10, 0.1)',
                border: `1.5px solid ${healthInfo?.database === 'connected' ? '#00E8A0' : '#FFD60A'}`,
                borderRadius: 12,
              }}
            >
              <Database size={24} color={healthInfo?.database === 'connected' ? '#00E8A0' : '#FFD60A'} />
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>MongoDB Atlas</div>
              <div style={{ fontSize: 10, color: '#00E8A0', fontWeight: 700, marginTop: 2 }}>
                Background Archive
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Time-Series Sync</div>
          </div>

          <ArrowRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />

          {/* Hop 5: Client Dashboard */}
          <div style={{ textAlign: 'center', flex: 1, minWidth: 140 }}>
            <div
              style={{
                padding: '14px 10px',
                background: 'rgba(0, 232, 160, 0.15)',
                border: '1.5px solid #00E8A0',
                borderRadius: 12,
              }}
            >
              <Activity size={24} color="#00E8A0" />
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>Client WebApp</div>
              <div style={{ fontSize: 10, color: '#00E8A0', fontWeight: 700, marginTop: 2 }}>
                {mode === 'firebase' ? 'Firebase Real-Time' : 'HTTP Polling'}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>React 18 / Next.js</div>
          </div>
        </div>
      </div>

      {/* 2. SENSOR HEALTH MATRIX (INA219, DHT11, MQ-2, MQ-135) */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Physical Sensor Health Grid</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {/* INA219 */}
          <div
            style={{
              padding: 14,
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${inaStatus === 'OK' ? 'rgba(0, 232, 160, 0.25)' : 'rgba(255, 45, 85, 0.4)'}`,
              borderRadius: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#FFD60A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Gauge size={16} /> INA219 I2C
              </span>
              <span className="chip" style={{ color: inaStatus === 'OK' ? '#00E8A0' : '#FF2D55' }}>
                {inaStatus}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Current &amp; High-Side Voltage Shunt
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'monospace' }}>
              Bus Voltage: <strong>{formatNumber(data?.voltage)} V</strong>
              <br />
              Current Flow: <strong>{formatNumber(data?.current)} A</strong>
            </div>
          </div>

          {/* DHT11 */}
          <div
            style={{
              padding: 14,
              background: 'rgba(0,0,0,0.25)',
              border: `1px solid ${dhtStatus === 'OK' ? 'rgba(0, 232, 160, 0.25)' : 'rgba(255, 45, 85, 0.4)'}`,
              borderRadius: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#FF2D55', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={16} /> DHT11 Digital
              </span>
              <span className="chip" style={{ color: dhtStatus === 'OK' ? '#00E8A0' : '#FF2D55' }}>
                {dhtStatus}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Ambient Temperature &amp; Relative Humidity
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'monospace' }}>
              Cell Temp: <strong>{formatNumber(data?.temperature, 1)} °C</strong>
              <br />
              Humidity: <strong>{formatNumber(data?.humidity, 1)} %</strong>
            </div>
          </div>

          {/* MQ-2 */}
          <div
            style={{
              padding: 14,
              background: 'var(--input-bg)',
              border: '1px solid rgba(255, 107, 53, 0.25)',
              borderRadius: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#FF6B35', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={16} /> MQ-2 Analog ADC
              </span>
              <span className="chip" style={{ color: mq2Status === 'OK' ? '#00E8A0' : '#FFD60A' }}>
                {mq2Status}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Combustible Gas, LPG, Smoke &amp; Hydrogen
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--mono)' }}>
              Raw ADC: <strong>{data?.gas?.index_mq2 != null ? `${Math.round(data.gas.index_mq2)} ADC` : data?.mq2 != null ? `${Math.round(data.mq2)} ADC` : '--'}</strong>
              <br />
              Status: <strong>{data?.gas?.warm ? 'Heater Warming' : data?.gas?.status_mq2 || '--'}</strong>
            </div>
          </div>

          {/* MQ-135 */}
          <div
            style={{
              padding: 14,
              background: 'var(--input-bg)',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#A78BFA', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Droplets size={16} /> MQ-135 Analog ADC
              </span>
              <span className="chip" style={{ color: mq135Status === 'OK' ? '#00E8A0' : '#FFD60A' }}>
                {mq135Status}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Air Quality, VOCs, NH3, Benzene &amp; CO2
            </div>
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--mono)' }}>
              Raw ADC: <strong>{data?.gas?.index_mq135 != null ? `${Math.round(data.gas.index_mq135)} ADC` : data?.mq135 != null ? `${Math.round(data.mq135)} ADC` : '--'}</strong>
              <br />
              Status: <strong>{data?.gas?.warm ? 'Heater Warming' : data?.gas?.status_mq135 || '--'}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ESP32 SYSTEM METRICS */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title="WiFi Signal"
          value={`${net.rssi ?? '--'} dBm`}
          unit={`(${wifiBars.bars}/4)`}
          color={wifiBars.color}
          icon={Wifi}
          subtext={wifiBars.label}
        />
        <MetricCard
          title="ESP32 Free Heap"
          value={Math.round(net.heap / 1024)}
          unit="KB"
          color="#38BDF8"
          icon={HardDrive}
          subtext="RAM Availability"
        />
        <MetricCard
          title="System Uptime"
          value={formatUptime(net.uptime)}
          unit=""
          color="#00E8A0"
          icon={Clock}
          subtext={`Raw: ${net.uptime || 0}s`}
        />
        <MetricCard
          title="Firmware Version"
          value={net.firmware}
          unit=""
          color="#A78BFA"
          icon={Cpu}
          subtext="ESP32 Microcontroller"
        />
      </div>

      {/* 4. RAW TELEMETRY INSPECTOR */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Latest Real-Time JSON Telemetry Packet</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={copyJson}
              className={styles.filterBtn}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {copied ? <Check size={13} color="#00E8A0" /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={downloadJson}
              className={styles.filterBtn}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={13} />
              <span>Download Packet</span>
            </button>
          </div>
        </div>

        <pre
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: 16,
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#38BDF8',
            overflowX: 'auto',
            maxHeight: 380,
          }}
        >
          {data ? JSON.stringify(data, null, 2) : '// No active telemetry packet received yet.'}
        </pre>
      </div>
    </Layout>
  )
}
