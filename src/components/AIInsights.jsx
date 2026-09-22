'use client'

import { useState, useMemo } from 'react'
import styles from './components.module.css'

const STATUS_META = {
  EMERGENCY: { label: 'EMERGENCY HAZARD', color: '#FF2D55', bg: 'rgba(255,45,85,0.16)', icon: '🚨' },
  CRITICAL: { label: 'CRITICAL HAZARD', color: '#FF2D55', bg: 'rgba(255,45,85,0.16)', icon: '🚨' },
  WARNING: { label: 'SAFETY WARNING', color: '#FF6B35', bg: 'rgba(255,107,53,0.16)', icon: '⚠️' },
  CAUTION: { label: 'MODERATE CAUTION', color: '#FFD60A', bg: 'rgba(255,214,10,0.14)', icon: '⚠️' },
  UNKNOWN: { label: 'DATA INSUFFICIENT', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: '🛡️' },
  SAFE: { label: 'SYSTEM OPTIMAL', color: '#00E8A0', bg: 'rgba(0,232,160,0.14)', icon: '🛡️' },
}

const SEVERITY_COLOR = {
  INFO: '#94A3B8',
  LOW: '#38BDF8',
  MEDIUM: '#FFD60A',
  HIGH: '#FF6B35',
  CRITICAL: '#FF2D55',
}

export default function AIInsights({ analysis, result, loading = false, onAnalyze }) {
  const [inputMode, setInputMode] = useState(false)
  const [form, setForm] = useState({})
  const [copied, setCopied] = useState(false)
  const [rawView, setRawView] = useState(false)

  // Collapsible section toggles for detailed insights
  const [openSections, setOpenSections] = useState({
    summary: true,
    findings: true,
    anomalies: true,
    recommendations: true,
    predictions: true,
    safety: true,
  })

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const fields = ['voltage', 'current', 'temperature', 'humidity', 'soc', 'bhi', 'safety', 'resistance', 'power']

  const submit = () => {
    if (onAnalyze) onAnalyze(form)
  }

  const structured = result && typeof result === 'object'
  const copyText = structured ? JSON.stringify(result, null, 2) : analysis

  const handleCopy = () => {
    if (!copyText) return
    navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!copyText) return
    const blob = new Blob([copyText], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `battery_vital_ai_report_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const riskMeta = useMemo(() => {
    if (structured) {
      const key = (result.overall_status || 'UNKNOWN').toUpperCase()
      return STATUS_META[key] || STATUS_META.UNKNOWN
    }
    if (!analysis) return STATUS_META.SAFE
    const text = typeof analysis === 'string' ? analysis.toLowerCase() : ''
    if (text.includes('critical') || text.includes('emergency') || text.includes('runaway')) return STATUS_META.CRITICAL
    if (text.includes('warning') || text.includes('high risk') || text.includes('elevated')) return STATUS_META.WARNING
    if (text.includes('caution') || text.includes('moderate')) return STATUS_META.CAUTION
    if (text.includes('not reported') || text.includes('cannot')) return STATUS_META.UNKNOWN
    return STATUS_META.SAFE
  }, [result, analysis, structured])

  // Loading steps
  const LOADING_STAGES = [
    'Retrieving live ESP32 telemetry & I2C sensor bus',
    'Validating sensor ranges & deterministic threshold bounds',
    'Querying Gemini AI Safety Intelligence Engine',
    'Synthesizing risk appraisal & condition recommendations',
  ]

  // Extract snapshot telemetry values from structured result or form
  const snapshotData = useMemo(() => {
    if (!structured) return null
    return {
      voltage: result.voltage != null ? Number(result.voltage) : null,
      current: result.current != null ? Number(result.current) : null,
      temperature: result.temperature != null ? Number(result.temperature) : null,
      humidity: result.humidity != null ? Number(result.humidity) : null,
      soc: result.soc != null ? Number(result.soc) : null,
      gas: result.gas_ppm != null ? Number(result.gas_ppm) : null,
      power: result.power != null ? Number(result.power) : null,
      resistance: result.internal_resistance != null ? Number(result.internal_resistance) : null,
    }
  }, [structured, result])

  return (
    <div className={styles.aiCard}>
      {/* Top Header & Action Bar */}
      <div className={styles.aiHeader}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-strong)',
            fontSize: 20,
          }}
        >
          🤖
        </div>
        <div style={{ flex: 1 }}>
          <h3 className={styles.panelTitle} style={{ margin: 0, fontSize: 16 }}>
            AI Safety &amp; Degradation Intelligence
          </h3>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
            Deterministic safety validation &rarr; Neural risk appraisal &rarr; Verified condition insights
          </div>
        </div>

        {(analysis || result) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={handleCopy}
              className={styles.secondaryBtn}
              style={{ padding: '6px 12px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              title="Copy analysis JSON to clipboard"
            >
              <span>{copied ? '✅' : '📋'}</span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className={styles.secondaryBtn}
              style={{ padding: '6px 12px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              title="Download analysis report as JSON"
            >
              <span>💾</span>
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => setRawView(!rawView)}
              className={styles.secondaryBtn}
              style={{ padding: '6px 12px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
              title="Toggle raw view"
            >
              <span>📄</span>
              <span>{rawView ? 'Card View' : 'Raw'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Trigger Actions */}
      <div className={styles.aiActions}>
        <button
          className={styles.primaryBtn}
          disabled={loading}
          onClick={() => {
            setInputMode(false)
            if (onAnalyze) onAnalyze({})
          }}
        >
          {loading ? (
            <>
              <span className={styles.spin}>⚙️</span>
              <span>Running AI Safety Diagnostic...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>Run AI Safety Diagnostic</span>
            </>
          )}
        </button>
        <button
          className={styles.secondaryBtn}
          disabled={loading}
          onClick={() => setInputMode(!inputMode)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <span>⚙️</span>
          <span>{inputMode ? 'Close Custom Simulation' : 'Simulate Custom Telemetry'}</span>
        </button>
      </div>

      {/* Custom Simulation Form */}
      {inputMode && (
        <div className={styles.aiForm}>
          <div className={styles.aiFormLabel}>Simulate Custom Battery &amp; Sensor Telemetry</div>
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
            Override live ESP32 readings with test parameters to validate deterministic safety thresholds and AI anomaly detection.
          </p>
          <div className={styles.aiGrid}>
            {fields.map((f) => (
              <label key={f} className={styles.aiField}>
                <span className={styles.aiLabel}>{f.toUpperCase()}</span>
                <input
                  className={styles.aiInput}
                  value={form[f] ?? ''}
                  placeholder={`e.g. ${f === 'voltage' ? '12.4' : f === 'temperature' ? '28.5' : f === 'soc' ? '80' : '--'}`}
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <button className={styles.primaryBtn} style={{ marginTop: 14 }} onClick={submit}>
            Evaluate Simulated Parameters
          </button>
        </div>
      )}

      {/* Loading State: Staged Pipeline Indicator */}
      {loading ? (
        <div className={styles.aiLoading}>
          <div className={styles.aiBrainPulseWrap} style={{ fontSize: 44, textAlign: 'center' }}>
            🤖
          </div>
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
              Executing AI Safety Pipeline...
            </div>
            <div className={styles.aiStageList}>
              {LOADING_STAGES.map((s, i) => (
                <div key={i} className={styles.aiStageItem}>
                  <span className={styles.aiStageDot} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : structured && !rawView ? (
        /* ========================================================================= */
        /* 3-CARD STRUCTURED LAYOUT                                                  */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {/* ======================================================================= */}
          {/* CARD 1: 📊 ANALYSIS SUMMARY CARD                                      */}
          {/* ======================================================================= */}
          <div
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-strong)',
              borderRadius: 16,
              padding: 18,
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: riskMeta.bg,
                    border: `1px solid ${riskMeta.color}44`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 22,
                  }}
                >
                  {riskMeta.icon}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Analysis Summary
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Battery Node: <strong>{result.battery_id || 'BAT001'}</strong> · Generated: {formatTime(result.generated_at)}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className="chip"
                style={{
                  background: riskMeta.bg,
                  color: riskMeta.color,
                  borderColor: `${riskMeta.color}66`,
                  fontWeight: 800,
                  fontSize: 12,
                  padding: '6px 14px',
                }}
              >
                {riskMeta.label}
              </span>
            </div>

            {/* Risk Score Progress Bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Deterministic Risk Score
                </span>
                <span style={{ color: riskMeta.color, fontWeight: 800, fontSize: 13 }}>
                  {Math.max(0, Math.min(100, Number(result.risk_score) || 0))}/100
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 100,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, Number(result.risk_score) || 0))}%`,
                    height: '100%',
                    background: riskMeta.color,
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>

            {/* Battery Health Summary Text */}
            {result.battery_health_summary && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(191, 90, 242, 0.08)',
                  border: '1px solid rgba(191, 90, 242, 0.25)',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  marginBottom: 14,
                }}
              >
                <strong style={{ color: '#BF5AF2', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>ℹ️</span> Diagnostic Appraisal:
                </strong>
                {result.battery_health_summary}
              </div>
            )}

            {/* Telemetry Metrics Snapshot Grid */}
            {snapshotData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 10 }}>
                {snapshotData.voltage != null && (
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Voltage</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#00E8A0' }}>{snapshotData.voltage.toFixed(2)} V</div>
                  </div>
                )}
                {snapshotData.current != null && (
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8' }}>{snapshotData.current.toFixed(2)} A</div>
                  </div>
                )}
                {snapshotData.temperature != null && (
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Temperature</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: snapshotData.temperature > 40 ? '#FF6B35' : '#00E8A0' }}>
                      {snapshotData.temperature.toFixed(1)} °C
                    </div>
                  </div>
                )}
                {snapshotData.soc != null && (
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SOC</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: snapshotData.soc < 20 ? '#FF2D55' : '#00E8A0' }}>
                      {Math.round(snapshotData.soc)}%
                    </div>
                  </div>
                )}
                {snapshotData.gas != null && (
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>MQ-2 Gas</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: snapshotData.gas > 300 ? '#FF2D55' : '#38BDF8' }}>
                      {Math.round(snapshotData.gas)} ppm
                    </div>
                  </div>
                )}
                {result.data_quality?.score != null && (
                  <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Data Quality</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#BF5AF2' }}>{result.data_quality.score}/100</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ======================================================================= */}
          {/* CARD 2: 🔍 DETAILED INSIGHTS CARD                                     */}
          {/* ======================================================================= */}
          <div
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-strong)',
              borderRadius: 16,
              padding: 18,
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📈</span>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Detailed Insights &amp; Recommendations
                </h4>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Condition-based observations, anomaly triage &amp; actionable advice
                </span>
              </div>
            </div>

            {/* Collapsible 1: Key Findings */}
            {Array.isArray(result.key_findings) && result.key_findings.length > 0 && (
              <div style={{ marginBottom: 12, borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <button
                  onClick={() => toggleSection('findings')}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(56, 189, 248, 0.08)',
                    border: 'none',
                    color: '#38BDF8',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>✅</span> Key Operational Findings ({result.key_findings.length})
                  </span>
                  <span>{openSections.findings ? '▲' : '▼'}</span>
                </button>

                {openSections.findings && (
                  <div style={{ padding: 14, background: 'var(--input-bg)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.key_findings.map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38BDF8', marginTop: 6, flexShrink: 0 }} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collapsible 2: Anomalies Detected */}
            {Array.isArray(result.anomalies) && (
              <div style={{ marginBottom: 12, borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <button
                  onClick={() => toggleSection('anomalies')}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: result.anomalies.length > 0 ? 'rgba(255, 107, 53, 0.1)' : 'rgba(0, 232, 160, 0.06)',
                    border: 'none',
                    color: result.anomalies.length > 0 ? '#FF6B35' : '#00E8A0',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>⚠️</span> Anomalies &amp; Hazard Flags ({result.anomalies.length})
                  </span>
                  <span>{openSections.anomalies ? '▲' : '▼'}</span>
                </button>

                {openSections.anomalies && (
                  <div style={{ padding: 14, background: 'var(--input-bg)' }}>
                    {result.anomalies.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: '#00E8A0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>✅</span> No anomalies or critical safety limit violations detected.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.anomalies.map((a, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: 'rgba(255,255,255,0.03)',
                              border: `1px solid ${SEVERITY_COLOR[(a.severity || 'info').toUpperCase()] || '#94A3B8'}44`,
                              display: 'flex',
                              gap: 10,
                              alignItems: 'flex-start',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 100,
                                border: `1px solid ${SEVERITY_COLOR[(a.severity || 'info').toUpperCase()] || '#94A3B8'}55`,
                                color: SEVERITY_COLOR[(a.severity || 'info').toUpperCase()] || '#94A3B8',
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              {(a.severity || 'info').toUpperCase()}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                                {a.parameter} {a.value != null && <span style={{ color: 'var(--text-muted)' }}>= {a.value}</span>}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>{a.explanation}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Collapsible 3: Actionable Recommendations */}
            {Array.isArray(result.recommendations) && (
              <div style={{ marginBottom: 12, borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <button
                  onClick={() => toggleSection('recommendations')}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0, 232, 160, 0.08)',
                    border: 'none',
                    color: '#00E8A0',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🛡️</span> Actionable Recommendations ({result.recommendations.length})
                  </span>
                  <span>{openSections.recommendations ? '▲' : '▼'}</span>
                </button>

                {openSections.recommendations && (
                  <div style={{ padding: 14, background: 'var(--input-bg)' }}>
                    {result.recommendations.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        All parameters within normal thresholds. Continue routine cycle maintenance.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.recommendations.map((rec, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 10,
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              gap: 10,
                              alignItems: 'flex-start',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '2px 8px',
                                borderRadius: 100,
                                background: rec.priority === 'high' ? 'rgba(255,45,85,0.15)' : rec.priority === 'medium' ? 'rgba(255,214,10,0.15)' : 'rgba(0,232,160,0.15)',
                                color: rec.priority === 'high' ? '#FF2D55' : rec.priority === 'medium' ? '#FFD60A' : '#00E8A0',
                                border: `1px solid ${rec.priority === 'high' ? '#FF2D5544' : rec.priority === 'medium' ? '#FFD60A44' : '#00E8A044'}`,
                                flexShrink: 0,
                                marginTop: 1,
                              }}
                            >
                              {rec.priority || 'low'}
                            </span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{rec.action}</div>
                              {rec.reason && (
                                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                                  <strong>Reason:</strong> {rec.reason}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ======================================================================= */}
          {/* CARD 3: 📈 MULTI-SENSOR FUSION & RISK FACTORS                          */}
          {/* ======================================================================= */}
          <div
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-strong)',
              borderRadius: 16,
              padding: 18,
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Multi-Sensor Fusion &amp; Degradation Outlook
                </h4>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Driver weighting, thermal stress factors, and non-fabricated RUL window
                </span>
              </div>
            </div>

            {/* Sensor Drivers Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Primary Driver */}
              {result.sensor_fusion_weights?.primary_driver && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Primary Risk Driver</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: '#FF6B35', textTransform: 'uppercase' }}>
                    {result.sensor_fusion_weights.primary_driver}
                  </span>
                </div>
              )}

              {/* Thermal Stress Meter */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🌡️</span> Thermal Stress Index (&lt;35°C Target)
                  </span>
                  <span style={{ color: (snapshotData?.temperature || 25) > 40 ? '#FF2D55' : '#00E8A0', fontWeight: 700 }}>
                    {snapshotData?.temperature != null ? `${snapshotData.temperature.toFixed(1)} °C` : '25.0 °C'}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(5, ((snapshotData?.temperature || 25) / 50.0) * 100))}%`,
                      height: '100%',
                      background: (snapshotData?.temperature || 25) > 40 ? '#FF2D55' : '#FFB800',
                      borderRadius: 100,
                    }}
                  />
                </div>
              </div>

              {/* Gas Sensor AQI */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💨</span> MQ-2 Gas Level (&lt;300 ppm Normal)
                  </span>
                  <span style={{ color: (snapshotData?.gas || 85) > 300 ? '#FF2D55' : '#38BDF8', fontWeight: 700 }}>
                    {snapshotData?.gas != null ? `${Math.round(snapshotData.gas)} ppm` : '85 ppm'}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(5, ((snapshotData?.gas || 85) / 500.0) * 100))}%`,
                      height: '100%',
                      background: (snapshotData?.gas || 85) > 300 ? '#FF2D55' : '#38BDF8',
                      borderRadius: 100,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Predictions & Degradation Forecast Info Box */}
            {result.predictions && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.06)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700, color: '#38BDF8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📅</span> Degradation Projection &amp; Confidence
                </div>
                {result.predictions.insufficient_data === true ? (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Sample window requires additional charge/discharge cycles to extrapolate concrete RUL curve without fabrication.
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Trend: <strong>{result.predictions.degradation_trend || 'Stable'}</strong> · Confidence:{' '}
                    <strong>{result.predictions.confidence || 'Nominal'}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (analysis || result) && rawView ? (
        <pre
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 14,
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            maxHeight: 380,
            overflowY: 'auto',
            marginTop: 14,
          }}
        >
          {copyText}
        </pre>
      ) : analysis ? (
        <div
          style={{
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-strong)',
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            marginTop: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{riskMeta.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Diagnostic Evaluation Complete</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verified against real-time sensor parameters</div>
              </div>
            </div>
            <span
              className="chip"
              style={{ background: riskMeta.bg, color: riskMeta.color, borderColor: `${riskMeta.color}44`, fontWeight: 800, fontSize: 11, padding: '4px 12px' }}
            >
              {riskMeta.label}
            </span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {analysis}
          </div>
        </div>
      ) : (
        <div className={styles.aiEmpty}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🤖</div>
          <span style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Ready to Run AI Safety Diagnostic
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto', display: 'block', lineHeight: 1.5 }}>
            Click &quot;Run AI Safety Diagnostic&quot; to execute deterministic threshold checks and query Gemini / OpenRouter for structured hazard appraisal, anomaly detection, and capacity predictions.
          </span>
          <button
            className={styles.primaryBtn}
            onClick={() => onAnalyze && onAnalyze({})}
            style={{ marginTop: 16 }}
          >
            <span>✨</span>
            <span>Start Analysis Now</span>
          </button>
        </div>
      )}
    </div>
  )
}

function formatTime(iso) {
  if (!iso) return 'Just now'
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  } catch (e) {
    return 'Just now'
  }
}