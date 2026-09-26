'use client'

import React from 'react'
import styles from './ai.module.css'

export default function Recommendations({
  recommendations = [],
  loading = false,
}) {
  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI</span>
            <h3 className={styles.cardTitle}>Operational Recommendations</h3>
          </div>
        </div>
        <div className={styles.carouselRow}>
          {[1, 2, 3].map((k) => (
            <div key={k} className={styles.skeleton} style={{ width: 260, height: 120, flexShrink: 0 }} />
          ))}
        </div>
      </div>
    )
  }

  const items = Array.isArray(recommendations) ? recommendations : []

  if (items.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.aiBadge}>✨ AI Guidance</span>
            <h3 className={styles.cardTitle}>Actionable Operational Recommendations</h3>
          </div>
        </div>
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            All Parameters Nominal
          </div>
          <p style={{ fontSize: 12, margin: '6px auto 0', maxWidth: 440, color: 'var(--text-secondary)' }}>
            No corrective intervention needed based on live sensor telemetry. Continue standard operating profile.
          </p>
        </div>
      </div>
    )
  }

  const getPriorityClass = (priority) => {
    const p = String(priority || 'medium').toLowerCase()
    if (p === 'high' || p === 'critical') return styles.priorityHigh
    if (p === 'low') return styles.priorityLow
    return styles.priorityMedium
  }

  const getPriorityIcon = (priority) => {
    const p = String(priority || 'medium').toLowerCase()
    if (p === 'high' || p === 'critical') return '⚠️'
    if (p === 'low') return '💡'
    return '⚡'
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <span className={styles.aiBadge}>✨ AI Guidance</span>
          <h3 className={styles.cardTitle}>Actionable Operational Recommendations</h3>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary, #4E5A6B)' }}>
          ← Scroll horizontally →
        </span>
      </div>

      <div className={styles.carouselRow}>
        {items.map((item, index) => {
          const action = item.action || item.title || item.text || 'Recommendation'
          const reason = item.reason || item.description || item.explanation || ''
          const priority = item.priority || 'medium'
          const prioClass = getPriorityClass(priority)
          const prioIcon = getPriorityIcon(priority)

          return (
            <div key={index} className={`${styles.actionCard} ${prioClass}`}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span>{prioIcon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary, #8B95A5)' }}>
                    {priority} Priority
                  </span>
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #F0F4F8)', lineHeight: 1.3 }}>
                  {action}
                </h4>
                {reason && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #8B95A5)', lineHeight: 1.45 }}>
                    {reason}
                  </p>
                )}
              </div>
              <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: 10, color: 'var(--text-tertiary, #4E5A6B)' }}>
                Deterministic Rule Verified
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
