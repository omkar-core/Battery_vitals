'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Layout from '../../components/Layout'
import AIInsights from '../../components/AIInsights'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { useAI } from '../../hooks/useAI'
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  User,
  ShieldCheck,
  TrendingUp,
  Lightbulb,
  Database,
  Cpu,
  Trash2,
  Eye,
  EyeOff,
  GitCompare,
  Clock,
  Layers,
  HardDrive,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

const DEFAULT_PROMPTS = [
  'Why is my BHI risk score at its current level?',
  'When should I replace this battery?',
  'Are my MQ-2 and MQ-135 gas readings safe?',
  'How can I maximize the cycle life of this pack?',
]

const TABS = [
  { id: 'smart', label: 'Smart Analysis', icon: Bot },
  { id: 'predictions', label: 'Predictions', icon: TrendingUp },
  { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
  { id: 'training', label: 'Training Data', icon: Database },
]

const CHAT_STAGES = ['Retrieving live telemetry', 'Validating sensor data', 'Querying Gemini']
const PRIORITY_COLOR = { high: '#FF2D55', medium: '#FFD60A', low: '#00E8A0' }
const STATUS_COLOR = { EMERGENCY: '#FF2D55', CRITICAL: '#FF2D55', WARNING: '#FF6B35', CAUTION: '#FFD60A', UNKNOWN: '#94A3B8', SAFE: '#00E8A0' }

export default function AIPage() {
  return (
    <Suspense fallback={<Layout><div style={{ padding: 40, textAlign: 'center' }}>Loading AI Insights...</div></Layout>}>
      <AIInner />
    </Suspense>
  )
}

function AIInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const urlTab = searchParams?.get('tab')

  const { connected, data } = useRealTimeData()
  const { diagnostic, diagnosticLoading, diagnosticError, runDiagnostic, fetchDiagnostics, deleteDiagnostic } = useAI()

  const [tab, setTab] = useState('smart')
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatStage, setChatStage] = useState(0)
  const [analyses, setAnalyses] = useState([])
  const [analysesLoading, setAnalysesLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareSel, setCompareSel] = useState([])
  const [trainingMeta, setTrainingMeta] = useState(null)
  const chatEndRef = useRef(null)
  const [customResult, setCustomResult] = useState(null)
  const [customLoading, setCustomLoading] = useState(false)

  // Read tab reactively from ?tab= (header dropdown deep links)
  useEffect(() => {
    if (!urlTab) {
      setTab('smart')
      return
    }
    const match = TABS.find((x) => x.id === urlTab.toLowerCase())
    if (match) setTab(match.id)
  }, [urlTab])

  const refreshAnalyses = useCallback(async () => {
    setAnalysesLoading(true)
    const list = await fetchDiagnostics({ limit: 30 })
    setAnalyses(list)
    setAnalysesLoading(false)
  }, [fetchDiagnostics])

  useEffect(() => {
    refreshAnalyses()
  }, [refreshAnalyses])

  // Persisted chat history (per battery)
  useEffect(() => {
    fetch('/api/ai/chat?batteryId=BAT001&limit=50')
      .then((r) => r.json())
      .then((d) => {
        if (d.messages && d.messages.length) {
          setMessages(
            d.messages.map((m) => ({ role: m.role, text: m.content, time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : '' }))
          )
        } else {
          setMessages([
            {
              role: 'assistant',
              text: "Hello! I'm your Battery Vital AI Assistant. I have direct access to your validated, real-time telemetry (Voltage, Temp, Current, Gas, BHI) and past diagnostics. Ask me anything about your battery's health, degradation, or safety!",
              time: '',
            },
          ])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, chatLoading])

  // Load training metadata when that tab opens
  useEffect(() => {
    if (tab === 'training' && !trainingMeta) {
      fetch('/api/ai/training')
        .then((r) => r.json())
        .then(setTrainingMeta)
        .catch(() => {})
    }
  }, [tab, trainingMeta])

  // Staged chat loading indicator (display-only; reflects real pipeline phases)
  useEffect(() => {
    if (!chatLoading) return undefined
    setChatStage(0)
    const id = setInterval(() => {
      setChatStage((s) => Math.min(s + 1, CHAT_STAGES.length - 1))
    }, 2500)
    return () => clearInterval(id)
  }, [chatLoading])

  const parseStream = async (res) => {
    if (!res.body) return null
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''
    let error = null
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop()
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue
        let payload
        try {
          payload = JSON.parse(part.slice(6))
        } catch (e) {
          continue
        }
        if (payload.error) error = payload.error
        if (payload.text) full += payload.text
      }
    }
    if (error) throw new Error(error)
    return full
  }

  const sendChatMessage = async (msgToSend) => {
    const text = msgToSend || inputText
    if (!text || !text.trim() || chatLoading) return

    const userMsg = { role: 'user', text, time: new Date().toLocaleTimeString() }
    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setChatLoading(true)

    try {
      let reply = null
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batteryId: 'BAT001', question: text, stream: true }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        reply = await parseStream(res)
      } catch (e) {
        console.warn('Chat stream failed, falling back to non-streaming:', e.message)
      }

      if (!reply) {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batteryId: 'BAT001', question: text, stream: false }),
        })
        const err = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(err.error || 'Chat request failed')
        reply = err.reply
      }

      if (!reply) throw new Error('Empty reply')
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, time: new Date().toLocaleTimeString() }])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, the assistant could not be reached right now. Please verify your connection and try again.',
          time: new Date().toLocaleTimeString(),
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendChatMessage()
    }
  }

  const handleAnalyze = async (form) => {
    if (!form || Object.keys(form).length === 0) {
      setCustomResult(null)
      const res = await runDiagnostic({ batteryId: 'BAT001' })
      if (res && res.error) {
        setCustomResult({ error: res.error })
      }
      refreshAnalyses()
      return
    }
    // Custom simulated parameters use the legacy single-reading analyzer
    setCustomLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batteryId: 'BAT001',
          voltage: form.voltage,
          current: form.current,
          temperature: form.temperature,
          humidity: form.humidity,
          soc: form.soc,
          bhi: form.bhi,
          safety: form.safety || 'SAFE',
          resistance: form.resistance,
          power: form.power,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Analysis failed')
      setCustomResult({ analysis: json.analysis })
    } catch (e) {
      setCustomResult({ error: e.message })
    } finally {
      setCustomLoading(false)
    }
  }

  const toggleCompare = (id) => {
    setCompareSel((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return prev
      return [...prev, id]
    })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this diagnostic analysis from the history?')) return
    const ok = await deleteDiagnostic(id)
    if (ok) refreshAnalyses()
  }

  const timeLabel = (ts) => {
    if (!ts) return '--'
    const d = new Date(ts)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
  }

  const latestAnomaly = (a) => a && Array.isArray(a.anomalies) ? a.anomalies.length : 0

  return (
    <Layout connected={connected} lastSeen={data?.timestamp} data={data}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Bot size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#BF5AF2" />
            <span className="gradText">Premium Battery Intelligence Center</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Validate → deterministic safety engine → Gemini interpretation → verified structured intelligence. No values ever fabricated.
          </p>
        </div>
        <div className="chip" style={{ background: 'rgba(191, 90, 242, 0.1)', color: '#BF5AF2', borderColor: 'rgba(191, 90, 242, 0.3)' }}>
          <Sparkles size={12} /> Real-Time Telemetry Context {data ? 'Active' : 'Pending'}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id)
                router.replace(t.id === 'smart' ? '/ai' : `/ai?tab=${t.id}`, { scroll: false })
              }}
              className={styles.filterBtn}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: tab === t.id ? 'linear-gradient(120deg, rgba(191,90,242,0.18), rgba(56,189,248,0.12))' : undefined,
                color: tab === t.id ? '#BF5AF2' : undefined,
                borderColor: tab === t.id ? 'rgba(191,90,242,0.4)' : undefined,
              }}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ============ SMART ANALYSIS ============ */}
      {tab === 'smart' && (
        <>
          <AIInsights result={customResult && customResult.error ? null : diagnostic} analysis={customResult && customResult.analysis ? customResult.analysis : null} loading={diagnosticLoading || customLoading} onAnalyze={handleAnalyze} />

          {diagnosticError && (
            <div className={styles.card} style={{ borderColor: 'rgba(255,45,85,0.4)', marginTop: 12 }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0 }}>
                <strong style={{ color: '#FF2D55' }}>Diagnostic could not be completed:</strong> {diagnosticError}
              </p>
            </div>
          )}

          {/* 1. CONVERSATIONAL CHATBOT CARD */}
          <div
            className={styles.card}
            style={{ display: 'flex', flexDirection: 'column', minHeight: 480, border: '1px solid rgba(191, 90, 242, 0.3)', background: 'var(--card-bg)', marginTop: 16 }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'linear-gradient(135deg, #BF5AF2, #38BDF8)',
                  }}
                >
                  <Bot size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Battery Vital AI Companion</div>
                  <div style={{ fontSize: 10, color: 'var(--state-safe)' }}>Live Context: {data ? 'Synced' : 'Default Profile'}</div>
                </div>
              </div>
              <button
                onClick={() =>
                  setMessages([
                    {
                      role: 'assistant',
                      text: 'Conversation reset (this device only). Ask me any question regarding your battery telemetry or safety.',
                      time: new Date().toLocaleTimeString(),
                    },
                  ])
                }
                className={styles.filterBtn}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                Reset Chat
              </button>
            </div>

            {/* Message Log */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: 380, paddingRight: 4, marginBottom: 14 }}>
              {messages.map((m, i) => {
                const isUser = m.role === 'user'
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    {!isUser && (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'rgba(191, 90, 242, 0.2)',
                          border: '1px solid rgba(191, 90, 242, 0.4)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Bot size={14} color="#BF5AF2" />
                      </div>
                    )}
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        fontSize: 12.5,
                        lineHeight: 1.55,
                        background: isUser ? 'linear-gradient(120deg, rgba(5, 150, 105, 0.14), rgba(2, 132, 199, 0.1))' : 'var(--bg-surface-raised)',
                        border: `1px solid ${isUser ? 'rgba(5, 150, 105, 0.35)' : 'var(--border)'}`,
                        color: isUser ? 'var(--text-primary)' : 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap',
                        maxWidth: '100%',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                      <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>{m.time}</div>
                    </div>
                    {isUser && (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'rgba(0, 232, 160, 0.2)',
                          border: '1px solid rgba(0, 232, 160, 0.4)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <User size={14} color="#00E8A0" />
                      </div>
                    )}
                  </div>
                )
              })}

              {chatLoading && (
                <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-start' }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'rgba(191, 90, 242, 0.2)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Bot size={14} color="#BF5AF2" />
                  </div>
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-surface-raised)',
                      border: '1px solid var(--border)',
                      fontSize: 12,
                      color: '#BF5AF2',
                    }}
                  >
                    {CHAT_STAGES[chatStage]}...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggested Prompt Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {DEFAULT_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  disabled={chatLoading}
                  onClick={() => sendChatMessage(prompt)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 100,
                    padding: '4px 10px',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Ask a question about your battery..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatLoading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => sendChatMessage()}
                disabled={chatLoading || !inputText.trim()}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(90deg, #BF5AF2, #38BDF8)',
                  color: '#06080F',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Send size={14} />
                <span>Send</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ============ PREDICTIONS ============ */}
      {tab === 'predictions' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <TrendingUp size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} color="#38BDF8" />
              Predictions &amp; Degradation Projection
            </h3>
            <button className={styles.refreshBtn} onClick={refreshAnalyses} disabled={analysesLoading}>
              <RefreshCw size={12} className={analysesLoading ? styles.spinAnimation : ''} /> Refresh
            </button>
          </div>

          {analyses.length === 0 ? (
            <div className={styles.empty}>
              No diagnostics logged yet. <strong>Run AI Safety Diagnostic</strong> at least once to generate prediction context.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {analyses.map((a) => {
                const p = (a.result && a.result.predictions) || {}
                return (
                  <div key={a.id} style={{ padding: 14, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className="chip" style={{ color: STATUS_COLOR[a.result.overall_status] || '#94A3B8', borderColor: `${STATUS_COLOR[a.result.overall_status] || '#94A3B8'}44` }}>
                        {a.result.overall_status}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeLabel(a.createdAt)}</span>
                    </div>

                    {p.insufficient_data === true ? (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        <strong style={{ color: '#FFD60A' }}>Insufficient data</strong> — a meaningful degradation trend cannot be honestly projected from the available sample window.
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>{p.degradation_trend}</div>
                        {p.estimated_risk ? (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Estimated risk:</strong> {p.estimated_risk}
                          </div>
                        ) : null}
                      </>
                    )}
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      Confidence: <strong>{p.confidence || 'insufficient data'}</strong>
                      {p.period ? ` · ${p.period}` : ''}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      RUL: no concrete failure date is asserted unless a real model is available.
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ RECOMMENDATIONS ============ */}
      {tab === 'recommendations' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <Lightbulb size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} color="#FFB800" />
              Condition-Driven Recommendations
            </h3>
            <button className={styles.refreshBtn} onClick={refreshAnalyses} disabled={analysesLoading}>
              <RefreshCw size={12} className={analysesLoading ? styles.spinAnimation : ''} /> Refresh
            </button>
          </div>

          {analyses.length === 0 ? (
            <div className={styles.empty}>No recommendations yet — run an AI Safety Diagnostic first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {analyses.flatMap((a) =>
                (a.result && Array.isArray(a.result.recommendations) ? a.result.recommendations : []).map((r, i) => (
                  <div
                    key={`${a.id}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '12px 14px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${PRIORITY_COLOR[r.priority] || '#00E8A0'}`,
                      borderRadius: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 100,
                        border: `1px solid ${PRIORITY_COLOR[r.priority] || '#00E8A0'}55`,
                        color: PRIORITY_COLOR[r.priority] || '#00E8A0',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {r.priority.toUpperCase()}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{r.action}</div>
                      {r.reason ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Why: {r.reason}</div> : null}
                    </div>
                    <span style={{ fontSize: 9.5, color: 'var(--text-muted)', flexShrink: 0 }}>{timeLabel(a.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ TRAINING DATA ============ */}
      {tab === 'training' && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <HardDrive size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} color="#B98CFF" />
              Training Data &amp; Model Provenance
            </h3>
            <button className={styles.refreshBtn} onClick={() => setTrainingMeta(null)}>
              <RefreshCw size={12} /> Reload
            </button>
          </div>

          {!trainingMeta ? (
            <div className={styles.empty}>Loading system metadata...</div>
          ) : trainingMeta.error ? (
            <div className={styles.empty}>{trainingMeta.error}</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                <span className="chip">
                  <Database size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  MongoDB: {trainingMeta.database}
                </span>
                {Object.entries(trainingMeta.collections || {}).map(([name, meta]) => (
                  <span key={name} className="chip" style={{ color: 'var(--text-secondary)' }}>
                    {name}: <strong>{meta.documents != null ? meta.documents.toLocaleString() : 'n/a'}</strong> docs
                  </span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                <div style={{ padding: 14, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#B98CFF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={13} /> Model
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>
                      Provider: <strong style={{ color: 'var(--text-primary)' }}>{trainingMeta.model.provider}</strong>
                    </span>
                    <span>
                      Remote model: <strong style={{ color: 'var(--text-primary)' }}>{trainingMeta.model.name || 'not configured'}</strong>
                      {trainingMeta.model.hosted ? ' · active' : ' · deterministic fallback only'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{trainingMeta.model.note}</span>
                  </div>
                </div>

                <div style={{ padding: 14, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={13} /> Data Sources
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {(trainingMeta.sources || []).map((s, i) => (
                      <span key={i}>— {s}</span>
                    ))}
                  </div>
                </div>

                <div style={{ padding: 14, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#00E8A0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={13} /> Telemetry Schema
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(trainingMeta.telemetrySchema || []).map((s) => (
                      <span key={s} style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--text-secondary)', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 100, padding: '2px 8px' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Collection detail table */}
              <div style={{ marginTop: 14, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Collection</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Documents</th>
                      <th style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>Last Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(trainingMeta.collections || {}).map(([name, meta]) => (
                      <tr key={name} style={{ color: 'var(--text-secondary)' }}>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                          <code style={{ fontFamily: 'var(--mono)' }}>{name}</code>
                        </td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>{meta.documents != null ? meta.documents.toLocaleString() : 'n/a'}</td>
                        <td style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>{meta.lastRecorded ? timeLabel(meta.lastRecorded) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.empty} style={{ marginTop: 12 }}>
                This page shows only real, queryable system metadata. No model-card metrics or accuracy figures are fabricated; corpus counts reflect the live database.
              </div>
            </>
          )}
        </div>
      )}

      {/* ============ RECENT DIAGNOSTIC ANALYSES (shared) ============ */}
      <div className={styles.card} style={{ marginTop: 16 }}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>
            <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} color="#00E8A0" />
            Recent Diagnostic Analyses
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {analyses.length > 1 && (
              <button
                className={styles.filterBtn}
                onClick={() => {
                  setCompareMode(!compareMode)
                  setCompareSel([])
                  setExpandedId(null)
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}
              >
                <GitCompare size={12} /> {compareMode ? 'Exit Compare' : 'Compare'}
              </button>
            )}
            <button className={styles.refreshBtn} onClick={refreshAnalyses} disabled={analysesLoading}>
              <RefreshCw size={12} className={analysesLoading ? styles.spinAnimation : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Compare panel */}
        {compareMode && compareSel.length === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 14 }}>
            {analyses.filter((a) => compareSel.includes(a.id)).map((a) => (
              <div key={a.id} style={{ padding: 12, background: 'var(--input-bg)', border: `1px solid ${STATUS_COLOR[a.result.overall_status] || 'var(--border)'}55`, borderRadius: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
                  <span className="chip" style={{ color: STATUS_COLOR[a.result.overall_status] || '#94A3B8', borderColor: `${STATUS_COLOR[a.result.overall_status] || '#94A3B8'}44` }}>
                    {a.result.overall_status}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{timeLabel(a.createdAt)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Risk: <strong style={{ color: 'var(--text-primary)' }}>{a.result.risk_score}/100</strong> · Confidence: {a.result.confidence}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  Source: {a.source} · {latestAnomaly(a.result)} anomalies · {a.result.recommendations ? a.result.recommendations.length : 0} recommendations
                </div>
              </div>
            ))}
          </div>
        )}

        {analyses.length === 0 ? (
          <div className={styles.empty}>
            No AI analyses logged yet — run an <strong>AI Safety Diagnostic</strong> above to generate the first structured report.
          </div>
        ) : (
          <div className={styles.historyList}>
            {analyses.map((a) => (
              <div key={a.id}>
                <div className={styles.historyItem}>
                  <span
                    className={styles.severityPill}
                    style={{ background: `${STATUS_COLOR[a.result.overall_status] || '#94A3B8'}22`, color: STATUS_COLOR[a.result.overall_status] || '#94A3B8' }}
                  >
                    {a.result.overall_status}
                  </span>
                  {compareMode && (
                    <input
                      type="checkbox"
                      checked={compareSel.includes(a.id)}
                      onChange={() => toggleCompare(a.id)}
                      style={{ accentColor: '#BF5AF2' }}
                    />
                  )}
                  <span className={styles.historyText}>
                    <strong>Risk {a.result.risk_score}/100</strong> · {a.result.battery_health_summary ? a.result.battery_health_summary.slice(0, 110) : ''}
                    {a.result.battery_health_summary && a.result.battery_health_summary.length > 110 ? '…' : ''} · <em style={{ color: 'var(--text-muted)' }}>source: {a.source}</em>
                  </span>
                  <span className={styles.historyTime}>{timeLabel(a.createdAt)}</span>
                  <button
                    onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    className={styles.filterBtn}
                    style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {expandedId === a.id ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{expandedId === a.id ? 'Collapse' : 'View'}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className={styles.filterBtn}
                    style={{ padding: '4px 8px', fontSize: 11, color: '#FF2D55', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>

                {expandedId === a.id && (
                  <div style={{ padding: '12px 14px', margin: '8px 0 12px 0', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{JSON.stringify(a.result, null, 2)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}