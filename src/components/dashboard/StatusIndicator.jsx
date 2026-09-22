'use client'

import React from 'react'
import { Bell, Volume2, VolumeX, Lightbulb, Radio } from 'lucide-react'
import styles from '../../styles/dashboard.module.css'

export default function StatusIndicator({ hardware = {}, safety = 'SAFE' }) {
  // Accepts both documented key styles (`led_green` vs `outputs.green`) so a
  // live telemetry `outputs` object and the command DB object both render.
  const {
    led_green,
    led_yellow,
    led_red,
    green,
    yellow,
    red,
    buzzer = false,
    auto_mode,
    auto,
  } = hardware
  const autoActive = auto_mode ?? auto ?? false
  const greenOn = led_green ?? green ?? false
  const yellowOn = led_yellow ?? yellow ?? false
  const redOn = led_red ?? red ?? false

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
            color: autoActive ? '#00E8A0' : '#FFB800',
            background: autoActive ? 'rgba(0,232,160,0.12)' : 'rgba(255,184,0,0.12)',
            padding: '2px 8px',
            borderRadius: 10,
          }}
        >
          {autoActive ? 'AUTO LOGIC' : 'MANUAL OVERRIDE'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {/* Green LED */}
        <div
          style={{
            background: greenOn ? 'rgba(0,232,160,0.12)' : 'rgba(255,255,255,0.03)',
            border: greenOn ? '1px solid rgba(0,232,160,0.4)' : '1px solid rgba(255,255,255,0.06)',
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
              background: greenOn ? '#00E8A0' : '#3A4455',
              boxShadow: greenOn ? '0 0 10px #00E8A0' : 'none',
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
            background: yellowOn ? 'rgba(255,184,0,0.12)' : 'rgba(255,255,255,0.03)',
            border: yellowOn ? '1px solid rgba(255,184,0,0.4)' : '1px solid rgba(255,255,255,0.06)',
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
              background: yellowOn ? '#FFB800' : '#3A4455',
              boxShadow: yellowOn ? '0 0 10px #FFB800' : 'none',
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
            background: redOn ? 'rgba(255,45,85,0.15)' : 'rgba(255,255,255,0.03)',
            border: redOn ? '1px solid rgba(255,45,85,0.5)' : '1px solid rgba(255,255,255,0.06)',
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
              background: redOn ? '#FF2D55' : '#3A4455',
              boxShadow: redOn ? '0 0 12px #FF2D55' : 'none',
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

