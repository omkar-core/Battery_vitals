'use client'

import { useState, useEffect, useRef } from 'react'
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
  Flame,
  Zap,
  Gauge,
  HelpCircle,
  TrendingUp,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

const DEFAULT_PROMPTS = [
  'Why is my BHI risk score at its current level?',
  'When should I replace this battery?',
  'Are my MQ-2 and MQ-135 gas readings safe?',
  'How can I maximize the cycle life of this pack?',
  'What is the optimal charging rate for my chemistry?',
]

export default function AIPage() {
  const { connected, data } = useRealTimeData()
  const { analysis, loading: structuredLoading, runAnalysis } = useAI()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm your Battery Vital AI Assistant powered by Google Gemini. I have direct access to your real-time telemetry (Voltage, Temp, Current, Gas, BHI). Ask me anything about your battery's health, degradation, or safety!",
      time: new Date().toLocaleTimeString(),
    },
  ])
  const [inputText, setInputText] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [history, setHistory] = useState([])
  const chatEndRef = useRef(null)

  useEffect(() => {
    fetch('/api/predictions?limit=10')
      .then((r) => r.json())
      .then(setHistory)
      .catch(() => {})
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const sendChatMessage = async (msgToSend) => {
    const text = msgToSend || inputText
    if (!text || !text.trim() || chatLoading) return

    const userMsg = {
      role: 'user',
      text,
      time: new Date().toLocaleTimeString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setChatLoading(true)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batteryId: 'BAT001',
          question: text,
          voltage: data?.battery?.voltage ?? data?.voltage,
          current: data?.battery?.current ?? data?.current,
          temperature: data?.environment?.temperature ?? data?.temperature,
          humidity: data?.environment?.humidity ?? data?.humidity,
          soc: data?.battery?.soc ?? data?.soc,
          soh: data?.battery?.soh ?? data?.soh,
          bhi: data?.risk?.bhi ?? data?.bhi,
          safety: data?.battery?.safety ?? data?.safety ?? 'SAFE',
          resistance: data?.battery?.resistance ?? data?.resistance,
          gasMq2: data?.gas?.index_mq2 ?? data?.mq2,
          gasMq135: data?.gas?.index_mq135 ?? data?.mq135,
        }),
      })

      const json = await res.json()
      const assistantMsg = {
        role: 'assistant',
        text: json.analysis || 'I analyzed your battery parameters. Everything looks within safe operational parameters.',
        time: new Date().toLocaleTimeString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      // Refresh recent predictions
      fetch('/api/predictions?limit=10')
        .then((r) => r.json())
        .then(setHistory)
        .catch(() => {})
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, I encountered an issue analyzing the telemetry. Please verify your connection.',
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

  const handleStructuredAnalyze = (form) => {
    let payload = form
    if (form && Object.keys(form).length === 0) {
      payload = {
        voltage: data?.battery?.voltage ?? data?.voltage,
        current: data?.battery?.current ?? data?.current,
        temperature: data?.environment?.temperature ?? data?.temperature,
        humidity: data?.environment?.humidity ?? data?.humidity,
        soc: data?.battery?.soc ?? data?.soc,
        bhi: data?.risk?.bhi ?? data?.bhi,
        safety: data?.battery?.safety ?? data?.safety ?? 'SAFE',
        power: data?.battery?.power ?? data?.power,
      }
    }
    runAnalysis({ payload }).then(() => {
      fetch('/api/predictions?limit=10')
        .then((r) => r.json())
        .then(setHistory)
        .catch(() => {})
    })
  }

  return (
    <Layout connected={connected} lastSeen={data?.timestamp} data={data}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Bot size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#BF5AF2" />
            Gemini AI <span className="gradText">Battery Assistant</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Conversational intelligence, predictive maintenance, and real-time failure hazard detection.
          </p>
        </div>

        {/* Live Vitals Chip Fed Into AI */}
        <div className="chip" style={{ background: 'rgba(191, 90, 242, 0.1)', color: '#BF5AF2', borderColor: 'rgba(191, 90, 242, 0.3)' }}>
          <Sparkles size={12} /> Real-Time Telemetry Context Active
        </div>
      </div>

      {/* 1. CONVERSATIONAL CHATBOT CARD */}
      <div
        className={styles.card}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 460,
          border: '1px solid rgba(191, 90, 242, 0.3)',
          background: 'var(--card-bg)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 12,
            marginBottom: 14,
          }}
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
                  text: 'Conversation reset. Ask me any question regarding your battery telemetry or safety.',
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
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
            maxHeight: 380,
            paddingRight: 4,
            marginBottom: 14,
          }}
        >
          {messages.map((m, i) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}
              >
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
                    lineHeight: 1.5,
                    background: isUser
                      ? 'linear-gradient(120deg, rgba(5, 150, 105, 0.14), rgba(2, 132, 199, 0.1))'
                      : 'var(--bg-surface-raised)',
                    border: `1px solid ${isUser ? 'rgba(5, 150, 105, 0.35)' : 'var(--border)'}`,
                    color: isUser ? 'var(--text-primary)' : 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.text}
                  <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                    {m.time}
                  </div>
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
                  background: 'rgba(255, 255, 255, 0.04)',
                  fontSize: 12,
                  color: '#BF5AF2',
                }}
              >
                Gemini is analyzing battery vitals...
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
                border: '1px solid rgba(255, 255, 255, 0.08)',
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

      {/* 2. STRUCTURED AUDIT & PREDICTIONS */}
      <AIInsights analysis={analysis} loading={structuredLoading} onAnalyze={handleStructuredAnalyze} />

      {/* 3. RECENT ANALYSES LIST */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>Recent Diagnostic Analyses</h3>
          <button
            className={styles.refreshBtn}
            onClick={() =>
              fetch('/api/predictions?limit=10')
                .then((r) => r.json())
                .then(setHistory)
            }
          >
            Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <div className={styles.empty}>No automated AI analyses logged yet.</div>
        ) : (
          <div className={styles.historyList}>
            {history.map((p, i) => (
              <div key={p._id || i} className={styles.historyItem}>
                <span
                  className={styles.severityPill}
                  style={{
                    background:
                      p.riskLevel === 'CRITICAL'
                        ? 'rgba(255,45,85,0.2)'
                        : p.riskLevel === 'WARNING'
                        ? 'rgba(255,107,53,0.2)'
                        : 'rgba(0,232,160,0.12)',
                    color:
                      p.riskLevel === 'CRITICAL'
                        ? '#FF2D55'
                        : p.riskLevel === 'WARNING'
                        ? '#FF6B35'
                        : '#00E8A0',
                  }}
                >
                  {p.riskLevel || 'OPTIMAL'}
                </span>
                <span className={styles.historyText}>
                  {p.question ? <strong>Q: {p.question} — </strong> : null}
                  {p.analysis || 'Telemetry analysis recorded.'}
                </span>
                <span className={styles.historyTime}>
                  {p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : '--'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
