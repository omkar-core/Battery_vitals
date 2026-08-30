'use client'

import { useState, useMemo } from 'react'
import {
  Bot,
  Loader,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Activity,
  Sparkles,
  Sliders,
  Info,
  FileText,
  Database,
  FastForward,
} from 'lucide-react'
import styles from './components.module.css'

const STATUS_META = {
  EMERGENCY: { label: 'EMERGENCY HAZARD', color: '#FF2D55', bg: 'rgba(255,45,85,0.16)', icon: ShieldAlert },
  CRITICAL: { label: 'CRITICAL HAZARD', color: '#FF2D55', bg: 'rgba(255,45,85,0.16)', icon: ShieldAlert },
  WARNING: { label: 'SAFETY WARNING', color: '#FF6B35', bg: 'rgba(255,107,53,0.16)', icon: AlertTriangle },
  CAUTION: { label: 'MODERATE CAUTION', color: '#FFD60A', bg: 'rgba(255,214,10,0.14)', icon: AlertTriangle },
  UNKNOWN: { label: 'DATA INSUFFICIENT', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: ShieldCheck },
  SAFE: { label: 'SYSTEM OPTIMAL', color: '#00E8A0', bg: 'rgba(0,232,160,0.14)', icon: ShieldCheck },
}

const SEVERITY_COLOR = {
  INFO: '#94A3B8',
  LOW: '#38BDF8',
  MEDIUM: '#FFD60A',
  HIGH: '#FF6B35',
  CRITICAL: '#FF2D55',
}

const PRIORITY_COLOR = {
  high: '#FF2D55',
  medium: '#FFD60A',
  low: '#00E8A0',
}

export default function AIInsights({ analysis, result, loading = false, onAnalyze }) {
  const [inputMode, setInputMode] = useState(false)
  const [form, setForm] = useState({})
  const [copied, setCopied] = useState(false)
  const [rawView, setRawView] = useState(false)

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

  const riskMeta = useMemo(() => {
    if (structured) {
      const key = (result.overall_status || 'UNKNOWN').toUpperCase()
      return STATUS_META[key] || STATUS_META.UNKNOWN
    }
    if (!analysis) return STATUS_META.SAFE
    const text = analysis.toLowerCase()
    if (text.includes('critical') || text.includes('emergency') || text.includes('runaway')) return STATUS_META.CRITICAL
    if (text.includes('warning') || text.includes('high risk') || text.includes('elevated')) return STATUS_META.WARNING
    if (text.includes('caution') || text.includes('moderate')) return STATUS_META.CAUTION
    if (text.includes('not reported') || text.includes('cannot')) return STATUS_META.UNKNOWN
    return STATUS_META.SAFE
  }, [result, analysis, structured])

  const RiskIcon = riskMeta.icon || ShieldCheck

  // Legacy markdown sections (kept for the dashboard's /api/analyze output).
  const parsedSections = useMemo(() => {
    if (!analysis || structured) return null
    const sections = []
    const lines = analysis.split('\n')
    let currentTitle = 'General Overview'
    let currentItems = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('###') || trimmed.startsWith('##') || /^[1-4]\.\s+\*\*/.test(trimmed) || /^\*\*[1-4]\.\s+/.test(trimmed)) {
        if (currentItems.length > 0) {
          sections.push({ title: currentTitle, content: currentItems })
          currentItems = []
        }
        currentTitle = trimmed.replace(/^#+\s*/, '').replace(/^[0-9]+\.\s*/, '').replace(/\*\*/g, '').replace(/:$/, '')
      } else {
        currentItems.push(trimmed)
      }
    }
    if (currentItems.length > 0) sections.push({ title: currentTitle, content: currentItems })
    return sections
  }, [analysis, structured])

  // Staged loading steps (display-only); they are real phases of the server pipeline.
  const LOADING_STAGES = [
    'Retrieving live ESP32 telemetry',
    'Validating sensor values & running deterministic safety checks',
    'Querying the Gemini intelligence engine',
    'Cross-checking risk score against safety thresholds',
  ]

  return (
    <div className={styles.aiCard}>
      {/* Top Header */}
      <div className={styles.aiHeader}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, rgba(191, 90, 242, 0.25), rgba(56, 189, 248, 0.25))',
            border: '1px solid rgba(191, 90, 242, 0.4)',
          }}
        >
          <Bot size={18} color="#BF5AF2" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 className={styles.panelTitle} style={{ margin: 0 }}>
            Battery Intelligence Center
          </h3>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Deterministic safety checks → real-time neural appraisal &amp; degradation projection
          </div>
        </div>

        {(analysis || result) && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleCopy}
              className={styles.secondaryBtn}
              style={{ padding: '5px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Copy analysis"
            >
              {copied ? <Check size={12} color="#00E8A0" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setRawView(!rawView)}
              className={styles.secondaryBtn}
              style={{ padding: '5px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Toggle raw view"
            >
              <FileText size={12} />
              <span>{rawView ? 'Card View' : 'Raw'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
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
              <Loader className={styles.spin} size={15} />
              <span>Running AI Safety Diagnostic...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
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
          <Sliders size={13} />
          <span>{inputMode ? 'Hide Custom Inputs' : 'Custom Telemetry Input'}</span>
        </button>
      </div>

      {inputMode && (
        <div className={styles.aiForm}>
          <div className={styles.aiFormLabel}>Simulate Custom Sensor Parameters</div>
          <div className={styles.aiGrid}>
            {fields.map((f) => (
              <label key={f} className={styles.aiField}>
                <span className={styles.aiLabel}>{f}</span>
                <input
                  className={styles.aiInput}
                  value={form[f] ?? ''}
                  placeholder="--"
                  onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <button className={styles.primaryBtn} style={{ marginTop: 12 }} onClick={submit}>
            Evaluate Simulated Parameters
          </button>
        </div>
      )}

      {/* Loading: honest staged phases of the server pipeline */}
      {loading ? (
        <div className={styles.aiLoading}>
          <div className={styles.aiBrainPulseWrap}>
            <Bot size={40} color="#BF5AF2" className={styles.aiBrainPulseIcon} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              AI Analyst is running the intelligence pipeline...
            </div>
            <div className={styles.aiStageList}>
              {LOADING_STAGES.map((s, i) => (
                <div key={i} className={styles.aiStageItem}>
                  <span className={styles.aiStageDot} />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : structured && !rawView ? (
        <StructuredResult result={result} riskMeta={riskMeta} />
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
          }}
        >
          {copyText}
        </pre>
      ) : analysis ? (
        <div className={styles.aiResultContainer}>
          <div className={styles.aiResultHero}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <RiskIcon size={20} color={riskMeta.color} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Diagnostic Evaluation Complete</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Verified against real-time ESP32 sensor values</div>
              </div>
            </div>
            <span
              className="chip"
              style={{ background: riskMeta.bg, color: riskMeta.color, borderColor: `${riskMeta.color}44`, fontWeight: 800, fontSize: 11, padding: '4px 12px' }}
            >
              {riskMeta.label}
            </span>
          </div>
          {parsedSections && parsedSections.length > 0 ? (
            parsedSections.map((sec, idx) => {
              const titleLower = sec.title.toLowerCase()
              const isRisk = titleLower.includes('risk') || titleLower.includes('issue') || titleLower.includes('warning')
              const isRecommend = titleLower.includes('recommend') || titleLower.includes('action') || titleLower.includes('usage')
              const isLife = titleLower.includes('lifespan') || titleLower.includes('life') || titleLower.includes('prediction')
              const Icon = isRisk ? AlertTriangle : isRecommend ? CheckCircle2 : isLife ? Calendar : Activity
              const iconColor = isRisk ? '#FF6B35' : isRecommend ? '#00E8A0' : isLife ? '#38BDF8' : '#BF5AF2'
              return (
                <div key={idx} className={styles.aiSection}>
                  <div className={styles.aiSectionTitle}>
                    <Icon size={14} color={iconColor} />
                    <span style={{ color: iconColor }}>{sec.title}</span>
                  </div>
                  <div className={styles.aiSectionBody}>
                    {sec.content.map((p, pIdx) => {
                      const isBullet = p.startsWith('-') || p.startsWith('*')
                      const cleanP = p.replace(/^[-*]\s*/, '').replace(/\*\*/g, '')
                      if (isRecommend && isBullet) {
                        return (
                          <div key={pIdx} className={styles.aiRecommendItem}>
                            <CheckCircle2 size={13} color="#00E8A0" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span>{cleanP}</span>
                          </div>
                        )
                      }
                      if (isRisk && (p.toLowerCase().includes('runaway') || p.toLowerCase().includes('overheat'))) {
                        return (
                          <div key={pIdx} className={styles.aiWarningCallout}>
                            <AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {cleanP}
                          </div>
                        )
                      }
                      return (
                        <div key={pIdx} style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          {p.replace(/\*\*/g, '')}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          ) : (
            <div className={styles.aiSectionText}>{analysis}</div>
          )}
        </div>
      ) : (
        <div className={styles.aiEmpty}>
          <span style={{ display: 'block', marginBottom: 8 }}>
            Click <strong>&quot;Run AI Safety Diagnostic&quot;</strong> to evaluate current real-time
            telemetry from the ESP32.
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            The pipeline: validate sensors → deterministic safety engine → Gemini interpretation → verified structured report.
            No values are ever fabricated; missing fields are reported as &quot;not reported&quot;.
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Structured result renderer (verified JSON from the intelligence engine)
// ---------------------------------------------------------------------------

function StructuredResult({ result, riskMeta }) {
  const RiskIcon = riskMeta.icon
  const riskPct = Math.max(0, Math.min(100, Number(result.risk_score) || 0))
  const anomalies = Array.isArray(result.anomalies) ? result.anomalies : []
  const recs = Array.isArray(result.recommendations) ? result.recommendations : []
  const findings = Array.isArray(result.key_findings) ? result.key_findings : []
  const dq = result.data_quality || {}
  const dqIssues = Array.isArray(dq.issues) ? dq.issues : []
  const pred = result.predictions || {}

  return (
    <div className={styles.aiResultContainer}>
      {/* Status hero + risk meter */}
      <div className={styles.aiResultHero}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <RiskIcon size={20} color={riskMeta.color} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Diagnostic Evaluation Complete</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              Status: {result.overall_status} · Confidence: {result.confidence} · Generated {formatTime(result.generated_at)}
            </div>
          </div>
        </div>
        <span
          className="chip"
          style={{ background: riskMeta.bg, color: riskMeta.color, borderColor: `${riskMeta.color}44`, fontWeight: 800, fontSize: 11, padding: '4px 12px' }}
        >
          {riskMeta.label}
        </span>
      </div>

      {/* Risk score meter */}
      <div className={styles.aiRiskRow}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>DETERMINISTIC RISK SCORE</span>
            <span style={{ color: riskMeta.color, fontWeight: 800 }}>{riskPct}/100</span>
          </div>
          <div className={styles.aiRiskTrack}>
            <div
              className={styles.aiRiskFill}
              style={{
                width: `${riskPct}%`,
                background: riskMeta.color,
                boxShadow: `0 0 12px ${riskMeta.color}66`,
              }}
            />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Database size={12} /> {result.data_quality?.score != null ? `Data quality ${result.data_quality.score}/100` : 'Data quality n/a'}
          </span>
        </div>
      </div>

      {/* Summary */}
      {result.battery_health_summary ? (
        <div className={styles.aiSection}>
          <div className={styles.aiSectionTitle}>
            <Info size={14} color="#BF5AF2" />
            <span style={{ color: '#BF5AF2' }}>Battery Health Summary</span>
          </div>
          <div className={styles.aiSectionText}>{result.battery_health_summary}</div>
        </div>
      ) : null}

      {/* Key findings */}
      {findings.length > 0 ? (
        <div className={styles.aiSection}>
          <div className={styles.aiSectionTitle}>
            <Activity size={14} color="#38BDF8" />
            <span style={{ color: '#38BDF8' }}>Key Findings</span>
          </div>
          <div className={styles.aiSectionBody}>
            {findings.map((f, i) => (
              <div key={i} className={styles.aiBulletRow}>
                <span className={styles.aiBulletDot} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Anomalies */}
      {anomalies.length > 0 ? (
        <div className={styles.aiSection}>
          <div className={styles.aiSectionTitle}>
            <AlertTriangle size={14} color="#FF6B35" />
            <span style={{ color: '#FF6B35' }}>Anomalies Detected</span>
          </div>
          <div className={styles.aiSectionBody}>
            {anomalies.map((a, i) => (
              <div key={i} className={styles.aiAnomalyItem}>
                <span className={styles.aiAnomalyBadge} style={{ color: SEVERITY_COLOR[(a.severity || 'info').toUpperCase()] || '#94A3B8', borderColor: (SEVERITY_COLOR[(a.severity || 'info').toUpperCase()] || '#94A3B8') + '55' }}>
                  {(a.severity || 'info').toUpperCase()}
                </span>
                <span style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{a.parameter}</strong>
                  {a.value != null ? <span style={{ color: 'var(--text-muted)' }}> = {a.value}</span> : null}
                  <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 11.5, marginTop: 2 }}>{a.explanation}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Recommendations */}
      {recs.length > 0 ? (
        <div className={styles.aiSection}>
          <div className={styles.aiSectionTitle}>
            <CheckCircle2 size={14} color="#00E8A0" />
            <span style={{ color: '#00E8A0' }}>Recommendations</span>
          </div>
          <div className={styles.aiSectionBody}>
            {recs.map((r, i) => (
              <div key={i} className={styles.aiRecommendItem}>
                <span className={styles.aiPriorityPill} style={{ color: PRIORITY_COLOR[r.priority] || '#00E8A0', borderColor: (PRIORITY_COLOR[r.priority] || '#00E8A0') + '55' }}>
                  {r.priority.toUpperCase()}
                </span>
                <span>
                  {r.action}
                  {r.reason ? <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>Why: {r.reason}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Predictions */}
      {pred ? (
        <div className={styles.aiSection}>
          <div className={styles.aiSectionTitle}>
            <Calendar size={14} color="#38BDF8" />
            <span style={{ color: '#38BDF8' }}>Predictions</span>
          </div>
          <div className={styles.aiSectionBody}>
            <div className={styles.aiPredictionRow}>
              {pred.insufficient_data === true ? (
                <span className={styles.aiInsufficientData}>
                  Insufficient data to project a failure date or RUL.
                </span>
              ) : (
                <>
                  <span><strong style={{ color: 'var(--text-primary)' }}>Trend:</strong> <span style={{ color: 'var(--text-secondary)' }}>{pred.degradation_trend || 'n/a'}</span></span>
                  {pred.estimated_risk ? <span><strong style={{ color: 'var(--text-primary)' }}>Risk:</strong> <span style={{ color: 'var(--text-secondary)' }}>{pred.estimated_risk}</span></span> : null}
                </>
              )}
              <span style={{ color: 'var(--text-muted)' }}>
                Confidence: <strong style={{ color: 'var(--text-secondary)' }}>{pred.confidence || 'insufficient data'}</strong>
                {pred.period ? ` · Evidence: ${pred.period}` : ''}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Safety notes + data quality */}
      {result.safety_notes ? (
        <div className={styles.aiSection}>
          <div className={styles.aiSectionTitle}>
            <ShieldCheck size={14} color="#00E8A0" />
            <span style={{ color: '#00E8A0' }}>Safety Notes</span>
          </div>
          <div className={styles.aiSectionText}>{result.safety_notes}</div>
        </div>
      ) : null}

      {dqIssues.length > 0 ? (
        <div className={styles.aiSection}>
          <div className={styles.aiSectionTitle}>
            <FastForward size={14} color="#FFD60A" />
            <span style={{ color: '#FFD60A' }}>Data Quality Warnings</span>
          </div>
          <div className={styles.aiSectionBody}>
            {dqIssues.map((issue, i) => (
              <div key={i} className={styles.aiBulletRow}>
                <span className={styles.aiBulletDot} />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function formatTime(iso) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleTimeString()
  } catch (e) {
    return '--'
  }
}