'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { authHeaders } from '../../lib/clientToken'
import styles from '../../styles/pages.module.css'

import LabelScanResult from '../ai/LabelScanResult'
import ThresholdSuggestModal from '../ai/ThresholdSuggestModal'

function compressImage(file, maxDimension = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Battery Profile manager: user selects chemistry/config/capacity, webapp
// compatibility-gates it, operator deploys numeric limits to the ESP32.
// The ESP32 never guesses chemistry from voltage.
export default function BatteryProfileManager({ batteryId = 'BAT001' }) {
  const [profiles, setProfiles] = useState([])
  const [active, setActive] = useState(null)
  const [selected, setSelected] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    chemistry: 'LI_ION',
    series: 3,
    parallel: 1,
    capacityAh: 3,
    serialNumber: '',
    manufacturer: '',
    cellModel: '',
    bmsType: '',
    location: '',
    useCase: '',
    mfgDate: '',
    installDate: '',
    ratedEnergyWh: '',
    maxContinuousPowerW: '',
    recommendedChargeRateA: '',
    recommendedDischargeRateA: '',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanData, setScanData] = useState(null)
  const [scanImagePreview, setScanImagePreview] = useState(null)
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false)

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setScanning(true)
      setStatus('Compressing & analyzing battery label photo with AI...')
      const base64 = await compressImage(file, 1024, 0.8)
      setScanImagePreview(base64)
      const res = await fetch('/api/ai/label-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ imageBase64: base64 }),
      })
      const json = await res.json()
      if (res.ok && json.extracted) {
        setScanData(json.extracted)
        setScanModalOpen(true)
        setStatus('✅ AI label scan completed')
      } else {
        setStatus(`❌ Label scan failed: ${json.error || 'unrecognized image'}`)
      }
    } catch (err) {
      setStatus('❌ Network error during label scan')
    } finally {
      setScanning(false)
    }
  }

  const applyScanToForm = (extracted) => {
    setForm({
      name: `${extracted.manufacturer || ''} ${extracted.model || ''}`.trim() || `${extracted.series}S ${extracted.chemistry} Pack`,
      chemistry: extracted.chemistry || 'LI_ION',
      series: extracted.series || 3,
      parallel: extracted.parallel || 1,
      capacityAh: extracted.capacityAh || 3,
    })
    setScanModalOpen(false)
    setStatus('✅ Form pre-filled from AI Label Scan')
  }

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        fetch('/api/battery/profiles', { headers: { ...authHeaders() } }).then((r) => r.json()),
        fetch(`/api/battery/active?batteryId=${encodeURIComponent(batteryId)}`, { headers: { ...authHeaders() } }).then((r) => r.json()),
      ])
      if (Array.isArray(p?.profiles)) setProfiles(p.profiles)
      setActive(a || null)
      if (a?.profileId) setSelected(a.profileId)
    } catch (e) {
      setStatus('Failed to load profiles')
    }
  }, [batteryId])

  useEffect(() => { load() }, [load])

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus('')
    try {
      const res = await fetch('/api/battery/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ ...form, series: Number(form.series), parallel: Number(form.parallel), capacityAh: Number(form.capacityAh) || undefined }),
      })
      const data = await res.json()
      if (data?.profile) {
        setStatus(data.compatibility?.compatible ? `✅ Profile ${data.profile.profileId} ready` : `⚠️ Stored but blocked: ${(data.compatibility?.reasons || []).join('; ')}`)
        load()
      } else {
        setStatus(`❌ ${data?.error || 'Create failed'}`)
      }
    } catch (e) {
      setStatus('❌ Create failed')
    } finally {
      setBusy(false)
    }
  }

  const deploy = async () => {
    if (!selected) return
    setBusy(true)
    setStatus('')
    try {
      const res = await fetch('/api/battery/profiles/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ deviceId: batteryId, profileId: selected }),
      })
      const data = await res.json()
      setStatus(data?.success ? `🚀 Deployed ${selected} to ${batteryId} (v${data?.esp32?.config_version ?? '?'})` : `❌ Deploy blocked: ${data?.error || 'unknown'}${data?.compatibility ? ` — ${(data.compatibility.reasons || []).join('; ')}` : ''}`)
      load()
    } catch (e) {
      setStatus('❌ Deploy failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.card} style={{ marginBottom: 20 }}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>🔋 Battery Profile (fixed hardware + deployable limits)</h3>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {active?.profileId ? `Active: ${active.profileId}` : '⚠️ UNKNOWN BATTERY — no profile deployed'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 12 }}>Deploy to {batteryId}
          <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8 }}>
            <option value="">— Select profile —</option>
            {profiles.map((p) => (
              <option key={p.profileId} value={p.profileId}>{p.profileId} — {p.name}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button type="button" onClick={deploy} disabled={busy || !selected} className={styles.primaryBtn} style={{ padding: '8px 16px' }}>
            🚀 {busy ? 'Working…' : 'Deploy to ESP32'}
          </button>
          <button type="button" onClick={load} className={styles.secondaryBtn} style={{ padding: '8px 16px' }}>↻ Refresh</button>
        </div>
      </div>

      {active?.compatibility && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
          Compatibility: {active.compatibility.compatible ? '✅ PASS' : '❌ REJECT'} — {(active.compatibility.reasons || []).join('; ') || 'all gates pass'}
        </p>
      )}

      <form onSubmit={create} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
        <label style={{ fontSize: 12 }}>Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="3S 18650 Li-ion Pack" style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8 }} />
        </label>
        <label style={{ fontSize: 12 }}>Chemistry
          <select value={form.chemistry} onChange={(e) => setForm({ ...form, chemistry: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8 }}>
            {['LI_ION', 'LIFEPO4', 'LEAD_ACID', 'NIMH', 'CUSTOM'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Series
          <input type="number" min="1" max="16" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8 }} />
        </label>
        <label style={{ fontSize: 12 }}>Parallel
          <input type="number" min="1" max="8" value={form.parallel} onChange={(e) => setForm({ ...form, parallel: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8 }} />
        </label>
        <label style={{ fontSize: 12 }}>Capacity (Ah)
          <input type="number" step="0.1" min="0.1" value={form.capacityAh} onChange={(e) => setForm({ ...form, capacityAh: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8 }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <button type="submit" disabled={busy} className={styles.secondaryBtn} style={{ padding: '8px 16px' }}>➕ Save profile</button>
          <label className={styles.secondaryBtn} style={{ padding: '8px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span>📷 {scanning ? 'Scanning...' : 'Scan Label with AI'}</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} disabled={scanning} style={{ display: 'none' }} />
          </label>
          <button type="button" onClick={() => setThresholdModalOpen(true)} className={styles.secondaryBtn} style={{ padding: '8px 14px', fontSize: 12 }}>
            ✨ Suggest Thresholds with AI
          </button>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={styles.secondaryBtn}
            style={{ padding: '8px 14px', fontSize: 12 }}
          >
            ⚙️ {showAdvanced ? 'Hide Advanced Specs' : 'Detailed Specs & Passport Metadata'}
          </button>
        </div>

        {showAdvanced && (
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, marginTop: 8 }}>
            <label style={{ fontSize: 11 }}>Serial Number
              <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="SN-2026-LFP-009" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Cell Manufacturer
              <input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="CATL / EVE / Samsung" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Cell Model
              <input value={form.cellModel} onChange={(e) => setForm({ ...form, cellModel: e.target.value })} placeholder="LF105 / INR18650" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>BMS / Protection Board
              <input value={form.bmsType} onChange={(e) => setForm({ ...form, bmsType: e.target.value })} placeholder="Daly 4S 30A / JBD Smart" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Use Case / Location
              <input value={form.useCase} onChange={(e) => setForm({ ...form, useCase: e.target.value })} placeholder="Solar ESS / Lab Bench 2" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Manufacturing Date
              <input type="date" value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Rated Energy (Wh)
              <input type="number" step="1" value={form.ratedEnergyWh} onChange={(e) => setForm({ ...form, ratedEnergyWh: e.target.value })} placeholder="128 Wh" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Max Continuous Power (W)
              <input type="number" step="1" value={form.maxContinuousPowerW} onChange={(e) => setForm({ ...form, maxContinuousPowerW: e.target.value })} placeholder="150 W" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Rec. Charge Rate (A)
              <input type="number" step="0.1" value={form.recommendedChargeRateA} onChange={(e) => setForm({ ...form, recommendedChargeRateA: e.target.value })} placeholder="2.5 A" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
            <label style={{ fontSize: 11 }}>Rec. Discharge Rate (A)
              <input type="number" step="0.1" value={form.recommendedDischargeRateA} onChange={(e) => setForm({ ...form, recommendedDischargeRateA: e.target.value })} placeholder="5.0 A" style={{ display: 'block', width: '100%', marginTop: 4, padding: 6, borderRadius: 6 }} />
            </label>
          </div>
        )}
      </form>

      {scanModalOpen && scanData && (
        <div style={{ marginTop: 16 }}>
          <LabelScanResult
            extractedData={scanData}
            imagePreview={scanImagePreview}
            onSaveToProfile={applyScanToForm}
            onCancel={() => setScanModalOpen(false)}
          />
        </div>
      )}

      {thresholdModalOpen && (
        <ThresholdSuggestModal
          isOpen={thresholdModalOpen}
          onClose={() => setThresholdModalOpen(false)}
          onApplySelected={(approved) => {
            setStatus('✅ AI suggested thresholds staged for verification')
            setThresholdModalOpen(false)
          }}
        />
      )}

      {status && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '12px 0 0' }}>{status}</p>}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
        Manufacturer limits override chemistry defaults. INA219 bus ≈26V with headroom; voltage/current gates must pass before deploy. DHT is ambient-only; trips without a rated cutoff are alarms, not power breaks.
      </p>
    </div>
  )
}
