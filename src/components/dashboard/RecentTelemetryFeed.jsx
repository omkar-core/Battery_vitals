'use client'

import React, { useState, useMemo } from 'react'
import {
  formatNumber,
  safetyColor,
  safetyLabel,
  bhiStatus,
  exportToCSV,
  exportToJSON,
  normalizeTelemetry,
} from '../../lib/utils'
import styles from '../../styles/dashboard.module.css'

export default function RecentTelemetryFeed({ history = [], connected = false, lastSeen = null }) {
  const [limit, setLimit] = useState(10) // 10, 20, or 50
  const [copiedId, setCopiedId] = useState(null)

  // Normalize history rows and sort newest first
  const normalizedRows = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return []
    const flat = normalizeTelemetry(history)
    // Return newest first (reverse of chronological array)
    return [...flat].reverse()
  }, [history])

  const displayedRows = useMemo(() => {
    return normalizedRows.slice(0, limit)
  }, [normalizedRows, limit])

  const handleExportCSV = () => {
    if (displayedRows.length === 0) return
    exportToCSV(displayedRows, `telemetry_history_last_${displayedRows.length}_${Date.now()}.csv`)
  }

  const handleExportJSON = () => {
    if (displayedRows.length === 0) return
    exportToJSON(displayedRows, `telemetry_history_last_${displayedRows.length}_${Date.now()}.json`)
  }

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '--'
    const ms = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
    if (isNaN(ms)) return '--'
    const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
    if (diffSec < 5) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    return `${Math.floor(diffSec / 3600)}h ago`
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--:--'
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return '--:--:--'
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }

  return (
    <div
      style={{
        background: 'var(--card-bg, #0e1726)',
        border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
        borderRadius: 16,
        padding: '20px 22px',
        marginBottom: 20,
        boxShadow: 'var(--shadow-card, 0 4px 20px rgba(0, 0, 0, 0.25))',
      }}
    >
      {/* Header Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
          paddingBottom: 14,
          borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Telemetry Stream &amp; Data Log
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 20,
                background: connected ? 'rgba(0, 232, 160, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                color: connected ? '#00E8A0' : '#94A3B8',
                border: `1px solid ${connected ? 'rgba(0, 232, 160, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
              }}
            >
              {connected ? '● Live Syncing' : '○ Stored DB Log'}
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Showing the last <strong>{displayedRows.length}</strong> recorded telemetry packets ({normalizedRows.length} buffered in memory &amp; MongoDB).
          </p>
        </div>

        {/* Right Controls: Row Limit Toggle & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Row limit tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-canvas, #090d16)',
              padding: 3,
              borderRadius: 8,
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
            }}
          >
            {[10, 20, 50].map((num) => (
              <button
                key={num}
                onClick={() => setLimit(num)}
                style={{
                  background: limit === num ? 'rgba(0, 232, 160, 0.18)' : 'transparent',
                  color: limit === num ? '#00E8A0' : 'var(--text-secondary)',
                  border: limit === num ? '1px solid rgba(0, 232, 160, 0.4)' : 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                Last {num}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={displayedRows.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--bg-surface-raised, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: displayedRows.length > 0 ? 'pointer' : 'not-allowed',
              opacity: displayedRows.length > 0 ? 1 : 0.5,
            }}
            title="Download CSV of visible rows"
          >
            <span>📥</span>
            <span>CSV</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJSON}
            disabled={displayedRows.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--bg-surface-raised, rgba(255, 255, 255, 0.04))',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary)',
              fontSize: 11,
              fontWeight: 600,
              cursor: displayedRows.length > 0 ? 'pointer' : 'not-allowed',
              opacity: displayedRows.length > 0 ? 1 : 0.5,
            }}
            title="Download JSON of visible rows"
          >
            <span>💾</span>
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      {displayedRows.length === 0 ? (
        <div
          style={{
            padding: '36px 16px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            background: 'var(--bg-canvas, rgba(0, 0, 0, 0.2))',
            borderRadius: 12,
            border: '1px dashed var(--border, rgba(255, 255, 255, 0.1))',
          }}
        >
          <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>📡</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            No Telemetry Records Found in Database
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 460, margin: '4px auto 0' }}>
            Awaiting packets from ESP32. When the battery streams or historical records are synchronized, the last 10–20 telemetry logs will appear here in real time.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
              textAlign: 'left',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--bg-surface-raised, rgba(255, 255, 255, 0.03))',
                  borderBottom: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  color: 'var(--text-tertiary, #94A3B8)',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '10px 12px' }}># / Time</th>
                <th style={{ padding: '10px 12px' }}>Voltage</th>
                <th style={{ padding: '10px 12px' }}>Current</th>
                <th style={{ padding: '10px 12px' }}>Power</th>
                <th style={{ padding: '10px 12px' }}>SOC</th>
                <th style={{ padding: '10px 12px' }}>Temp</th>
                <th style={{ padding: '10px 12px' }}>Humidity</th>
                <th style={{ padding: '10px 12px' }}>Gas MQ-2 / 135</th>
                <th style={{ padding: '10px 12px' }}>BHI</th>
                <th style={{ padding: '10px 12px' }}>Safety State</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, idx) => {
                const isNewest = idx === 0
                const safety = row.safety || row.safetyState || 'SAFE'
                const sColor = safetyColor(safety)
                const bhi = row.bhi
                const bhiMeta = bhiStatus(bhi)
                const v = row.voltage
                const i = row.current
                const p = row.power != null ? row.power : (v != null && i != null ? Number((v * i).toFixed(3)) : null)
                const soc = row.soc
                const t = row.temperature
                const hum = row.humidity
                const mq2 = row.gasMq2 ?? row.mq2
                const mq135 = row.gasMq135 ?? row.mq135

                return (
                  <tr
                    key={row.id || `${row.time}-${idx}`}
                    style={{
                      borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.04))',
                      background: isNewest ? 'rgba(0, 232, 160, 0.04)' : idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {/* Time */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isNewest ? '#00E8A0' : 'var(--text-tertiary)',
                          }}
                        />
                        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatTime(row.time)}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                          ({formatRelativeTime(row.time)})
                        </span>
                      </div>
                    </td>

                    {/* Voltage */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: v != null ? 'var(--state-caution, #FFD60A)' : 'var(--text-muted)' }}>
                        {v != null ? `${formatNumber(v, 2)} V` : '--'}
                      </span>
                    </td>

                    {/* Current */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          fontWeight: 600,
                          color: i == null ? 'var(--text-muted)' : i < -0.05 ? 'var(--state-critical, #FF2D55)' : i > 0.05 ? 'var(--state-info, #38BDF8)' : 'var(--text-secondary)',
                        }}
                      >
                        {i != null ? `${formatNumber(i, 3)} A` : '--'}
                      </span>
                    </td>

                    {/* Power */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', color: p != null ? 'var(--state-info, #38BDF8)' : 'var(--text-muted)' }}>
                        {p != null ? `${formatNumber(p, 2)} W` : '--'}
                      </span>
                    </td>

                    {/* SOC */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {soc != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 38,
                              height: 6,
                              borderRadius: 3,
                              background: 'var(--border, rgba(255, 255, 255, 0.1))',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, soc))}%`,
                                height: '100%',
                                background: soc >= 50 ? '#00E8A0' : soc >= 20 ? '#FFD60A' : '#FF2D55',
                              }}
                            />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {Math.round(soc)}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>--</span>
                      )}
                    </td>

                    {/* Temperature */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono, monospace)',
                          color: t == null ? 'var(--text-muted)' : t > 45 ? '#FF2D55' : t > 38 ? '#FFD60A' : 'var(--text-primary)',
                        }}
                      >
                        {t != null ? `${formatNumber(t, 1)} °C` : '--'}
                      </span>
                    </td>

                    {/* Humidity */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', color: hum != null ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {hum != null ? `${formatNumber(hum, 1)} %` : '--'}
                      </span>
                    </td>

                    {/* Gas MQ-2 / MQ-135 */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {mq2 != null ? Math.round(mq2) : '--'} / {mq135 != null ? Math.round(mq135) : '--'}
                      </span>
                    </td>

                    {/* BHI Score */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {bhi != null ? (
                        <span
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontWeight: 700,
                            color: bhiMeta.color,
                          }}
                        >
                          {Math.round(bhi)} <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>/100</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>--</span>
                      )}
                    </td>

                    {/* Safety State */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: `${sColor}18`,
                          color: sColor,
                          border: `1px solid ${sColor}44`,
                        }}
                      >
                        <span>{safety === 'SAFE' ? '🛡️' : safety === 'WARNING' || safety === 'CAUTION' ? '⚠️' : safety === 'CRITICAL' || safety === 'EMERGENCY' ? '🚨' : '🔌'}</span>
                        <span>{safetyLabel(safety)}</span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
