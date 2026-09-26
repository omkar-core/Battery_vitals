'use client'

import React, { useState } from 'react'
import { authHeaders } from '../../lib/clientToken'
import styles from './ai.module.css'

export default function ThresholdSuggestModal({
  isOpen,
  onClose,
  onApplySelected,
}) {
  const [chemistry, setChemistry] = useState('LIFEPO4')
  const [series, setSeries] = useState(4)
  const [parallel, setParallel] = useState(1)
  const [criticality, setCriticality] = useState('STANDARD')
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState(null)
  const [selectedRows, setSelectedRows] = useState({})

  if (!isOpen) return null

  const handleFetchSuggestions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/threshold-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          chemistry,
          series: Number(series),
          parallel: Number(parallel),
          criticality,
        }),
      })
      const data = await res.json()
      if (res.ok && data.suggested) {
        setSuggestion(data)
        // Pre-check all rows by default
        const initialSelected = {}
        Object.keys(data.suggested).forEach((k) => {
          initialSelected[k] = true
        })
        setSelectedRows(initialSelected)
      }
    } catch (e) {
      console.warn('Failed to fetch threshold suggestions:', e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (key) => {
    setSelectedRows((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleApply = () => {
    if (!suggestion?.suggested) return
    const approved = {}
    Object.keys(suggestion.suggested).forEach((k) => {
      if (selectedRows[k]) {
        approved[k] = suggestion.suggested[k]
      }
    })
    if (onApplySelected) onApplySelected(approved)
    onClose()
  }

  const LABELS = {
    voltage_max: 'Overvoltage Cutoff (V)',
    voltage_min: 'Undervoltage Cutoff (V)',
    temp_warning: 'Temp Warning Threshold (°C)',
    temp_critical: 'Temp Critical Threshold (°C)',
    mq2_warning: 'MQ-2 Gas Warning (ADC)',
    mq2_critical: 'MQ-2 Gas Critical (ADC)',
  }

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #F0F4F8)' }}>
              AI Safety Threshold Advisor
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary, #8B95A5)', fontSize: 18, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--text-secondary, #8B95A5)', lineHeight: 1.45 }}>
          Specify operational conditions to generate conservative, physics-grounded threshold suggestions. You retain full control to accept or reject individual thresholds.
        </p>

        {/* Configuration inputs row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)', marginBottom: 4 }}>
              Chemistry
            </label>
            <select
              value={chemistry}
              onChange={(e) => setChemistry(e.target.value)}
              className={styles.chatInput}
              style={{ padding: '6px 8px' }}
            >
              <option value="LIFEPO4">LiFePO4</option>
              <option value="LI_ION">Li-ion</option>
              <option value="LEAD_ACID">Lead-Acid</option>
              <option value="NIMH">NiMH</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)', marginBottom: 4 }}>
              Series Cells
            </label>
            <input
              type="number"
              min={1}
              max={16}
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              className={styles.chatInput}
              style={{ padding: '6px 8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)', marginBottom: 4 }}>
              Parallel Strings
            </label>
            <input
              type="number"
              min={1}
              max={8}
              value={parallel}
              onChange={(e) => setParallel(e.target.value)}
              className={styles.chatInput}
              style={{ padding: '6px 8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)', marginBottom: 4 }}>
              Criticality
            </label>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value)}
              className={styles.chatInput}
              style={{ padding: '6px 8px' }}
            >
              <option value="STANDARD">Standard</option>
              <option value="HIGH">High Safety</option>
              <option value="MISSION_CRITICAL">Mission Critical</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleFetchSuggestions}
          disabled={loading}
          style={{
            background: 'var(--accent-primary, #00E8A0)',
            color: '#06090F',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          {loading ? '✨ Consulting AI Provider...' : '✨ Generate Recommendations'}
        </button>

        {/* Side-by-side comparison table */}
        {suggestion && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary, #4E5A6B)', marginBottom: 8 }}>
              Side-by-Side Parameter Comparison
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 6px', width: 32 }}>Apply</th>
                  <th style={{ padding: '8px 6px' }}>Parameter</th>
                  <th style={{ padding: '8px 6px' }}>Current</th>
                  <th style={{ padding: '8px 6px' }}>AI Suggested</th>
                  <th style={{ padding: '8px 6px' }}>Delta</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(suggestion.suggested).map((key) => {
                  const cur = suggestion.current[key] ?? '--'
                  const sug = suggestion.suggested[key] ?? '--'
                  const delta = suggestion.deltas[key] ?? 0
                  const isChecked = Boolean(selectedRows[key])

                  return (
                    <tr
                      key={key}
                      onClick={() => toggleRow(key)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        background: isChecked ? 'rgba(0, 232, 160, 0.08)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px 6px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRow(key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td style={{ padding: '8px 6px', color: 'var(--text-primary)' }}>
                        {LABELS[key] || key}
                      </td>
                      <td style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>
                        {cur}
                      </td>
                      <td style={{ padding: '8px 6px', color: 'var(--accent-primary, #00E8A0)', fontWeight: 700 }}>
                        {sug}
                      </td>
                      <td style={{ padding: '8px 6px', color: delta > 0 ? '#38BDF8' : delta < 0 ? '#FFB800' : 'var(--text-tertiary)' }}>
                        {delta > 0 ? `+${delta}` : `${delta}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {suggestion.rationale && (
              <div style={{ background: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Engineering Rationale:</strong> {suggestion.rationale}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={onClose}
                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                style={{ background: 'var(--accent-primary, #00E8A0)', color: '#06090F', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Apply Selected to Config
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
