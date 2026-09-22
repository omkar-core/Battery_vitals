'use client'

import React, { useState, useRef, useEffect } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { authHeaders } from '../../lib/clientToken'
import styles from './ai.module.css'

const QUICK_CHIPS = [
  'Battery health status?',
  'Any thermal risks today?',
  'Voltage stability trend?',
  'How to maximize cycle life?',
]

export default function ChatWidget({ defaultBatteryId = 'BAT001' }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your Battery Vital AI assistant. Ask me anything about your pack vitals, thermal safety, or operating trends.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (open) scrollToBottom()
  }, [messages, open])

  const handleSend = async (textToSend) => {
    const text = textToSend || input
    if (!text.trim() || loading) return

    const userMsg = { role: 'user', content: text.trim() }
    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          batteryId: defaultBatteryId,
          question: text.trim(),
        }),
      })

      const data = await res.json()
      if (res.ok && data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            sparkline: data.sparkline || null,
            model: data.model || null,
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.error || 'Failed to retrieve response from Battery Vital AI.',
          },
        ])
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Network connection issue. Please check your connectivity.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.chatFloat}>
      {/* Floating Toggle Button */}
      {!open && (
        <button
          className={styles.chatToggleBtn}
          onClick={() => setOpen(true)}
          title="Ask Battery Vital AI"
          aria-label="Open AI Assistant"
        >
          💬
        </button>
      )}

      {/* Floating Chat Drawer Window */}
      {open && (
        <div className={styles.chatWindow}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              background: '#141B28',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🤖</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F0F4F8)' }}>
                  Battery Vital AI
                </div>
                <div style={{ fontSize: 10, color: 'var(--accent-primary, #00E8A0)' }}>
                  ● Pack {defaultBatteryId} Active
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #8B95A5)',
                fontSize: 18,
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages Container */}
          <div className={styles.chatMessages}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant}
              >
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{m.content}</div>

                {/* Inline mini sparkline inside chat bubble */}
                {m.sparkline && m.sparkline.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '6px 8px',
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: 6,
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary, #4E5A6B)' }}>Trend:</span>
                    <div style={{ width: 120, height: 28 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={m.sparkline}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke="#00E8A0"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className={styles.chatBubbleAssistant} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✨ Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick-Reply Chips */}
          <div className={styles.quickReplies}>
            {QUICK_CHIPS.map((chip, idx) => (
              <button key={idx} className={styles.chip} onClick={() => handleSend(chip)}>
                {chip}
              </button>
            ))}
          </div>

          {/* Input Row */}
          <form
            className={styles.chatInputRow}
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about vitals or health..."
              disabled={loading}
            />
            <button className={styles.chatSendBtn} type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
