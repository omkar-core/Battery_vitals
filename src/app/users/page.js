'use client'

import React, { useState, useEffect, Suspense } from 'react'
import Layout from '../../components/Layout'
import { useAuth } from '../../hooks/useAuth'
import { ROLES, PERMISSIONS } from '../../lib/permissions'
import {
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  Edit2,
  Check,
  Lock,
  Unlock,
  Radio,
  Clock,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

export default function UsersPage() {
  return (
    <Suspense fallback={<Layout><div style={{ padding: 40, textAlign: 'center' }}>Loading user management...</div></Layout>}>
      <UsersPageInner />
    </Suspense>
  )
}

function UsersPageInner() {
  const { user, role, isAdmin, canManageUsers, switchUser } = useAuth()
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', role: ROLES.OPERATOR, department: 'Operations' })

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setUserList(data.users)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!newUser.name || !newUser.email) return

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      if (res.ok) {
        setShowAddModal(false)
        setNewUser({ name: '', email: '', role: ROLES.OPERATOR, department: 'Operations' })
        fetchUsers()
      }
    } catch (e) {}
  }

  const handleDeleteUser = async (id) => {
    if (!confirm('Are you sure you want to remove this user?')) return
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' })
      fetchUsers()
    } catch (e) {}
  }

  const handleSimulateRole = (targetUser) => {
    switchUser(targetUser)
  }

  const roleBadgeStyle = (r) => {
    if (r === ROLES.ADMIN) return { bg: 'rgba(0,232,160,0.15)', border: '#00E8A0', color: '#00E8A0', label: '🛡️ Admin' }
    if (r === ROLES.OPERATOR) return { bg: 'rgba(56,189,248,0.15)', border: '#38BDF8', color: '#38BDF8', label: '⚡ Operator' }
    return { bg: 'rgba(255,255,255,0.08)', border: 'var(--border-subtle)', color: 'var(--text-secondary)', label: '👁️ Viewer' }
  }

  return (
    <Layout>
      {/* 1. Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Users size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#00E8A0" />
            User Management &amp; <span className="gradText">Access Control</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Multi-user collaboration with fine-grained Role-Based Access Control (Admin, Operator, Viewer).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setShowAddModal(true)}
            className={styles.primaryBtn}
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <UserPlus size={15} /> Add Team Member
          </button>
        </div>
      </div>

      {/* 2. Active Session Switcher Banner */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 24 }}>{user?.avatar || '👤'}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {user?.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: roleBadgeStyle(user?.role).bg,
                  color: roleBadgeStyle(user?.role).color,
                  border: `1px solid ${roleBadgeStyle(user?.role).border}`,
                }}
              >
                {roleBadgeStyle(user?.role).label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Active Session: {user?.email} • {user?.department || 'Operations'}
            </div>
          </div>
        </div>

        {/* Quick Simulated Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Simulate Role:</span>
          {userList.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSimulateRole(u)}
              style={{
                background: user?.id === u.id ? 'rgba(0,232,160,0.2)' : 'rgba(255,255,255,0.04)',
                border: user?.id === u.id ? '1px solid #00E8A0' : '1px solid var(--border-subtle)',
                color: user?.id === u.id ? '#00E8A0' : 'var(--text-secondary)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {u.name.split(' ')[0]} ({u.role})
            </button>
          ))}
        </div>
      </div>

      {/* 3. Roles & Permissions Matrix */}
      <div className={styles.card} style={{ marginBottom: 20 }}>
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="#00E8A0" />
            <h3 className={styles.cardTitle}>Role Permissions Matrix</h3>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>System Security Policy</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Permission Capability</th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>🛡️ Admin</th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>⚡ Operator</th>
                <th style={{ textAlign: 'center', padding: '10px 12px' }}>👁️ Viewer</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>View Live Telemetry &amp; Gauges</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Full Access</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Full Access</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Full Access</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>Hardware Actuators (LED / Buzzer override)</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Full Control</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Full Control</td>
                <td style={{ textAlign: 'center', color: '#FF2D55' }}>✕ Read-Only</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>Acknowledge &amp; Configure Alerts</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Allowed</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Allowed</td>
                <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>🟡 View Only</td>
              </tr>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>Manage Team Accounts &amp; Roles</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Admin Only</td>
                <td style={{ textAlign: 'center', color: '#FF2D55' }}>✕ Denied</td>
                <td style={{ textAlign: 'center', color: '#FF2D55' }}>✕ Denied</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>Gemini AI Diagnostics &amp; Predictions</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Enabled</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Enabled</td>
                <td style={{ textAlign: 'center', color: '#00E8A0' }}>✓ Enabled</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Team Members Table */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#38BDF8" />
            <h3 className={styles.cardTitle}>Team Members &amp; Collaborators ({userList.length})</h3>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Member</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Role</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Department</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => {
                const badge = roleBadgeStyle(u.role)
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{u.avatar || '👤'}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 8,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {u.department || 'Operations'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00E8A0', fontSize: 11, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00E8A0' }} /> Active
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={!canManageUsers || u.role === ROLES.ADMIN}
                        style={{
                          background: 'rgba(255,45,85,0.08)',
                          border: '1px solid rgba(255,45,85,0.2)',
                          color: '#FF2D55',
                          borderRadius: 6,
                          padding: '4px 8px',
                          cursor: canManageUsers && u.role !== ROLES.ADMIN ? 'pointer' : 'not-allowed',
                          opacity: canManageUsers && u.role !== ROLES.ADMIN ? 1 : 0.4,
                        }}
                        title="Remove User"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-strong)',
              borderRadius: 16,
              padding: 24,
              width: '90%',
              maxWidth: 440,
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: 'var(--text-primary)' }}>
              Invite Team Member
            </h3>

            <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. Sarah Connor"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#FFF',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="sconnor@batteryvital.com"
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#FFF',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Role &amp; Permissions
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    color: '#FFF',
                  }}
                >
                  <option value={ROLES.ADMIN}>Admin (Full Access &amp; Hardware Control)</option>
                  <option value={ROLES.OPERATOR}>Operator (Hardware Control &amp; Alerts)</option>
                  <option value={ROLES.VIEWER}>Viewer (Read-Only Telemetry)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    borderRadius: 8,
                    padding: '8px 16px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} style={{ padding: '8px 16px' }}>
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
