'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { ROLES, hasPermission, canControlHardware, canManageUsers, canManageAlerts } from '../lib/permissions'
import { getAuthToken, setAuthToken, clearAuthToken, authHeaders } from '../lib/clientToken'

const AUTH_STORAGE_KEY = 'bv_auth_session_user'

const GUEST_USER = {
  id: 'usr_view_03',
  name: 'Guest Viewer',
  email: 'viewer@example.com',
  role: ROLES.VIEWER,
  title: 'Observer',
  department: 'Guest Access',
  avatar: '👁️',
}

export function useAuth() {
  const [user, setUser] = useState(GUEST_USER)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [firebaseUser, setFirebaseUser] = useState(null)

  // Restore the session: prefer the live server (validates the token), falling
  // back to cached user data so the UI is not blank while offline.
  useEffect(() => {
    let cancelled = false
    const storedToken = getAuthToken()
    if (storedToken) setToken(storedToken)
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      if (saved && !cancelled) setUser(JSON.parse(saved))
    } catch (e) {}

    ;(async () => {
      if (!storedToken) {
        if (!cancelled) setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/users/me', { headers: authHeaders() })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setUser(data.user)
            setToken(storedToken)
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user))
            } catch (e) {}
          }
        }
      } catch (e) {}
      if (!cancelled) setLoading(false)
    })()

    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const switchUser = useCallback((newUser) => {
    setUser(newUser)
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser))
    } catch (e) {}
  }, [])

  const login = useCallback(async (email, password) => {
    try {
      // 1. Firebase Auth login (if enabled)
      try {
        await signInWithEmailAndPassword(auth, email, password)
      } catch (fbErr) {
        console.warn('Firebase auth login fallback to server:', fbErr.message)
      }

      // 2. Server session login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.token && data.user) {
        setAuthToken(data.token)
        setToken(data.token)
        switchUser(data.user)
        return { success: true, user: data.user }
      }
      return { success: false, error: data.error?.message || data.error || 'Login failed', status: res.status }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }, [switchUser])

  const signup = useCallback(async ({ name, email, password, role = 'viewer', title = 'Battery Specialist', department = 'Operations' }) => {
    try {
      // 1. Create account in Firebase Auth
      try {
        await createUserWithEmailAndPassword(auth, email, password)
      } catch (fbErr) {
        console.warn('Firebase auth signup fallback to server:', fbErr.message)
      }

      // 2. Register account on backend API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, title, department }),
      })
      const data = await res.json()
      if (data.token && data.user) {
        setAuthToken(data.token)
        setToken(data.token)
        switchUser(data.user)
        return { success: true, user: data.user }
      }
      return { success: false, error: data.error?.message || data.error || 'Registration failed', status: res.status }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }, [switchUser])

  const logout = useCallback(async () => {
    try {
      await signOut(auth)
    } catch (e) {}
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() })
    } catch (e) {}
    clearAuthToken()
    setToken('')
    setUser(GUEST_USER)
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch (e) {}
  }, [])

  const checkPerm = useCallback((perm) => {
    return hasPermission(user?.role, perm)
  }, [user])

  return {
    user,
    loading,
    token,
    firebaseUser,
    role: user?.role || ROLES.VIEWER,
    isAuthenticated: user?.id !== 'usr_view_03' && Boolean(token || firebaseUser),
    isAdmin: user?.role === ROLES.ADMIN,
    isOperator: user?.role === ROLES.OPERATOR,
    isViewer: user?.role === ROLES.VIEWER,
    canControl: canControlHardware(user?.role),
    canManageUsers: canManageUsers(user?.role),
    canManageAlerts: canManageAlerts(user?.role),
    checkPerm,
    switchUser,
    login,
    signup,
    logout,
  }
}