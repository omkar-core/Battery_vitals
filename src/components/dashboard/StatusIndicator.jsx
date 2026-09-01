'use client'

import React from 'react'
import { Bell, Volume2, VolumeX, Lightbulb, Radio } from 'lucide-react'
import styles from '../../styles/dashboard.module.css'

export default function StatusIndicator({ hardware = {}, safety = 'SAFE' }) {
  const {
    led_green = true,
    led_yellow = false,
    led_red = false,
    buzzer = false,
    auto_mode = true,
  } = hardware

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio size={18} color="#00E8A0" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Hardware Actuator States (ESP32)
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: auto_mode ? '#00E8A0' : '#FFB800',
            background: auto_mode ? 'rgba(0,232,160,0.12)' : 'rgba(255,184,0,0.12)',
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {auto_mode ? 'AUTO LOGIC' : 'MANUAL OVERRIDE'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {/* Green LED */}
        <div
          style={{
            background: led_green ? 'rgba(0,232,160,0.12)' : 'rgba(255,255,255,0.03)',
            border: led_green ? '1px solid rgba(0,232,160,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: led_green ? '#00E8A0' : '#3A4455',
              boxShadow: led_green ? '0 0 10px #00E8A0' : 'none',
            }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Green LED</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>GPIO14 (Normal)</div>
          </div>
        </div>

        {/* Yellow LED */}
        <div
          style={{
            background: led_yellow ? 'rgba(255,184,0,0.12)' : 'rgba(255,255,255,0.03)',
            border: led_yellow ? '1px solid rgba(255,184,0,0.4)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: led_yellow ? '#FFB800' : '#3A4455',
              boxShadow: led_yellow ? '0 0 10px #FFB800' : 'none',
            }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Yellow LED</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>GPIO26 (Warning)</div>
          </div>
        </div>

        {/* Red LED */}
        <div
          style={{
            background: led_red ? 'rgba(255,45,85,0.15)' : 'rgba(255,255,255,0.03)',
            border: led_red ? '1px solid rgba(255,45,85,0.5)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: led_red ? '#FF2D55' : '#3A4455',
              boxShadow: led_red ? '0 0 12px #FF2D55' : 'none',
            }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Red LED</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>GPIO27 (Critical)</div>
          </div>
        </div>

        {/* Buzzer */}
        <div
          style={{
            background: buzzer ? 'rgba(255,45,85,0.15)' : 'rgba(255,255,255,0.03)',
            border: buzzer ? '1px solid rgba(255,45,85,0.5)' : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {buzzer ? <Volume2 size={16} color="#FF2D55" /> : <VolumeX size={16} color="#3A4455" />}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Buzzer Alarm</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>GPIO25 ({buzzer ? 'ACTIVE' : 'MUTED'})</div>
          </div>
        </div>
      </div>
    </div>
  )
}
