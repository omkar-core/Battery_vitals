'use client'

import React, { useState, useEffect } from 'react'
import { Sliders, Save, Check, RefreshCw } from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function AlertConfig() {
  const [config, setConfig] = useState({
    battery: {
      voltage_min: 10.5,
      voltage_max: 14.6,
      current_max: 15.0,
      temperature_max: 45.0,
      soc_critical: 10.0,
    },
    environmental: {
      temperature_max: 40.0,
      humidity_max: 80.0,
      mq2_threshold: 800,
      mq135_threshold: 500,
    },
  })
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/alerts/config')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.battery) setConfig(data)
      })
      .catch(() => {})
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } finally {
      setLoading(false)
    }
  }

  const updateBat = (field, val) => {
    setConfig((prev) => ({
      ...prev,
      battery: { ...prev.battery, [field]: parseFloat(val) || 0 },
    }))
  }

  const updateEnv = (field, val) => {
    setConfig((prev) => ({
      ...prev,
      environmental: { ...prev.environmental, [field]: parseFloat(val) || 0 },
    }))
  }

  return (
    <form onSubmit={handleSave} className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={18} color="#00E8A0" />
          <h3 className={styles.cardTitle}>Custom Safety Threshold Configuration</h3>
        </div>
        <button
          type="submit"
          disabled={loading}
          className={styles.primaryBtn}
          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Thresholds'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Battery Thresholds */}
        <div style={{ background: 'var(--bg-surface-raised)', padding: 16, borderRadius: 12 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#00E8A0', fontWeight: 700 }}>
            🔋 Battery Voltage &amp; Current Limits
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Minimum Voltage (V_MIN Trip)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.battery.voltage_min}
                onChange={(e) => updateBat('voltage_min', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Maximum Voltage (V_MAX Overvoltage)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.battery.voltage_max}
                onChange={(e) => updateBat('voltage_max', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Maximum Current (Overcurrent A)
              </label>
              <input
                type="number"
                step="0.5"
                value={config.battery.current_max}
                onChange={(e) => updateBat('current_max', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
        </div>

        {/* Environmental Thresholds */}
        <div style={{ background: 'var(--bg-surface-raised)', padding: 16, borderRadius: 12 }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#FFB800', fontWeight: 700 }}>
            🌡️ Environmental &amp; Gas Limits
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Max Ambient Temperature (°C)
              </label>
              <input
                type="number"
                step="1"
                value={config.environmental.temperature_max}
                onChange={(e) => updateEnv('temperature_max', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                MQ-2 Gas / Smoke Alarm Threshold (ppm)
              </label>
              <input
                type="number"
                step="50"
                value={config.environmental.mq2_threshold}
                onChange={(e) => updateEnv('mq2_threshold', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                MQ-135 Air Quality / CO₂ Alarm Threshold (ppm)
              </label>
              <input
                type="number"
                step="25"
                value={config.environmental.mq135_threshold}
                onChange={(e) => updateEnv('mq135_threshold', e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
