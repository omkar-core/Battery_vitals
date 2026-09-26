'use client'

import React, { useState } from 'react'

export default function WhyExplainerModal({ metricName = 'State of Health (SOH)', batteryId = 'BAT001', onClose }) {
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [error, setError] = useState(null)

  const fetchExplanation = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/ask-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batteryId,
          question: `Why is my battery ${metricName} at its current value? Explain the underlying telemetry indicators and historical trends.`,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setExplanation(data.answer)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [metricName, batteryId])

  React.useEffect(() => {
    fetchExplanation()
  }, [fetchExplanation])

  return (
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
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        maxWidth: '520px',
        width: '100%',
        padding: '24px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧠</span> Why metric changed: {metricName}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#38BDF8' }}>
            <span>⚡</span> Analyzing battery history with Gemini AI...
          </div>
        ) : error ? (
          <div style={{ padding: '16px', backgroundColor: 'rgba(255,45,85,0.1)', color: '#FF2D55', borderRadius: '8px' }}>
            Failed to load AI explanation: {error}
          </div>
        ) : (
          <div>
            <div style={{
              backgroundColor: 'var(--bg-surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '14px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-line',
            }}>
              {explanation}
            </div>

            <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔒</span> Derived strictly from verified hardware sensor logs &amp; deterministic safety engine.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
