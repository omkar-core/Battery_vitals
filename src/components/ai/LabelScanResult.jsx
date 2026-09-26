'use client'

import React, { useState } from 'react'
import styles from './ai.module.css'

export default function LabelScanResult({
  extractedData,
  imagePreview,
  onSaveToProfile,
  onCancel,
}) {
  const [form, setForm] = useState({
    chemistry: extractedData?.chemistry || 'LIFEPO4',
    series: extractedData?.series || 4,
    parallel: extractedData?.parallel || 1,
    nominalVoltage: extractedData?.nominalVoltage || 12.8,
    capacityAh: extractedData?.capacityAh || 2.6,
    manufacturer: extractedData?.manufacturer || '',
    model: extractedData?.model || '',
  })

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (onSaveToProfile) onSaveToProfile(form)
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ AI Label Scan</span>
          <h3 className={styles.cardTitle}>Extracted Battery Specifications</h3>
        </div>
        <span style={{ fontSize: 11, color: 'var(--accent-primary, #00E8A0)' }}>
          Review & Confirm
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Thumbnail */}
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
            Uploaded Label Photo
          </div>
          <div
            style={{
              width: '100%',
              height: 200,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreview}
                alt="Battery Label"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: 32 }}>📷</span>
            )}
          </div>
          {extractedData?.rawTextExtracted && (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary, #4E5A6B)', fontFamily: 'monospace' }}>
              OCR: {extractedData.rawTextExtracted.slice(0, 80)}...
            </div>
          )}
        </div>

        {/* Right: Editable Fields with "AI-detected" tags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A5)' }}>Battery Chemistry</label>
              <span style={{ fontSize: 10, color: '#38BDF8', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 6px', borderRadius: 4 }}>✨ AI-detected</span>
            </div>
            <select
              value={form.chemistry}
              onChange={(e) => handleChange('chemistry', e.target.value)}
              className={styles.chatInput}
              style={{ width: '100%', padding: '6px 10px' }}
            >
              <option value="LIFEPO4">LiFePO4</option>
              <option value="LI_ION">Li-ion</option>
              <option value="LEAD_ACID">Lead-Acid</option>
              <option value="NIMH">NiMH</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A5)' }}>Series (S)</label>
                <span style={{ fontSize: 10, color: '#38BDF8' }}>✨</span>
              </div>
              <input
                type="number"
                value={form.series}
                onChange={(e) => handleChange('series', Number(e.target.value))}
                className={styles.chatInput}
                style={{ width: '100%', padding: '6px 10px' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-secondary, #8B95A5)' }}>Capacity (Ah)</label>
                <span style={{ fontSize: 10, color: '#38BDF8' }}>✨</span>
              </div>
              <input
                type="number"
                step="0.1"
                value={form.capacityAh}
                onChange={(e) => handleChange('capacityAh', Number(e.target.value))}
                className={styles.chatInput}
                style={{ width: '100%', padding: '6px 10px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary, #8B95A5)', marginBottom: 4 }}>Manufacturer</label>
              <input
                type="text"
                value={form.manufacturer}
                onChange={(e) => handleChange('manufacturer', e.target.value)}
                className={styles.chatInput}
                style={{ width: '100%', padding: '6px 10px' }}
                placeholder="e.g. Relion"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary, #8B95A5)', marginBottom: 4 }}>Model</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                className={styles.chatInput}
                style={{ width: '100%', padding: '6px 10px' }}
                placeholder="e.g. RB100"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            {onCancel && (
              <button
                onClick={onCancel}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            )}
            <button
              onClick={handleSave}
              style={{
                background: 'var(--accent-primary, #00E8A0)',
                color: '#06090F',
                border: 'none',
                borderRadius: 8,
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Save to Profile Library
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
