'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

// D6 - React error boundary that wraps all pages. Prevents a single runtime
// crash from blanking the whole console. Errors are logged to the console
// (they never contain secrets) and the user gets a friendly recovery UI.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { error, hasError: true }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Battery Vital UI error:', error, info?.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null, hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        role="alert"
        style={{
          display: 'grid',
          placeItems: 'center',
          minHeight: '50vh',
          padding: 40,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={40} color="#FF6B35" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 20 }}>
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 20px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
            The console hit an unexpected runtime error. Your device data is safe —
            live telemetry keeps flowing from the ESP32.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleReset}
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
              <RefreshCw size={15} /> Try again
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
              <Home size={15} /> Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }
}