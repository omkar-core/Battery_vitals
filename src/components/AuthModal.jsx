'use client'

import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import styles from './components.module.css'

export default function AuthModal({ isOpen, onClose, defaultTab = 'login' }) {
  const { login, signup } = useAuth()
  const [activeTab, setActiveTab] = useState(defaultTab)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const [loginSuccess, setLoginSuccess] = useState(null)

  // Signup form state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupRole, setSignupRole] = useState('viewer')
  const [signupTitle, setSignupTitle] = useState('')
  const [signupDept, setSignupDept] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState(null)
  const [signupSuccess, setSignupSuccess] = useState(null)

  if (!isOpen) return null

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setLoginError(null)
    setLoginSuccess(null)
    setLoginLoading(true)

    try {
      const result = await login(loginEmail, loginPassword)
      if (result.success) {
        setLoginSuccess(`Welcome back, ${result.user.name}! (${result.user.role.toUpperCase()})`)
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setLoginError(result.error || 'Authentication failed. Please check your credentials.')
      }
    } catch (err) {
      setLoginError(err.message || 'Login request failed.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    setSignupError(null)
    setSignupSuccess(null)
    setSignupLoading(true)

    try {
      const result = await signup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        role: signupRole,
        title: signupTitle || (signupRole === 'admin' ? 'Lead Systems Engineer' : signupRole === 'operator' ? 'Field Operator' : 'Analytics Observer'),
        department: signupDept || 'Energy Storage & Safety',
      })

      if (result.success) {
        setSignupSuccess(`Account created! Logged in as ${result.user.name} (${result.user.role.toUpperCase()}).`)
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setSignupError(result.error || 'Registration failed. Please check form fields.')
      }
    } catch (err) {
      setSignupError(err.message || 'Registration request failed.')
    } finally {
      setSignupLoading(false)
    }
  }

  const handlePresetSelect = (email, pass) => {
    setLoginEmail(email)
    setLoginPassword(pass)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: 'var(--bg-surface, #121826)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary, #F8FAFC)' }}>
                Battery Vital Security
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary, #94A3B8)' }}>
                Firebase &amp; RBAC Session Authentication
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary, #94A3B8)',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
            aria-label="Close modal"
          >
            ❌
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            onClick={() => { setActiveTab('login'); setLoginError(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: activeTab === 'login' ? '#00E8A0' : 'var(--text-secondary, #94A3B8)',
              borderBottom: activeTab === 'login' ? '2px solid #00E8A0' : '2px solid transparent',
              background: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none',
              cursor: 'pointer',
            }}
          >
            🔑 Log In
          </button>
          <button
            onClick={() => { setActiveTab('signup'); setSignupError(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: activeTab === 'signup' ? '#00E8A0' : 'var(--text-secondary, #94A3B8)',
              borderBottom: activeTab === 'signup' ? '2px solid #00E8A0' : '2px solid transparent',
              background: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none',
              cursor: 'pointer',
            }}
          >
            ✨ Create Account
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: 24 }}>
          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loginError && (
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'rgba(255, 45, 85, 0.15)', border: '1px solid rgba(255, 45, 85, 0.3)', color: '#FF2D55', fontSize: 13, fontWeight: 600 }}>
                  ⚠️ {loginError}
                </div>
              )}
              {loginSuccess && (
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'rgba(0, 232, 160, 0.15)', border: '1px solid rgba(0, 232, 160, 0.3)', color: '#00E8A0', fontSize: 13, fontWeight: 600 }}>
                  ✅ {loginSuccess}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@example.com"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', marginBottom: 6 }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: '#00E8A0',
                  color: '#0B0F17',
                  fontSize: 14,
                  fontWeight: 800,
                  border: 'none',
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  opacity: loginLoading ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {loginLoading ? 'Authenticating...' : 'Sign In to Dashboard'}
              </button>

              {/* Demo Account Presets */}
              <div style={{ marginTop: 12, paddingTop: 16, borderTop: '1px dashed var(--border-subtle, rgba(255, 255, 255, 0.1))' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #94A3B8)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Quick Demo Accounts
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('admin@example.com', 'BatteryVital-2026')}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, backgroundColor: 'rgba(255, 45, 85, 0.15)', color: '#FF2D55', border: '1px solid rgba(255, 45, 85, 0.3)', cursor: 'pointer' }}
                  >
                    🛡️ Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('operator@example.com', 'BatteryVital-2026')}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, backgroundColor: 'rgba(255, 184, 0, 0.15)', color: '#FFB800', border: '1px solid rgba(255, 184, 0, 0.3)', cursor: 'pointer' }}
                  >
                    ⚡ Operator
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('viewer@example.com', 'BatteryVital-2026')}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', border: '1px solid rgba(56, 189, 248, 0.3)', cursor: 'pointer' }}
                  >
                    👁️ Viewer
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {signupError && (
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'rgba(255, 45, 85, 0.15)', border: '1px solid rgba(255, 45, 85, 0.3)', color: '#FF2D55', fontSize: 13, fontWeight: 600 }}>
                  ⚠️ {signupError}
                </div>
              )}
              {signupSuccess && (
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: 'rgba(0, 232, 160, 0.15)', border: '1px solid rgba(0, 232, 160, 0.3)', color: '#00E8A0', fontSize: 13, fontWeight: 600 }}>
                  ✅ {signupSuccess}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Sarah Connor"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="sarah@batteryvitals.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', marginBottom: 4 }}>
                  Password (min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #94A3B8)', marginBottom: 4 }}>
                  System Role (RBAC)
                </label>
                <select
                  value={signupRole}
                  onChange={(e) => setSignupRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                    backgroundColor: '#1E293B',
                    color: 'var(--text-primary, #F8FAFC)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="viewer">👁️ Viewer — Read-only telemetry, AI &amp; exports</option>
                  <option value="operator">⚡ Operator — Hardware actuators, alerts &amp; AI</option>
                  <option value="admin">🛡️ Admin — Full system access &amp; user management</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: '#00E8A0',
                  color: '#0B0F17',
                  fontSize: 14,
                  fontWeight: 800,
                  border: 'none',
                  cursor: signupLoading ? 'not-allowed' : 'pointer',
                  opacity: signupLoading ? 0.7 : 1,
                  marginTop: 6,
                }}
              >
                {signupLoading ? 'Registering...' : 'Complete Sign Up'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
