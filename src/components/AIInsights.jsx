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
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react'
import styles from './components.module.css'

export default function AIInsights({ analysis, loading = false, onAnalyze }) {
  const [inputMode, setInputMode] = useState(false)
  const [form, setForm] = useState({})
  const [copied, setCopied] = useState(false)
  const [rawView, setRawView] = useState(false)

  const fields = [
    'voltage',
    'current',
    'temperature',
    'humidity',
    'soc',
    'bhi',
    'safety',
    'resistance',
    'power',
  ]

  const submit = () => {
    if (onAnalyze) onAnalyze(form)
  }

  const handleCopy = () => {
    if (!analysis) return
    navigator.clipboard.writeText(analysis)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Parse structured sections from AI markdown/text
  const parsedSections = useMemo(() => {
    if (!analysis) return null

    const sections = []
    const lines = analysis.split('\n')
    let currentTitle = 'General Overview'
    let currentItems = []

    for (let line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Match headers like ### 1. Current Battery Health Assessment or 1. Assessment
      if (
        trimmed.startsWith('###') ||
        trimmed.startsWith('##') ||
        /^[1-4]\.\s+\*\*/.test(trimmed) ||
        /^\*\*[1-4]\.\s+/.test(trimmed)
      ) {
        if (currentItems.length > 0) {
          sections.push({ title: currentTitle, content: currentItems })
          currentItems = []
        }
        currentTitle = trimmed
          .replace(/^#+\s*/, '')
          .replace(/^[0-9]+\.\s*/, '')
          .replace(/\*\*/g, '')
          .replace(/:$/, '')
      } else {
        currentItems.push(trimmed)
      }
    }

    if (currentItems.length > 0) {
      sections.push({ title: currentTitle, content: currentItems })
    }

    return sections
  }, [analysis])

  // Derive risk badge from analysis text
  const riskMeta = useMemo(() => {
    if (!analysis) return { label: 'OPTIMAL', color: '#00E8A0', bg: 'rgba(0, 232, 160, 0.12)' }
    const text = analysis.toLowerCase()
    if (text.includes('critical') || text.includes('emergency') || text.includes('runaway')) {
      return { label: 'CRITICAL HAZARD', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.16)', icon: ShieldAlert }
    }
    if (text.includes('warning') || text.includes('high risk') || text.includes('elevated')) {
      return { label: 'SAFETY WARNING', color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.16)', icon: AlertTriangle }
    }
    if (text.includes('caution') || text.includes('moderate')) {
      return { label: 'MODERATE CAUTION', color: '#FFD60A', bg: 'rgba(255, 214, 10, 0.14)', icon: AlertTriangle }
    }
    return { label: 'SYSTEM OPTIMAL', color: '#00E8A0', bg: 'rgba(0, 232, 160, 0.14)', icon: ShieldCheck }
  }, [analysis])

  const RiskIcon = riskMeta.icon || ShieldCheck

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
            Gemini AI Battery Health Diagnostic
          </h3>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Real-time neural safety appraisal &amp; degradation projection
          </div>
        </div>

        {analysis && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleCopy}
              className={styles.secondaryBtn}
              style={{ padding: '5px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Copy analysis text"
            >
              {copied ? <Check size={12} color="#00E8A0" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={() => setRawView(!rawView)}
              className={styles.secondaryBtn}
              style={{ padding: '5px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              title="Toggle raw text view"
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
              <span>Analyzing ESP32 Vitals...</span>
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

      {/* Custom Input Drawer */}
      {inputMode && (
        <div className={styles.aiForm}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Simulate Custom Sensor Parameters
          </div>
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

      {/* Loading State with Animated Stepper */}
      {loading ? (
        <div className={styles.aiLoading}>
          <div className={styles.aiBrainPulseWrap}>
            <Bot size={40} color="#BF5AF2" className={styles.aiBrainPulseIcon} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              AI Analyst is analyzing your battery data...
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Auditing cell voltages, current direction, gas sensor readings &amp; thermal runaway bounds
            </div>
            <div style={{ fontSize: 11, color: '#BF5AF2', fontWeight: 600, marginTop: 8 }}>
              Estimated time: This usually takes 5-10 seconds
            </div>
          </div>
        </div>
      ) : analysis ? (
        rawView ? (
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
            {analysis}
          </pre>
        ) : (
          /* Rich Structured Presentation */
          <div className={styles.aiResultContainer}>
            {/* Top Status Banner */}
            <div className={styles.aiResultHero}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RiskIcon size={20} color={riskMeta.color} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                    Diagnostic Evaluation Complete
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Verified against real-time ESP32 sensor values
                  </div>
                </div>
              </div>

              <span
                className="chip"
                style={{
                  background: riskMeta.bg,
                  color: riskMeta.color,
                  borderColor: `${riskMeta.color}44`,
                  fontWeight: 800,
                  fontSize: 11,
                  padding: '4px 12px',
                }}
              >
                {riskMeta.label}
              </span>
            </div>

            {/* Individual Structured Sections */}
            {parsedSections && parsedSections.length > 0 ? (
              parsedSections.map((sec, idx) => {
                const titleLower = sec.title.toLowerCase()
                const isRisk =
                  titleLower.includes('risk') ||
                  titleLower.includes('issue') ||
                  titleLower.includes('warning')
                const isRecommend =
                  titleLower.includes('recommend') ||
                  titleLower.includes('action') ||
                  titleLower.includes('usage')
                const isLife =
                  titleLower.includes('lifespan') ||
                  titleLower.includes('life') ||
                  titleLower.includes('prediction')

                const Icon = isRisk
                  ? AlertTriangle
                  : isRecommend
                  ? CheckCircle2
                  : isLife
                  ? Calendar
                  : Activity
                const iconColor = isRisk
                  ? '#FF6B35'
                  : isRecommend
                  ? '#00E8A0'
                  : isLife
                  ? '#38BDF8'
                  : '#BF5AF2'

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
                          <div
                            key={pIdx}
                            style={{
                              fontSize: 12.5,
                              lineHeight: 1.6,
                              color: 'var(--text-secondary)',
                              marginBottom: 4,
                            }}
                          >
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
        )
      ) : (
        <div className={styles.aiEmpty}>
          Click <strong>&quot;Run AI Safety Diagnostic&quot;</strong> to evaluate current real-time
          telemetry from the ESP32 against chemical limits, thermal runaway hazards, and cycle
          endurance models.
        </div>
      )}
    </div>
  )
}
