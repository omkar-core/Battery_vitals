'use client'

import React from 'react'
import { AlertTriangle, AlertCircle, Info, Check, Trash2, Clock } from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function AlertCard({ alert, onAcknowledge, onDismiss }) {
  const { id, time, severity = 'INFO', message = '', type = '', acknowledged = false } = alert

  const isCrit = severity === 'CRITICAL' || severity === 'EMERGENCY'
  const isWarn = severity === 'WARNING'
  const color = isCrit ? '#FF2D55' : isWarn ? '#FFB800' : '#38BDF8'
  const Icon = isCrit ? AlertTriangle : isWarn ? AlertCircle : Info

  return (
    <div
      style={{
        background: isCrit ? 'rgba(255,45,85,0.06)' : 'var(--bg-surface)',
        border: `1px solid ${isCrit ? 'rgba(255,45,85,0.3)' : 'var(--border-subtle)'}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 14,
        opacity: acknowledged ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
        <div style={{ background: `${color}18`, padding: 8, borderRadius: 10, marginTop: 2 }}>
          <Icon size={18} color={color} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: color,
                background: `${color}18`,
                padding: '2px 6px',
                borderRadius: 6,
                letterSpacing: 0.5,
              }}
            >
              {severity}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {time ? new Date(time).toLocaleTimeString() : 'Recent'}
            </span>
            {acknowledged && (
              <span style={{ fontSize: 10, color: '#00E8A0', fontWeight: 600 }}>✓ Acknowledged</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {message}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {!acknowledged && onAcknowledge && (
          <button
            onClick={() => onAcknowledge(id)}
            title="Acknowledge Alert"
            style={{
              background: 'rgba(0,232,160,0.12)',
              border: '1px solid rgba(0,232,160,0.3)',
              color: '#00E8A0',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Check size={13} /> Ack
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(id)}
            title="Dismiss Alert"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
              borderRadius: 8,
              padding: '6px 8px',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
