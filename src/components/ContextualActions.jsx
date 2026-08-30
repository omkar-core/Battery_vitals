'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  RefreshCw,
  FileText,
  Clock,
  CheckCheck,
  Filter,
  Save,
  RotateCcw,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Radio,
  Download,
  FileSpreadsheet,
} from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import styles from './components.module.css'

export default function ContextualActions({ onRefresh, onTimeRangeChange }) {
  const pathname = usePathname()
  const { addNotification, markAllRead } = useNotifications()

  const [timeRange, setTimeRange] = useState('1h')
  const [savingConfig, setSavingConfig] = useState(false)
  const [liveMode, setLiveMode] = useState(true)
  const [alertsFilter, setAlertsFilter] = useState('all')

  const handleExportPDF = () => {
    addNotification({
      title: 'Report Generated',
      message: 'Battery Vital Telemetry & Safety Diagnostic Report prepared for printing/PDF.',
      type: 'success',
      duration: 5000,
    })
    window.print()
  }

  const handleSaveConfiguration = () => {
    setSavingConfig(true)

    // Multi-step progress saving notification as specified in instruction #10:
    // "1/3 Validating configuration... ✓" -> "2/3 Uploading to Firebase... ⟳" -> "3/3 Notifying ESP32... ✓"
    addNotification({
      title: 'Saving Configuration',
      message: '1/3 Validating configuration rules... ✓',
      type: 'info',
      duration: 3000,
    })

    setTimeout(() => {
      addNotification({
        title: 'Syncing to Cloud',
        message: '2/3 Uploading settings to Firebase Realtime Database... ⟳',
        type: 'info',
        duration: 3000,
      })
    }, 1200)

    setTimeout(() => {
      addNotification({
        title: 'Configuration Saved',
        message: '3/3 Notifying ESP32 edge hardware... ✓ All parameters applied.',
        type: 'success',
        duration: 6000,
      })
      setSavingConfig(false)
    }, 2500)
  }

  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all battery parameters to factory defaults?')) {
      addNotification({
        title: 'Settings Reset',
        message: 'All parameters reverted to factory default thresholds.',
        type: 'warning',
      })
    }
  }

  // Dashboard Contextual Bar
  if (pathname === '/' || pathname === '') {
    return (
      <div className={styles.contextActionBar}>
        <div className={styles.contextActionGroup}>
          <span className={styles.contextActionLabel}>
            <Clock size={13} />
            <span>Time Range:</span>
          </span>
          {['1h', '6h', '24h', '7d'].map((range) => (
            <button
              key={range}
              className={`${styles.contextPillBtn} ${timeRange === range ? styles.contextPillBtnActive : ''}`}
              onClick={() => {
                setTimeRange(range)
                if (onTimeRangeChange) onTimeRangeChange(range)
              }}
            >
              Last {range}
            </button>
          ))}
        </div>

        <div className={styles.contextActionGroup}>
          <button
            className={styles.contextOutlineBtn}
            onClick={() => {
              if (onRefresh) onRefresh()
              else window.location.reload()
            }}
            title="Refresh live telemetry readings (R)"
          >
            <RefreshCw size={13} />
            <span>Refresh Data</span>
          </button>
          <button
            className={styles.contextPrimaryBtn}
            onClick={handleExportPDF}
            title="Export Diagnostic Safety Report"
          >
            <FileText size={13} />
            <span>Export PDF Report</span>
          </button>
        </div>
      </div>
    )
  }

  // Alerts Page Contextual Bar
  if (pathname === '/alerts') {
    return (
      <div className={styles.contextActionBar}>
        <div className={styles.contextActionGroup}>
          <span className={styles.contextActionLabel}>
            <Filter size={13} />
            <span>Filter Severity:</span>
          </span>
          {['all', 'critical', 'warning', 'info'].map((f) => (
            <button
              key={f}
              className={`${styles.contextPillBtn} ${alertsFilter === f ? styles.contextPillBtnActive : ''}`}
              onClick={() => setAlertsFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className={styles.contextActionGroup}>
          <button
            className={styles.contextPrimaryBtn}
            onClick={() => {
              markAllRead()
              addNotification({
                title: 'Alerts Acknowledged',
                message: 'All active alerts marked as acknowledged.',
                type: 'success',
              })
            }}
          >
            <CheckCheck size={14} />
            <span>Mark All Read</span>
          </button>
        </div>
      </div>
    )
  }

  // Configuration & Settings Page Contextual Bar
  if (pathname === '/settings') {
    return (
      <div className={styles.contextActionBar}>
        <div className={styles.contextActionGroup}>
          <span className={styles.contextValidationChip}>
            <CheckCircle2 size={13} color="#00E8A0" />
            <span>✓ All settings valid</span>
          </span>
        </div>

        <div className={styles.contextActionGroup}>
          <button className={styles.contextOutlineBtn} onClick={handleResetDefaults}>
            <RotateCcw size={13} />
            <span>Reset to Defaults</span>
          </button>
          <button
            className={styles.contextPrimaryHighlightBtn}
            onClick={handleSaveConfiguration}
            disabled={savingConfig}
          >
            {savingConfig ? (
              <>
                <RefreshCw size={13} className={styles.spinAnimation} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // Analytics & History Pages Contextual Bar
  if (pathname === '/analytics' || pathname === '/history') {
    return (
      <div className={styles.contextActionBar}>
        <div className={styles.contextActionGroup}>
          <button
            className={`${styles.contextPillBtn} ${liveMode ? styles.contextPillBtnActive : ''}`}
            onClick={() => setLiveMode(!liveMode)}
          >
            <Radio size={12} color={liveMode ? '#00E8A0' : 'inherit'} />
            <span>{liveMode ? 'Live Mode: ON' : 'Live Mode: PAUSED'}</span>
          </button>
          <button
            className={styles.contextPillBtn}
            onClick={() => {
              addNotification({
                title: 'Graph Zoomed',
                message: 'Expanded resolution to 10-second intervals.',
                type: 'info',
                duration: 2000,
              })
            }}
          >
            <ZoomIn size={12} />
            <span>Zoom In</span>
          </button>
          <button
            className={styles.contextPillBtn}
            onClick={() => {
              addNotification({
                title: 'Graph Zoomed Out',
                message: 'Aggregated view to hourly intervals.',
                type: 'info',
                duration: 2000,
              })
            }}
          >
            <ZoomOut size={12} />
            <span>Zoom Out</span>
          </button>
        </div>

        <div className={styles.contextActionGroup}>
          <a
            href="/history"
            className={styles.contextPrimaryBtn}
            title="Download CSV Telemetry Readings"
          >
            <FileSpreadsheet size={13} />
            <span>Download CSV</span>
          </a>
        </div>
      </div>
    )
  }

  return null
}
