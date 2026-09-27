'use client'

import React, { useEffect, useState } from 'react'
import { authHeaders } from '../lib/clientToken'
import styles from './components.module.css'

// Fleet device switcher. Persists the selected battery to localStorage
// (`bv_active_device`), then reloads so every page's realtime hook re-resolves.
export default function DeviceSwitcher({ compact = false }) {
  const [devices, setDevices] = useState([])
  const [active, setActive] = useState('')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bv_active_device')
      if (stored) setActive(stored)
    } catch (e) {}
    fetch('/api/devices', { headers: authHeaders() })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        if (d.success && Array.isArray(d.devices) && d.devices.length > 0) {
          setDevices(d.devices)
          // If no active device stored, default to first device
          if (!active) setActive(d.devices[0].deviceId)
        }
      })
      .catch(() => {})
  }, [active])

  const onChange = (e) => {
    const next = e.target.value
    setActive(next)
    try {
      localStorage.setItem('bv_active_device', next)
    } catch (err) {}
    window.location.reload()
  }

  if (devices.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title="No devices registered" aria-label="No devices">
          🔋
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          No devices registered
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }} title="Active fleet battery" aria-label="Active battery">
        🔋
      </span>
      <select
        className={styles.select}
        value={active}
        onChange={onChange}
        aria-label="Active battery"
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 6px',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          maxWidth: compact ? 92 : 120,
          cursor: 'pointer',
        }}
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.deviceId}
            {d.name && d.name !== d.deviceId ? ` · ${d.name.slice(0, 18)}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}