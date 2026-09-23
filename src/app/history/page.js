'use client'

import React, { useState, useEffect } from 'react'
import Header from '../../components/Header'

export default function BatteryTimelinePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [explanation, setExplanation] = useState(null)
  const [explaining, setExplaining] = useState(false)

  useEffect(() => {
    async function loadTimeline() {
      setLoading(true)
      try {
        const res = await fetch('/api/ai/timeline?batteryId=BAT001')
        const data = await res.json()
        if (data.events) setEvents(data.events)
      } catch (err) {
        console.warn('Failed to load battery timeline:', err)
      } finally {
        setLoading(false)
      }
    }
    loadTimeline()
  }, [])

  const handleExplainEvent = async (evt) => {
    setSelectedEvent(evt)
    setExplaining(true)
    setExplanation(null)
    try {
      const res = await fetch('/api/ai/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batteryId: 'BAT001', eventId: evt.id }),
      })
      const data = await res.json()
      if (data.aiExplanation) setExplanation(data.aiExplanation)
    } catch (err) {
      setExplanation('Failed to generate AI explanation: ' + err.message)
    } finally {
      setExplaining(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc' }}>
      <Header />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📜</span> Personal Battery Lifecycle Timeline
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Chronological event stream from commissioning, charge cycles, thermal events &amp; protection trips.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#38BDF8' }}>Loading timeline...</div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #1e293b' }}>
            {events.map((evt, idx) => (
              <div
                key={evt.id || idx}
                style={{
                  position: 'relative',
                  marginBottom: '24px',
                  backgroundColor: '#121824',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                {/* Bullet node on vertical timeline line */}
                <div style={{
                  position: 'absolute',
                  left: '-32px',
                  top: '18px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: evt.severity === 'CRITICAL' ? '#FF2D55' : evt.severity === 'WARNING' ? '#FFB800' : '#00E8A0',
                  border: '3px solid #090d16',
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{evt.icon || '📌'}</span>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>{evt.title}</h3>
                  </div>

                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {new Date(evt.timestamp).toLocaleString()}
                  </span>
                </div>

                <p style={{ margin: '8px 0 12px 0', fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5' }}>
                  {evt.description}
                </p>

                <button
                  onClick={() => handleExplainEvent(evt)}
                  style={{
                    backgroundColor: 'rgba(56,189,248,0.15)',
                    color: '#38BDF8',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  AI Explain Event 🧠
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* AI Explanation Modal */}
      {selectedEvent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>AI Event Analysis</h3>
              <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize: '14px', fontWeight: 600, color: '#38BDF8', marginBottom: '8px' }}>
              {selectedEvent.title}
            </div>

            {explaining ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#38BDF8' }}>Analyzing event context...</div>
            ) : (
              <div style={{ backgroundColor: '#1e293b', padding: '14px', borderRadius: '8px', fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
                {explanation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
