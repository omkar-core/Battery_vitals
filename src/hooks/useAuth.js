'use client'

import { useState, useEffect, useCallback } from 'react'
import { ROLES, hasPermission, canControlHardware, canManageUsers, canManageAlerts } from '../lib/permissions'

const AUTH_STORAGE_KEY = 'bv_auth_session_user'

const INITIAL_USER = {
  id: 'usr_admin_01',
  name: 'Chief Battery Engineer',
  email: 'admin@example.com',
  role: ROLES.ADMIN,
  title: 'Lead Power Systems Engineer',
  department: 'Energy Storage & Safety',
  avatar: '🛡️',
}

export function useAuth() {
  const [user, setUser] = useState(INITIAL_USER)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      if (saved) {
        setUser(JSON.parse(saved))
      }
    } catch (e) {}
    setLoading(false)
  }, [])

  const switchUser = useCallback((newUser) => {
    setUser(newUser)
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser))
    } catch (e) {}
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.user) {
        switchUser(data.user)
        return { success: true, user: data.user }
      }
      return { success: false, error: data.error || 'Login failed' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }, [switchUser])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {}
    const defaultViewer = {
      id: 'usr_view_03',
      name: 'Guest Viewer',
      email: 'viewer@example.com',
      role: ROLES.VIEWER,
      title: 'Observer',
      department: 'Guest Access',
      avatar: '👁️',
    }
    switchUser(defaultViewer)
  }, [switchUser])

  const checkPerm = useCallback((perm) => {
    return hasPermission(user?.role, perm)
  }, [user])

  return {
    user,
    loading,
    role: user?.role || ROLES.VIEWER,
    isAdmin: user?.role === ROLES.ADMIN,
    isOperator: user?.role === ROLES.OPERATOR,
    isViewer: user?.role === ROLES.VIEWER,
    canControl: canControlHardware(user?.role),
    canManageUsers: canManageUsers(user?.role),
    canManageAlerts: canManageAlerts(user?.role),
    checkPerm,
    switchUser,
    login,
    logout,
  }
}
