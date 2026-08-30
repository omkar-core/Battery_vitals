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
  Calendar,
  Layers,
  Activity,
  Cpu,
  Zap,
  ExternalLink,
  QrCode,
} from 'lucide-react'
import { formatNumber } from '../lib/utils'
import styles from './components.module.css'

export default function BatteryPassportSlideout({ isOpen, onClose, data }) {
  const [copied, setCopied] = useState(false)

  const passportId = 'PASSPORT-BV-9V-001'
  const serialNumber = 'BV-9V-2025-001'
  const batteryName = 'Living Room Smoke Detector'
  const chemistry = 'Ultralife Lithium (Li-MnO2) 9V'
  const installDate = 'Jan 15, 2025'
  const manufacturer = 'Ultralife Corp. / Battery Vital Certified'

  const liveVoltage = data?.battery?.voltage ?? data?.voltage ?? 8.7
  const liveSoc = data?.battery?.soc ?? data?.soc ?? 72
  const liveSoh = data?.battery?.soh ?? data?.soh ?? 96
  const cycles = data?.battery?.cycles ?? 142
  const resistance = data?.battery?.resistance ?? data?.resistance ?? 14.2
  const energyWh = data?.battery?.energyWh ?? 88.4

  const telemetryHash = useMemo(() => {
    const base = JSON.stringify({
      passportId,
      serialNumber,
      voltage: liveVoltage,
      soc: liveSoc,
      soh: liveSoh,
      cycles,
      timestamp: data?.timestamp || Date.now(),
    })
    let h = 0
    for (let i = 0; i < base.length; i++) {
      h = (h * 31 + base.charCodeAt(i)) | 0
    }
    return `0x${Math.abs(h).toString(16).padStart(8, '0').toUpperCase()}D4B8`
  }, [liveVoltage, liveSoc, liveSoh, cycles, data?.timestamp])

  const copyHash = () => {
    navigator.clipboard.writeText(telemetryHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportJSON = () => {
    const doc = {
      passportId,
      serialNumber,
      batteryName,
      chemistry,
      installDate,
      manufacturer,
      specs: {
        nominalVoltage: '9.0V',
        nominalCapacity: '1200mAh',
        maxDischargeRate: '1.0A',
        chemistryProfile: 'Li-MnO2',
      },
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
        certifiedBy: 'Battery Vital Decentralized Audit Network v2.1',
        timestamp: new Date().toISOString(),
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
          {/* Certificate Hero Card */}
          <div className={styles.passportHeroCard}>
            <div className={styles.passportHeroTop}>
              <div>
                <span className={styles.passportVerifiedChip}>
                  <Award size={12} /> VERIFIED ASSET
                </span>
                <h3 className={styles.passportBatteryName}>{batteryName}</h3>
                <div className={styles.passportSerial}>SN: {serialNumber}</div>
              </div>
              <div className={styles.passportQrWrap}>
                <QrCode size={44} color="#00E8A0" />
              </div>
            </div>

            <div className={styles.passportGrid}>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Chemistry</span>
                <span className={styles.passportGridVal}>{chemistry}</span>
              </div>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Installed</span>
                <span className={styles.passportGridVal}>{installDate}</span>
              </div>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Nominal Rating</span>
                <span className={styles.passportGridVal}>9.0V / 1200mAh</span>
              </div>
              <div className={styles.passportGridItem}>
                <span className={styles.passportGridLabel}>Manufacturer</span>
                <span className={styles.passportGridVal}>{manufacturer}</span>
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
                  {liveSoh}%
                </span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Live SOC</span>
                <span className={styles.passportMetricValue} style={{ color: '#38BDF8' }}>
                  {liveSoc}%
                </span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Terminal Voltage</span>
                <span className={styles.passportMetricValue} style={{ color: '#FFD60A' }}>
                  {formatNumber(liveVoltage, 2)}V
                </span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Cycle Count</span>
                <span className={styles.passportMetricValue}>{cycles}</span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Internal Resistance</span>
                <span className={styles.passportMetricValue}>{formatNumber(resistance, 1)} mΩ</span>
              </div>
              <div className={styles.passportMetricCard}>
                <span className={styles.passportMetricLabel}>Energy Throughput</span>
                <span className={styles.passportMetricValue}>{formatNumber(energyWh, 1)} Wh</span>
              </div>
            </div>
          </div>

          {/* Proof Hash */}
          <div className={styles.passportSection}>
            <h4 className={styles.passportSectionTitle}>Cryptographic Proof</h4>
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
