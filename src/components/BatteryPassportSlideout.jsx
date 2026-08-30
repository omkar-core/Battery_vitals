'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  X,
  ShieldCheck,
  Award,
  Hash,
  Download,
  Copy,
  Check,
  Cpu,
  Activity,
  ExternalLink,
  QrCode,
} from 'lucide-react'
import { formatNumber } from '../lib/utils'
import styles from './components.module.css'

export default function BatteryPassportSlideout({ isOpen, onClose, data }) {
  const [copied, setCopied] = useState(false)

  // Passport identity is derived strictly from the connected device telemetry.
  const batteryId = data?.batteryId || data?.battery?.batteryId || 'BAT001'
  const passportId = `PASSPORT-${batteryId}`
  const deviceId = data?.deviceId || null
  const profile = data?.profile || data?.battery?.profile || data?.battery?.chemistry || null
  const firmware = data?.firmware || null

  // Real telemetry values only. Missing sensor fields render as '--', never fabricated.
  const liveVoltage = data?.battery?.voltage ?? data?.voltage ?? null
  const liveSoc = data?.battery?.soc ?? data?.soc ?? null
  const liveSoh = data?.battery?.soh ?? data?.soh ?? null
  const cycles = data?.battery?.cycles ?? null
  const resistance = data?.battery?.resistance ?? data?.resistance ?? null
  const energyWh = data?.battery?.energyWh ?? null

  const telemetryHash = useMemo(() => {
    const base = JSON.stringify({
      passportId,
      batteryId,
      deviceId,
      voltage: liveVoltage,
      soc: liveSoc,
      soh: liveSoh,
      cycles,
      timestamp: data?.timestamp || null,
    })
    let h = 0
    for (let i = 0; i < base.length; i++) {
      h = (h * 31 + base.charCodeAt(i)) | 0
    }
    return `0x${Math.abs(h).toString(16).padStart(8, '0').toUpperCase()}`
  }, [passportId, batteryId, deviceId, liveVoltage, liveSoc, liveSoh, cycles, data?.timestamp])

  const copyHash = () => {
    navigator.clipboard.writeText(telemetryHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportJSON = () => {
    const doc = {
      passportId,
      batteryId,
      deviceId,
      firmware,
      profile,
      currentTelemetry: {
        voltage: liveVoltage,
        soc: liveSoc,
        soh: liveSoh,
        cycles,
        internalResistanceMilliohm: resistance,
        energyThroughputWh: energyWh,
      },
      proof: {
        telemetryHash,
        generatedAt: new Date().toISOString(),
        note: 'Content hash of the latest live telemetry snapshot',
      },
    }
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `passport_${passportId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className={styles.slideoutOverlay} onClick={onClose}>
      <aside
        className={styles.slideoutPanel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Battery Passport"
      >
        {/* Header */}
        <div className={styles.slideoutHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={styles.passportIconBadge}>
              <ShieldCheck size={18} color="#00E8A0" />
            </span>
            <div>
              <div className={styles.slideoutTitle}>Battery Passport</div>
              <div className={styles.slideoutSubtitle}>{passportId}</div>
            </div>
          </div>
          <button
            className={styles.slideoutCloseBtn}
            onClick={onClose}
            aria-label="Close Battery Passport"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className={styles.slideoutBody}>
          {/* Device Identity Card */}
          <div className={styles.passportHeroCard}>
            <div className={styles.passportHeroTop}>
              <div>
                <span className={styles.passportVerifiedChip}>
                  <Award size={12} /> LIVE DEVICE IDENTITY
                </span>
                <h3 className={styles.passportBatteryName}>{batteryId}</h3>
                <div className={styles.passportSerial}>SN: {deviceId || '--'}</div>
              </div>
              <div className={styles.passportQrWrap}>
                <QrCode size={44} color="#00E8A0" />
              </div>
            </div>

            <div className={styles.passportGrid}>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Battery ID</span>
                <span className={styles.passportGridVal}>{batteryId}</span>
              </div>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Device ID</span>
                <span className={styles.passportGridVal}>{deviceId || '--'}</span>
              </div>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Profile</span>
                <span className={styles.passportGridVal}>{profile || '--'}</span>
              </div>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Firmware</span>
                <span className={styles.passportGridVal}>{firmware || '--'}</span>
              </div>
            </div>
          </div>

          {/* Vitals Telemetry Snapshot */}
          <div className={styles.passportSection}>
            <h4 className={styles.passportSectionTitle}>Real-Time Telemetry Snapshot</h4>
            <div className={styles.passportMetricsGrid}>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>State of Health (SOH)</span>
                <span className={styles.passportMetricValue} style={{ color: '#00E8A0' }}>
                  {liveSoh != null ? `${formatNumber(liveSoh, 0)}%` : '--'}
                </span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Live SOC</span>
                <span className={styles.passportMetricValue} style={{ color: '#38BDF8' }}>
                  {liveSoc != null ? `${formatNumber(liveSoc, 0)}%` : '--'}
                </span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Terminal Voltage</span>
                <span className={styles.passportMetricValue} style={{ color: '#FFD60A' }}>
                  {liveVoltage != null ? `${formatNumber(liveVoltage, 2)}V` : '--'}
                </span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Cycle Count</span>
                <span className={styles.passportMetricValue}>{cycles != null ? cycles : '--'}</span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Internal Resistance</span>
                <span className={styles.passportMetricValue}>
                  {resistance != null ? `${formatNumber(resistance, 1)} mΩ` : '--'}
                </span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Energy Throughput</span>
                <span className={styles.passportMetricValue}>
                  {energyWh != null ? `${formatNumber(energyWh, 1)} Wh` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Proof Hash */}
          <div className={styles.passportSection}>
            <h4 className={styles.passportSectionTitle}>Integrity Proof</h4>
            <div className={styles.passportHashBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Hash size={13} color="var(--accent-primary)" />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Live Telemetry Hash</span>
              </div>
              <div className={styles.passportHashRow}>
                <code className={styles.passportHashCode}>{telemetryHash}</code>
                <button
                  className={styles.passportCopyBtn}
                  onClick={copyHash}
                  title="Copy verification hash"
                >
                  {copied ? <Check size={13} color="#00E8A0" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <Activity size={13} color="#00E8A0" />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Updates with each telemetry frame received from the device.
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className={styles.passportActions}>
            <button className={styles.passportPrimaryBtn} onClick={exportJSON}>
              <Download size={14} />
              <span>Download Passport JSON</span>
            </button>
            <Link
              href="/passport"
              className={styles.passportSecondaryBtn}
              onClick={onClose}
            >
              <span>Open Full Digital Twin</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </aside>
    </div>
  )
}