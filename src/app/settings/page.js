'use client'

import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { useTheme } from '../../hooks/useTheme'
import {
  Settings,
  Sliders,
  Bell,
  HardDrive,
  Cpu,
  Download,
  Upload,
  Check,
  RotateCcw,
  Volume2,
  Moon,
  Sun,
  Shield,
  Trash2,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

const SETTINGS_KEY = 'bv_app_settings_v1'

const DEFAULT_SETTINGS = {
  nickname: 'Solar Li-ion Primary Bank',
  refreshRate: 2,
  tempUnit: 'C',
  theme: 'dark',
  defaultChartRange: '1H',
  animations: true,
  alertVolume: 80,
  quietHours: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  retentionDays: 90,
  autoDeleteOld: true,
  emailAlerts: false,
}

export default function SettingsPage() {
  const { connected, data, sendControl } = useRealTimeData()
  const { theme: activeTheme, setTheme } = useTheme()
  const [profile, setProfile] = useState('LI_ION')
  const [sampleInterval, setSampleInterval] = useState(2)
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(DEFAULT_SETTINGS)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {})

    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
      if (stored) setConfig({ ...DEFAULT_SETTINGS, ...stored })
    } catch (e) {}
  }, [])

  const saveSettings = (updated) => {
    setConfig(updated)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2000)
    } catch (e) {}
  }

  const applyProfile = () => {
    sendControl('SET_PROFILE', profile)
    alert(`Chemistry profile command sent to ESP32: ${profile}`)
  }

  const applyInterval = () => {
    sendControl('SET_SAMPLE_INTERVAL', sampleInterval)
    alert(`Sampling interval set to ${sampleInterval}s on ESP32`)
  }

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `battery_vital_config_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importConfig = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result)
        saveSettings({ ...DEFAULT_SETTINGS, ...parsed })
        alert('Configuration imported successfully.')
      } catch (err) {
        alert('Invalid JSON configuration file.')
      }
    }
    reader.readAsText(file)
  }

  const clearLocalCache = () => {
    if (confirm('Clear local telemetry cache and muted alerts?')) {
      localStorage.removeItem('bv_command_history_v2')
      localStorage.removeItem('bv_muted_alerts_map')
      alert('Local cache cleared.')
    }
  }

  return (
    <Layout connected={connected} lastSeen={data?.timestamp}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            System Settings &amp; <span className="gradText">Configuration</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Device telemetry preferences, chemistry models, alert behaviors, and persistence settings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportConfig}
            className={styles.filterBtn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={12} />
            <span>Export Config JSON</span>
          </button>

          <label
            className={styles.filterBtn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          >
            <Upload size={12} />
            <span>Import Config</span>
            <input type="file" accept=".json" onChange={importConfig} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {savedSuccess && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(0, 232, 160, 0.1)',
            border: '1px solid rgba(0, 232, 160, 0.3)',
            borderRadius: 8,
            color: '#00E8A0',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Check size={14} /> Preferences updated and saved to local configuration.
        </div>
      )}

      {/* 1. GENERAL SETTINGS */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={16} color="#00E8A0" />
          General Preferences
        </h3>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Device Nickname</span>
          <input
            className={styles.select}
            style={{ flex: 1, maxWidth: 300 }}
            value={config.nickname}
            onChange={(e) => saveSettings({ ...config, nickname: e.target.value })}
          />
        </div>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Telemetry Refresh Rate</span>
          <select
            className={styles.select}
            value={config.refreshRate}
            onChange={(e) => saveSettings({ ...config, refreshRate: Number(e.target.value) })}
          >
            <option value={1}>1 second (Ultra-responsive)</option>
            <option value={2}>2 seconds (Standard Default)</option>
            <option value={5}>5 seconds (Battery saver)</option>
            <option value={10}>10 seconds (Low bandwidth)</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Temperature Unit</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`${styles.filterBtn} ${config.tempUnit === 'C' ? styles.filterActive : ''}`}
              onClick={() => saveSettings({ ...config, tempUnit: 'C' })}
            >
              Celsius (°C)
            </button>
            <button
              className={`${styles.filterBtn} ${config.tempUnit === 'F' ? styles.filterActive : ''}`}
              onClick={() => saveSettings({ ...config, tempUnit: 'F' })}
            >
              Fahrenheit (°F)
            </button>
          </div>
        </div>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Color Theme</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`${styles.filterBtn} ${activeTheme === 'dark' ? styles.filterActive : ''}`}
              onClick={() => {
                setTheme('dark')
                saveSettings({ ...config, theme: 'dark' })
              }}
            >
              <Moon size={12} /> Dark Aurora
            </button>
            <button
              className={`${styles.filterBtn} ${activeTheme === 'light' ? styles.filterActive : ''}`}
              onClick={() => {
                setTheme('light')
                saveSettings({ ...config, theme: 'light' })
              }}
            >
              <Sun size={12} /> High Contrast Light
            </button>
          </div>
        </div>
      </div>

      {/* 2. CHEMISTRY PROFILE & HARDWARE SETTINGS */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={16} color="#FFD60A" />
          Hardware &amp; Battery Chemistry Model
        </h3>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Battery Chemistry</span>
          <select className={styles.select} value={profile} onChange={(e) => setProfile(e.target.value)}>
            <option value="LI_ION">Lithium-Ion (3.7V / 4.2V nominal)</option>
            <option value="LIFEPO4">Lithium Iron Phosphate (LiFePO4 3.2V)</option>
            <option value="LEAD_ACID">Lead-Acid (12.0V / 14.4V Float)</option>
            <option value="AGM">Absorbent Glass Mat (AGM)</option>
            <option value="GEL">Gel Cell Lead-Acid</option>
          </select>
          <button className={styles.primaryBtn} onClick={applyProfile}>
            Apply to ESP32
          </button>
        </div>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>ESP32 Loop Interval</span>
          <input
            type="range"
            min="1"
            max="15"
            value={sampleInterval}
            onChange={(e) => setSampleInterval(Number(e.target.value))}
            className={styles.range}
          />
          <span className={styles.mono}>{sampleInterval}s</span>
          <button className={styles.primaryBtn} onClick={applyInterval}>
            Set Interval
          </button>
        </div>
      </div>

      {/* 3. ALERT PREFERENCES */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} color="#FF6B35" />
          Alert &amp; Audio Notifications
        </h3>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Alert Chime Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            value={config.alertVolume}
            onChange={(e) => saveSettings({ ...config, alertVolume: Number(e.target.value) })}
            className={styles.range}
          />
          <span className={styles.mono}>{config.alertVolume}%</span>
        </div>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Quiet Hours (Mute Audio)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={config.quietHours}
              onChange={(e) => saveSettings({ ...config, quietHours: e.target.checked })}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Enable Quiet Hours</span>
            {config.quietHours && (
              <span style={{ fontSize: 11, color: '#9AA7BF', marginLeft: 8 }}>
                {config.quietStart} to {config.quietEnd}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4. DATA RETENTION & CACHE */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardDrive size={16} color="#A78BFA" />
          Data Retention &amp; Local Storage
        </h3>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>MongoDB TTL Retention</span>
          <span className={styles.mono}>90 Days (Automated Rolling Deletion)</span>
        </div>

        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Local Command &amp; Alert Cache</span>
          <button
            onClick={clearLocalCache}
            className={styles.filterBtn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FF2D55' }}
          >
            <Trash2 size={12} />
            <span>Clear Local Storage Cache</span>
          </button>
        </div>
      </div>

      {/* 5. READ-ONLY SYSTEM DIAGNOSTICS INFO */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color="#38BDF8" />
          System Information (Read-Only)
        </h3>

        <div className={styles.connList}>
          <div className={styles.connItem}>
            <span>Firmware Revision</span>
            <span className={styles.mono} style={{ color: '#00E8A0' }}>
              v10.2.0-esp32-release
            </span>
          </div>
          <div className={styles.connItem}>
            <span>Hardware Model</span>
            <span className={styles.mono}>ESP32 Dual-Core Xtensa LX6 (240MHz)</span>
          </div>
          <div className={styles.connItem}>
            <span>Device Identifier</span>
            <span className={styles.mono}>BV001 (Node 1)</span>
          </div>
          <div className={styles.connItem}>
            <span>Battery Pack Asset ID</span>
            <span className={styles.mono}>BAT001 (4S Li-ion Solar Cell Bank)</span>
          </div>
          <div className={styles.connItem}>
            <span>MongoDB Atlas Cluster</span>
            <span className={status?.mongodb?.connected ? styles.ok : styles.err}>
              {status?.mongodb?.connected ? 'Connected & Indexed' : 'Connecting / Fallback'}
            </span>
          </div>
          <div className={styles.connItem}>
            <span>HiveMQ Cloud Broker</span>
            <span className={styles.mono} style={{ color: '#38BDF8' }}>
              mqtts://xxx.s1.eu.hivemq.cloud:8883
            </span>
          </div>
          <div className={styles.connItem}>
            <span>Google Gemini AI Engine</span>
            <span className={status?.gemini?.configured ? styles.ok : styles.err}>
              {status?.gemini?.configured ? 'Gemini 1.5 Flash Active' : 'API Key Missing'}
            </span>
          </div>
        </div>
      </div>
    </Layout>
  )
}
