'use client'

import React from 'react'
import { ShieldCheck, Zap, Thermometer, Wind, AlertCircle, ArrowRight } from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function Recommendations({ recommendations = [], urgentActions = [] }) {
  const defaultRecs = [
    'Maintain ambient ventilation when pack temperature exceeds 35°C to avoid thermal acceleration.',
    'Keep charge termination voltage capped at 14.2V for optimal cycle longevity.',
    'Inspect MQ-2 sensor periodically to calibrate baseline clean air reference in storage bay.',
  ]

  const items = recommendations.length > 0 ? recommendations : defaultRecs

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} color="#00E8A0" />
          <h3 className={styles.cardTitle}>AI Actionable Safety Recommendations</h3>
        </div>
        <span style={{ fontSize: 11, color: '#00E8A0', fontWeight: 600 }}>Gemini Advisor</span>
      </div>

      {urgentActions && urgentActions.length > 0 && (
        <div
          style={{
            background: 'rgba(255,45,85,0.12)',
            border: '1px solid rgba(255,45,85,0.4)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#FF2D55', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} /> Urgent Safety Interventions
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-primary)' }}>
            {urgentActions.map((action, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((rec, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ background: 'rgba(0,232,160,0.12)', padding: 6, borderRadius: 6, marginTop: 2 }}>
              <ArrowRight size={14} color="#00E8A0" />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
              {rec}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
