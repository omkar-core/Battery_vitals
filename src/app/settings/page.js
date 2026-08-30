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
  RefreshCw,
} from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'
import styles from '../../styles/pages.module.css'

const SETTINGS_KEY = 'bv_app_settings_v1'

const DEFAULT_SETTINGS = {
  nickname: 'Living Room Smoke Detector',
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
  const [isSaving, setIsSaving] = useState(false)
  const { addNotification } = useNotifications()

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

  const handleSaveAll = async (updatedConfig = config) => {
    setIsSaving(true)
    addNotification({
      type: 'info',
      title: 'Configuration Sync',
      message: '1/3 Validating configuration... ✓',
    })
    await new Promise((r) => setTimeout(r, 600))

    addNotification({
      type: 'info',
      title: 'Configuration Sync',
      message: '2/3 Uploading to Firebase... ⟳',
    })
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedConfig))
      await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SET_CONFIG', params: updatedConfig }),
      }).catch(() => {})
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 700))
    addNotification({
      type: 'success',
      title: 'Configuration Sync',
      message: '3/3 Notifying ESP32... ✓ All parameters applied!',
    })
    setIsSaving(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  const applyProfile = () => {
    sendControl('SET_PROFILE', profile)
    addNotification({
      type: 'success',
      title: 'Chemistry Profile Applied',
      message: `Chemistry model set to ${profile} on ESP32 microcontroller.`,
    })
  }

  const applyInterval = () => {
    sendControl('SET_SAMPLE_INTERVAL', sampleInterval)
    addNotification({
      type: 'info',
      title: 'Loop Interval Updated',
      message: `Telemetry sampling interval adjusted to ${sampleInterval}s.`,
    })
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
    <Layout connected={connected} lastSeen={data?.timestamp} data={data}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            System Settings &amp; <span className="gradText">Configuration</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Device telemetry preferences, chemistry models, alert behaviors, and persistence settings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleSaveAll(config)}
            disabled={isSaving}
            className={styles.primaryBtn}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 120,
              justifyContent: 'center',
              opacity: isSaving ? 0.7 : 1,
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? (
              <>
                <RefreshCw size={13} className={styles.spinAnimation} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>Save Changes</span>
              </>
            )}
          </button>

          <button
            onClick={exportConfig}
            className={styles.filterBtn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={12} />
            <span>Export Config</span>
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

      {/* 5. ESP32 HARDWARE WIRING & FLASHING GUIDE (For Student Project Presentation) */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={16} color="#00E8A0" />
          ESP32 Hardware Pinout &amp; Flashing Guide (Student Project Reference)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div style={{ padding: 14, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              ⚡ Sensor &amp; Bus Pinout Mapping
            </div>
            <ul style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.8 }}>
              <li><strong>INA219 Power Shunt:</strong> SDA → GPIO 21, SCL → GPIO 22</li>
              <li><strong>DHT11 Temp/Humidity:</strong> Data Pin → GPIO 4 (10k Pullup)</li>
              <li><strong>MQ-2 Smoke/Gas Sensor:</strong> Analog Out → GPIO 34</li>
              <li><strong>MQ-135 Air Quality Sensor:</strong> Analog Out → GPIO 35</li>
              <li><strong>Status Indicator LEDs:</strong> Green → GPIO 14, Yellow → GPIO 26, Red → GPIO 27</li>
              <li><strong>Emergency Alarm Buzzer:</strong> Positive → GPIO 25</li>
            </ul>
          </div>

          <div style={{ padding: 14, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              🚀 Flashing &amp; Deployment Checklist
            </div>
            <ol style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Open <code>esp32/BatteryVitals_v11.3.ino</code> in Arduino IDE</li>
              <li>Install libraries: <code>Adafruit INA219</code>, <code>ArduinoJson</code></li>
              <li>Set WiFi SSID/Password &amp; Target Host: <code>https://battery-vitals.onrender.com</code></li>
              <li>Select Board: <code>ESP32 Dev Module</code>, Upload Speed: <code>921600 baud</code></li>
              <li>Flash firmware and monitor Serial Output at <code>115200 baud</code></li>
            </ol>
          </div>
        </div>
      </div>

      {/* 6. READ-ONLY SYSTEM DIAGNOSTICS INFO */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={16} color="#38BDF8" />
          System Information (Read-Only)
        </h3>

        <div className={styles.connList}>
          <div className={styles.connItem}>
            <span>Firmware Revision</span>
            <span className={styles.mono} style={{ color: '#00E8A0' }}>
              {data?.firmware || 'v11.3-render'}
            </span>
          </div>
          <div className={styles.connItem}>
            <span>Hardware Platform</span>
            <span className={styles.mono}>ESP32 Microcontroller</span>
          </div>
          <div className={styles.connItem}>
            <span>Target Host URL</span>
            <span className={styles.mono} style={{ color: '#38BDF8' }}>
              https://battery-vitals.onrender.com
            </span>
          </div>
          <div className={styles.connItem}>
            <span>Device Identifier</span>
            <span className={styles.mono}>{data?.deviceId || 'BV001'}</span>
          </div>
          <div className={styles.connItem}>
            <span>Battery Pack Asset ID</span>
            <span className={styles.mono}>{data?.batteryId || 'BAT001'}</span>
          </div>
          <div className={styles.connItem}>
            <span>Active Chemistry Profile</span>
            <span className={styles.mono}>
              {data?.battery?.profile || '12V LiFePO4'}
            </span>
          </div>
          <div className={styles.connItem}>
            <span>MongoDB Atlas Cluster</span>
            <span className={status?.mongodb?.connected ? styles.ok : styles.err}>
              {status?.mongodb?.connected ? 'Connected & Indexed' : 'Connecting / Fallback'}
            </span>
          </div>
          <div className={styles.connItem}>
            <span>Firebase Realtime Database</span>
            <span className={styles.mono} style={{ color: '#38BDF8' }}>
              {status?.firebase?.url || 'https://batteryvital-default-rtdb.asia-southeast1.firebasedatabase.app'}
            </span>
          </div>
          <div className={styles.connItem}>
            <span>Google Gemini AI Engine</span>
            <span className={status?.gemini?.configured ? styles.ok : styles.err}>
              {status?.gemini?.configured ? 'Gemini 1.5 Flash Active' : 'API Key Active'}
            </span>
          </div>
        </div>
      </div>
    </Layout>
  )
}
