'use client'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import styles from '../../styles/pages.module.css'

export default function SettingsPage() {
  const { connected, data, sendControl } = useRealTimeData()
  const [profile, setProfile] = useState('LI_ION')
  const [sampleInterval, setSampleInterval] = useState(3)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => {})
  }, [])

  const applyProfile = () => sendControl('SET_PROFILE', profile)
  const applyInterval = () => sendControl('SET_SAMPLE_INTERVAL', sampleInterval)

  const diag = data?.diagnostics || {}

  return (
    <Layout connected={connected}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Chemistry Profile</h3>
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Battery Type</span>
          <select className={styles.select} value={profile} onChange={(e) => setProfile(e.target.value)}>
            <option value="LEAD_ACID">Lead Acid</option>
            <option value="LIPO">LiPo</option>
            <option value="LI_ION">Li-ion</option>
            <option value="LIFEPO4">LiFePO4</option>
          </select>
          <button className={styles.primaryBtn} onClick={applyProfile}>Apply</button>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Sampling</h3>
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>Sample Interval (s)</span>
          <input
            type="range" min="1" max="30" value={sampleInterval}
            onChange={(e) => setSampleInterval(Number(e.target.value))}
            className={styles.range}
          />
          <span className={styles.mono}>{sampleInterval}s</span>
          <button className={styles.primaryBtn} onClick={applyInterval}>Apply</button>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>System Connections</h3>
        <div className={styles.connList}>
          <div className={styles.connItem}>
            <span>MongoDB</span>
            <span className={status?.mongodb?.connected ? styles.ok : styles.err}>
              {status?.mongodb?.connected ? 'Connected' : (status?.mongodb?.configured ? 'Disconnected' : 'Not configured')}
            </span>
          </div>
          <div className={styles.connItem}>
            <span>Gemini AI</span>
            <span className={status?.gemini?.configured ? styles.ok : styles.err}>
              {status?.gemini?.configured ? 'Active' : 'Not configured'}
            </span>
          </div>
          <div className={styles.connItem}>
            <span>ESP32 Device</span>
            <span className={status?.esp32?.hasData ? styles.ok : styles.err}>
              {status?.esp32?.connected ? 'Online' : (status?.esp32?.hasData ? 'Offline' : 'No data yet')}
            </span>
          </div>
        </div>
      </div>
    </Layout>
  )
}
