'use client'

import React, { useState, useRef, useEffect } from 'react'
import { authHeaders } from '../../lib/clientToken'

const QUICK_CHIPS = [
  'Why is my battery health decreasing?',
  'Any thermal risks today?',
  'Voltage stability trend?',
  'How to maximize cycle life?',
]

export default function ChatWidget({ initialBatteryId = 'BAT001', embedded = false }) {
  const [open, setOpen] = useState(embedded)
  const [batteryId, setBatteryId] = useState(initialBatteryId)
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your Battery Vital AI assistant. Ask me anything about your pack vitals, thermal safety, or operating trends.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (open) scrollToBottom()
  }, [messages, open])

  // Load conversations list for current battery
  const loadConversations = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/conversations?batteryId=${batteryId}`)
      const data = await res.json()
      if (data.conversations) {
        setConversations(data.conversations)
      }
    } catch (e) {
      console.warn('Failed to load conversations:', e)
    }
  }, [batteryId])

  useEffect(() => {
    if (open) loadConversations()
  }, [open, loadConversations])

  // Start new conversation
  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batteryId, title: 'New Discussion' }),
      })
      const data = await res.json()
      if (data.conversation) {
        setActiveConversationId(data.conversation.conversationId)
        setMessages([
          {
            role: 'assistant',
            content: `New discussion started for Battery ${batteryId}. How can I assist you?`,
          },
        ])
        setConversations([data.conversation, ...conversations])
      }
    } catch (e) {
      console.error('Failed to create new conversation:', e)
    }
  }

  // Switch to selected conversation
  const handleSelectConversation = async (convId) => {
    setActiveConversationId(convId)
    try {
      const res = await fetch(`/api/ai/conversations/${convId}`)
      const data = await res.json()
      if (data.conversation && data.conversation.messages) {
        setMessages(
          data.conversation.messages.length > 0
            ? data.conversation.messages
            : [
                {
                  role: 'assistant',
                  content: 'Loaded conversation session.',
                },
              ]
        )
      }
    } catch (e) {
      console.error('Failed to load conversation messages:', e)
    }
  }

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
          batteryId,
          question: text.trim(),
          conversationId: activeConversationId,
        }),
      })

      const data = await res.json()
      if (res.ok && (data.answer || data.response)) {
        const replyText = data.answer || data.response
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: replyText,
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
      loadConversations()
    }
  }

  if (!open && !embedded) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#00E8A0',
          color: '#090d16',
          border: 'none',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 10px 25px rgba(0,232,160,0.4)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Ask Battery Vital AI"
      >
        💬
      </button>
    )
  }

  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      height: embedded ? '600px' : '520px',
      width: embedded ? '100%' : '380px',
      position: embedded ? 'relative' : 'fixed',
      bottom: embedded ? '0' : '24px',
      right: embedded ? '0' : '24px',
      boxShadow: embedded ? 'none' : '0 20px 25px -5px rgba(0,0,0,0.5)',
      zIndex: 999,
      overflow: 'hidden',
    }}>
      {/* Top Header */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: '#38BDF8', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
            title="Toggle previous conversations"
          >
            📋 Sessions ({conversations.length})
          </button>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc' }}>
            Battery Vital AI ({batteryId})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleNewConversation}
            style={{
              backgroundColor: '#00E8A0',
              color: '#090d16',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + New
          </button>
          {!embedded && (
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Body with Conversations Sidebar Drawer */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Conversations History Sidebar */}
        {sidebarOpen && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '220px',
            backgroundColor: '#090d16',
            borderRight: '1px solid #1e293b',
            padding: '12px',
            zIndex: 10,
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
              PREVIOUS CONVERSATIONS
            </div>
            {conversations.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b' }}>No saved sessions yet</div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.conversationId}
                  onClick={() => {
                    handleSelectConversation(c.conversationId)
                    setSidebarOpen(false)
                  }}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: activeConversationId === c.conversationId ? '#00E8A0' : '#cbd5e1',
                    backgroundColor: activeConversationId === c.conversationId ? '#1e293b' : 'transparent',
                    cursor: 'pointer',
                    marginBottom: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  • {c.title}
                </div>
              ))
            )}
          </div>
        )}

        {/* Chat Messages */}
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: m.role === 'user' ? '#00E8A0' : '#1e293b',
                color: m.role === 'user' ? '#090d16' : '#f8fafc',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                maxWidth: '85%',
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', backgroundColor: '#1e293b', color: '#38BDF8', padding: '8px 12px', borderRadius: '12px', fontSize: '13px' }}>
              ⚡ Battery Vital AI is generating context-aware diagnosis...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Chips */}
      <div style={{ padding: '6px 12px', display: 'flex', gap: '6px', overflowX: 'auto', borderTop: '1px solid #1e293b' }}>
        {QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            style={{
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '4px 8px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        style={{ padding: '12px', backgroundColor: '#1e293b', display: 'flex', gap: '8px' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about battery ${batteryId}...`}
          style={{
            flex: 1,
            backgroundColor: '#090d16',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#f8fafc',
            fontSize: '13px',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            backgroundColor: '#00E8A0',
            color: '#090d16',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
