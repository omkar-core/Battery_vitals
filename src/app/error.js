'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function Error({ error, reset }) {
  React.useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Battery Vital page error:', error)
    }
  }, [error])

  return (
    <div role="alert" style={{ display: 'grid', placeItems: 'center', minHeight: '50vh', padding: 40 }}>
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: 'var(--bg-surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={40} color="#FF6B35" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 20 }}>This section hit an error</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14 }}>
          Live telemetry from the ESP32 is unaffected. Retry the section or return to the dashboard.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--accent-primary)',
              background: 'var(--accent-primary)',
              color: '#00140D',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} /> Retry section
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Home size={15} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}