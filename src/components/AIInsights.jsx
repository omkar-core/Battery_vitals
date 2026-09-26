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

const PRIORITY_STYLE = {
  high: { bg: 'rgba(255,45,85,0.15)', color: '#FF2D55', border: 'rgba(255,45,85,0.3)' },
  medium: { bg: 'rgba(255,214,10,0.15)', color: '#FFD60A', border: 'rgba(255,214,10,0.3)' },
  low: { bg: 'rgba(0,232,160,0.15)', color: '#00E8A0', border: 'rgba(0,232,160,0.3)' },
}

export default function AIInsights({ analysis, result, loading = false, onAnalyze }) {
  const [copied, setCopied] = useState(false)
  const [rawView, setRawView] = useState(false)

  const [openSections, setOpenSections] = useState({
    summary: true,
    drivers: true,
    recommendations: true,
    probabilities: true,
    safety: true,
  })

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const structured = result && typeof result === 'object' && result.overall_status
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

  const LOADING_STAGES = [
    'Retrieving live ESP32 telemetry & I2C sensor bus',
    'Validating sensor ranges & deterministic threshold bounds',
    'Querying AI Safety Intelligence Engine (Gemini &rarr; OpenRouter &rarr; Deterministic)',
    'Synthesizing risk appraisal & condition recommendations',
  ]

  return (
    <div className={styles.aiCard}>
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
            AI Safety & Degradation Intelligence
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

      <div className={styles.aiActions}>
        <button
          className={styles.primaryBtn}
          disabled={loading}
          onClick={() => {
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
      </div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          {/* CARD 1: ANALYSIS SUMMARY */}
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
                    Battery Node: <strong>{result.battery_id || 'BAT001'}</strong> · Generated:{' '}
                    {formatTime(result.generated_at)}
                  </div>
                </div>
              </div>

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

            {/* Confidence indicator */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  AI Confidence
                </span>
                <span style={{ color: '#BF5AF2', fontWeight: 800, fontSize: 13 }}>
                  {Math.round((Number(result.confidence) || 0) * 100)}%
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 100,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.round((Number(result.confidence) || 0) * 100)))}%`,
                    height: '100%',
                    background: '#BF5AF2',
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>

            {/* Provider badge */}
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Provider:
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 100,
                  background: result.provider_used?.includes('gemini') ? 'rgba(2,132,199,0.15)' : result.provider_used?.includes('openrouter') ? 'rgba(191,90,242,0.15)' : 'rgba(0,232,160,0.15)',
                  color: result.provider_used?.includes('gemini') ? '#38BDF8' : result.provider_used?.includes('openrouter') ? '#BF5AF2' : '#00E8A0',
                  border: `1px solid ${result.provider_used?.includes('gemini') ? 'rgba(56,189,248,0.3)' : result.provider_used?.includes('openrouter') ? 'rgba(191,90,242,0.3)' : 'rgba(0,232,160,0.3)'}`,
                }}
              >
                {formatProvider(result.provider_used)}
              </span>
            </div>

            {/* Battery Health Summary Text */}
            {result.summary && (
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
                {result.summary}
              </div>
            )}

            {/* Key Drivers as Chips */}
            {Array.isArray(result.key_drivers) && result.key_drivers.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Key Risk Drivers
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {result.key_drivers.map((d, i) => {
                    const contrib = d.contribution || 'medium'
                    const contribColor = contrib === 'high' ? '#FF2D55' : contrib === 'medium' ? '#FFD60A' : '#00E8A0'
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${contribColor}44`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          minWidth: 120,
                        }}
                      >
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {d.metric}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: contribColor }}>
                          {Number(d.value).toFixed(d.metric.includes('temp') ? 1 : 1)}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>
                          Threshold: {Number(d.threshold).toFixed(1)} · {contrib}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* CARD 2: RECOMMENDATIONS & FINDINGS */}
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
              <span style={{ fontSize: 18 }}>📋</span>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Actionable Recommendations
                </h4>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Condition-based observations & numbered checklist tied to measured values
                </span>
              </div>
            </div>

            {/* Recommendations as Numbered Checklist */}
            {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.recommendations.map((rec, i) => {
                  const pr = rec.priority || 'low'
                  const style = PRIORITY_STYLE[pr] || PRIORITY_STYLE.low
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${style.border}`,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: style.color,
                          background: style.bg,
                          border: `1px solid ${style.border}`,
                          borderRadius: 100,
                          width: 28,
                          height: 28,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rec.action}
                        </div>
                        {rec.reason && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Reason:</strong> {rec.reason}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* CARD 3: FAILURE PROBABILITY & DEGRADATION OUTLOOK */}
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
              <span style={{ fontSize: 18 }}>📊</span>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Failure Probability & Degradation Outlook
                </h4>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Non-fabricated projections based on observed degradation trends
                </span>
              </div>
            </div>

            {/* Three stat blocks for failure probability */}
            {result.failure_probability && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: '30 Days', key: '30_days', color: '#00E8A0' },
                  { label: '90 Days', key: '90_days', color: '#FFB800' },
                  { label: '1 Year', key: '1_year', color: '#FF6B35' },
                ].map(({ label, key, color }) => (
                  <div
                    key={key}
                    style={{
                      padding: '14px 12px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${color}44`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color,
                        fontFamily: 'var(--font-display)',
                        lineHeight: 1,
                        marginTop: 4,
                      }}
                    >
                      {Math.round(Number(result.failure_probability[key]) || 0)}%
                    </div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Failure Probability
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Mini bar chart for degradation trend */}
            {result.predictions && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.06)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700, color: '#38BDF8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📈</span> Degradation Projection
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Trend: <strong>{result.predictions.degradation_trend || 'Stable'}</strong> ·
                  Confidence: <strong>{result.predictions.confidence || 'Nominal'}</strong>
                  {result.predictions.period && <span> · Window: {result.predictions.period}</span>}
                </div>
                {result.predictions.insufficient_data && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                    ⚠️ Insufficient historical data for concrete projection. Accumulate more charge/discharge cycles.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CARD 4: SENSOR FUSION WEIGHTS (if available) */}
          {result.sensor_fusion_weights && (
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
                    Multi-Sensor Fusion Weights
                  </h4>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Physical input weighting behind the risk assessment
                  </span>
                </div>
              </div>

              {result.sensor_fusion_weights.primary_driver && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Primary Risk Driver</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#FF6B35', textTransform: 'uppercase' }}>
                    {result.sensor_fusion_weights.primary_driver}
                  </div>
                </div>
              )}

              {Array.isArray(result.sensor_fusion_weights.drivers) && result.sensor_fusion_weights.drivers.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.sensor_fusion_weights.drivers.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>
                          {d.input === 'temperature' ? '🌡️' : d.input === 'voltage' ? '⚡' : d.input === 'gas' ? '💨' : '🔌'}
                        </span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                            {d.input}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{d.reason}</div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: 100,
                          background:
                            d.influence === 'HIGH' ? 'rgba(255,45,85,0.15)' :
                            d.influence === 'MEDIUM' ? 'rgba(255,214,10,0.15)' : 'rgba(0,232,160,0.15)',
                          color:
                            d.influence === 'HIGH' ? '#FF2D55' :
                            d.influence === 'MEDIUM' ? '#FFD60A' : '#00E8A0',
                          border: `1px solid ${
                            d.influence === 'HIGH' ? '#FF2D5544' :
                            d.influence === 'MEDIUM' ? '#FFD60A44' : '#00E8A044'
                          }`,
                        }}
                      >
                        {d.influence}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Safety Notes */}
          {result.safety_notes && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(255,45,85,0.08)',
                border: '1px solid rgba(255,45,85,0.2)',
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
              }}
            >
              <strong style={{ color: '#FF2D55', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span>🛡️</span> Safety Notes:
              </strong>
              {result.safety_notes}
            </div>
          )}
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

function formatProvider(provider) {
  if (!provider) return 'Unknown'
  if (provider.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro'
  if (provider.includes('gemini')) return 'Gemini 1.5 Flash'
  if (provider.includes('openrouter') || provider.includes('liquid')) return 'OpenRouter (LFM-40B)'
  if (provider === 'deterministic') return 'Deterministic Engine'
  return provider
}


