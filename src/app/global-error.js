'use client'

import React from 'react'
import ErrorBoundary from '../components/ErrorBoundary'

export default function GlobalError({ error, reset }) {
  React.useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Battery Vital route error:', error)
    }
  }, [error])

  return (
    <ErrorBoundary>
      <html>
        <head>
          <title>Error — Battery Vital</title>
        </head>
        <body>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              minHeight: '100vh',
              padding: 40,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{ textAlign: 'center', color: 'var(--text-primary)' }}>
              <p style={{ fontSize: 48, margin: '0 0 8px' }}>💥</p>
              <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Console crashed</h1>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                A fatal error occurred. Live ESP32 telemetry keeps streaming.
              </p>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '10px 20px',
                  border: '1px solid var(--accent-primary)',
                  background: 'var(--accent-primary)',
                  color: '#00140D',
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Reload Console
              </button>
            </div>
          </div>
        </body>
      </html>
    </ErrorBoundary>
  )
}