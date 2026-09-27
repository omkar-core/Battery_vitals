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

/*
 * AUTH ARCHITECTURE — Battery Vital
 *
 * FIREBASE AUTH (client SDK) → owns:
 *   - email/password identity, password hashing/salting (Google-managed)
 *   - session tokens (ID tokens, auto-refreshed by the SDK)
 *   - password reset emails, email verification
 *   - signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged
 *
 * MONGODB ATLAS → owns:
 *   - everything that is NOT identity: role (admin/operator/viewer), display name,
 *     department, avatar, last active timestamp, sensor telemetry/history/alerts/ai_diagnostics
 *   - A MongoDB `users` document is keyed by the Firebase UID (`firebaseUid` field, unique index)
 *   - It is a PROFILE, not a credential store. It must NOT contain a password field.
 *
 * SERVER API ROUTES → do NOT re-implement login/register as MongoDB password checks.
 *   - /api/auth/register: given a Firebase UID (from a verified ID token the client just got
 *     from createUserWithEmailAndPassword), create the matching MongoDB profile doc with
 *     default role (viewer unless invited otherwise). Idempotent — if profile exists, return it.
 *   - /api/auth/login: NOT NEEDED — login happens client-side via Firebase Auth directly.
 *   - Middleware verifies the Firebase ID token (Firebase Admin SDK's verifyIdToken) on every
 *     protected API route, attaches decoded UID to request context for MongoDB lookup.
 *   - /api/users/me reads the MongoDB profile for whatever UID was in the verified token.
 *
 * DEMO ACCOUNTS (admin@example.com, operator@example.com, viewer@example.com) must be
 * created as actual Firebase Auth users (via Firebase Console or Admin SDK) with matching
 * MongoDB profile docs. They work through the SAME signup/login path as any real user.
 * No special-cased demo login logic.
 */

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

  // Initialize Firebase Auth state listener — this is the SINGLE source of truth
  // for authentication state. No parallel MongoDB password path.
  useEffect(() => {
    let cancelled = false

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (cancelled) return

      if (fbUser) {
        // User is signed in via Firebase Auth
        // Get fresh ID token (SDK auto-refreshes) for API calls
        const idToken = await fbUser.getIdToken()
        setAuthToken(idToken)
        setToken(idToken)

        // Fetch MongoDB profile (role, name, etc.) keyed by Firebase UID
        try {
          const res = await fetch('/api/users/me', { headers: authHeaders() })
          if (res.ok) {
            const data = await res.json()
            if (!cancelled) {
              setUser({ ...data.user, firebaseUid: fbUser.uid })
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user))
              } catch (e) {}
            }
          } else {
            // Profile doesn't exist yet — build minimal user from Firebase Auth
            if (!cancelled) {
              setUser({
                id: fbUser.uid,
                name: fbUser.displayName || 'Team Member',
                email: fbUser.email,
                role: ROLES.VIEWER,
                title: 'Battery Specialist',
                department: 'Operations',
                avatar: '👁️',
                firebaseUid: fbUser.uid,
              })
            }
          }
        } catch (e) {
          console.warn('Failed to fetch user profile:', e)
        }
      } else {
        // User is signed out
        clearAuthToken()
        setToken('')
        setUser(GUEST_USER)
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        } catch (e) {}
      }

      if (!cancelled) setLoading(false)
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
      // Firebase Auth client SDK — ONLY identity mechanism
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await cred.user.getIdToken()
      setAuthToken(idToken)
      setToken(idToken)

      // Fetch or create MongoDB profile
      try {
        const res = await fetch('/api/users/me', { headers: authHeaders() })
        if (res.ok) {
          const data = await res.json()
          setUser({ ...data.user, firebaseUid: cred.user.uid })
          return { success: true, user: data.user }
        }
      } catch (e) {
        console.warn('Failed to fetch profile after login:', e)
      }

      // Fallback: minimal profile from Firebase Auth
      const fbUser = cred.user
      const fallbackUser = {
        id: fbUser.uid,
        name: fbUser.displayName || 'Team Member',
        email: fbUser.email,
        role: ROLES.VIEWER,
        title: 'Battery Specialist',
        department: 'Operations',
        avatar: '👁️',
        firebaseUid: fbUser.uid,
      }
      setUser(fallbackUser)
      return { success: true, user: fallbackUser }
    } catch (e) {
      // Map Firebase Auth error codes to human-readable messages
      const errorMap = {
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Invalid email or password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
      }
      const message = errorMap[e.code] || e.message || 'Login failed.'
      return { success: false, error: message, code: e.code }
    }
  }, [])

  const signup = useCallback(async ({ name, email, password, role = 'viewer', title = 'Battery Specialist', department = 'Operations' }) => {
    try {
      // 1. Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await cred.user.updateProfile({ displayName: name })

      // 2. Get fresh ID token
      const idToken = await cred.user.getIdToken()
      setAuthToken(idToken)
      setToken(idToken)

      // 3. Create MongoDB profile (idempotent — if profile exists, returns existing)
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ name, email, role, title, department }),
        })
        if (res.ok) {
          const data = await res.json()
          setUser({ ...data.user, firebaseUid: cred.user.uid })
          return { success: true, user: data.user }
        } else {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to create profile')
        }
      } catch (e) {
        console.warn('Failed to create profile:', e)
        // Profile creation failed but Firebase Auth user exists — try to fetch
        try {
          const res = await fetch('/api/users/me', { headers: authHeaders() })
          if (res.ok) {
            const data = await res.json()
            setUser({ ...data.user, firebaseUid: cred.user.uid })
            return { success: true, user: data.user }
          }
        } catch (e2) {}
      }

      // Fallback
      const fbUser = cred.user
      const fallbackUser = {
        id: fbUser.uid,
        name,
        email,
        role: ROLES.VIEWER,
        title,
        department,
        avatar: '👁️',
        firebaseUid: fbUser.uid,
      }
      setUser(fallbackUser)
      return { success: true, user: fallbackUser }
    } catch (e) {
      const errorMap = {
        'auth/email-already-in-use': 'An account with this email already exists. Please log in instead.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/network-request-failed': 'Network error. Please check your connection.',
      }
      const message = errorMap[e.code] || e.message || 'Registration failed.'
      return { success: false, error: message, code: e.code }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await signOut(auth)
    } catch (e) {
      console.warn('Firebase signOut error:', e)
    }
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
    role: user?.role || ROLES.VIEWER,
    isAuthenticated: !!token && user?.id !== 'usr_view_03',
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