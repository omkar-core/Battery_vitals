'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const NotificationContext = createContext(null)

const NOTIF_STORAGE_KEY = 'bv_notification_history_v1'
const NOTIF_SOUND_KEY = 'bv_notification_sound_enabled'
const NOTIF_MUTED_KEY = 'bv_notifications_muted_map'

// Audio synthesizer for notification sounds
function playTone(type = 'info') {
  if (typeof window === 'undefined') return
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const now = ctx.currentTime

    if (type === 'critical') {
      // Urgent double high-frequency alarm
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sawtooth'
      osc2.type = 'sawtooth'

      osc1.frequency.setValueAtTime(880, now) // A5
      osc1.frequency.setValueAtTime(1174.66, now + 0.1) // D6
      osc1.frequency.setValueAtTime(880, now + 0.2)
      osc1.frequency.setValueAtTime(1174.66, now + 0.3)

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45)

      osc1.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc1.stop(now + 0.45)
    } else if (type === 'warning') {
      // Beep-beep caution tone
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(740, now) // F#5
      osc.frequency.setValueAtTime(620, now + 0.12)

      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.28)
    } else {
      // Soft pleasant chime (success, info, charging)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(783.99, now + 0.08) // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.16) // C6

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    }
  } catch (e) {
    // AudioContext permission / autoplay restriction
  }
}

const SEED_NOTIFICATIONS = [
  {
    id: 'n-seed-1',
    title: 'ESP32 Connected',
    message: 'ESP32 connected and streaming telemetry from BAT001.',
    type: 'success',
    timestamp: Date.now() - 45000,
    read: false,
    actionUrl: '/diagnostics',
    actionLabel: 'View Telemetry',
  },
  {
    id: 'n-seed-2',
    title: 'Cell Imbalance Notice',
    message: 'Cell imbalance detected (Delta: 120mV) — Balancing cycle scheduled.',
    type: 'warning',
    timestamp: Date.now() - 180000,
    read: false,
    actionUrl: '/analytics',
    actionLabel: 'View Graphs',
  },
  {
    id: 'n-seed-3',
    title: 'Battery Voltage Low',
    message: 'Battery voltage is low (8.1V) — Consider replacement or recharging soon.',
    type: 'warning',
    timestamp: Date.now() - 420000,
    read: false,
    actionUrl: '/alerts',
    actionLabel: 'View Details',
  },
  {
    id: 'n-seed-4',
    title: 'Configuration Active',
    message: 'Battery configuration saved successfully and synced with hardware.',
    type: 'success',
    timestamp: Date.now() - 900000,
    read: true,
    actionUrl: '/settings',
    actionLabel: 'Settings',
  },
]

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [desktopEnabled, setDesktopEnabled] = useState(false)
  const [mutedMap, setMutedMap] = useState({})
  const timerRefs = useRef(new Map())

  // Load persisted notifications and settings on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(NOTIF_STORAGE_KEY)
      if (storedHistory) {
        setNotifications(JSON.parse(storedHistory))
      } else {
        setNotifications(SEED_NOTIFICATIONS)
      }

      const storedSound = localStorage.getItem(NOTIF_SOUND_KEY)
      if (storedSound !== null) {
        setSoundEnabled(storedSound === 'true')
      }

      const storedMuted = localStorage.getItem(NOTIF_MUTED_KEY)
      if (storedMuted) {
        setMutedMap(JSON.parse(storedMuted))
      }
    } catch (e) {
      setNotifications(SEED_NOTIFICATIONS)
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopEnabled(Notification.permission === 'granted')
    }
  }, [])

  // Persist notifications
  const persistNotifications = useCallback((items) => {
    setNotifications(items)
    try {
      localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(items.slice(0, 100)))
    } catch (e) {}
  }, [])

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(NOTIF_SOUND_KEY, String(next))
      } catch (e) {}
      return next
    })
  }, [])

  // Request desktop notifications
  const requestDesktopPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    try {
      const perm = await Notification.requestPermission()
      const granted = perm === 'granted'
      setDesktopEnabled(granted)
      return granted
    } catch (e) {
      return false
    }
  }, [])

  // Dismiss a single toast
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timerRefs.current.has(id)) {
      clearTimeout(timerRefs.current.get(id))
      timerRefs.current.delete(id)
    }
  }, [])

  // Add a toast + notification history entry
  const addNotification = useCallback(
    ({
      title,
      message,
      type = 'info', // 'success' | 'info' | 'warning' | 'critical' | 'charging'
      actionLabel,
      actionUrl,
      onAction,
      duration, // custom ms override
    }) => {
      const id = 'notif-' + Date.now() + '-' + Math.random().toString(16).slice(2, 6)
      const now = Date.now()

      // Check if muted
      if (mutedMap[title] && mutedMap[title] > now) {
        return id
      }

      // Auto-dismiss timing rules:
      // info/success/charging: 5s
      // warning: 10s
      // critical: 30s
      let autoDismissMs = duration
      if (!autoDismissMs) {
        if (type === 'critical') autoDismissMs = 30000
        else if (type === 'warning') autoDismissMs = 10000
        else autoDismissMs = 5000
      }

      const notifItem = {
        id,
        title,
        message,
        type,
        timestamp: now,
        read: false,
        actionLabel,
        actionUrl,
        onAction,
        duration: autoDismissMs,
      }

      // Play synthesized audio if enabled
      if (soundEnabled) {
        playTone(type)
      }

      // Trigger native desktop notification if tab is hidden
      if (
        desktopEnabled &&
        typeof window !== 'undefined' &&
        document.visibilityState === 'hidden' &&
        'Notification' in window
      ) {
        try {
          new Notification(`Battery Vital: ${title}`, {
            body: message,
            icon: '/favicon.svg',
          })
        } catch (e) {}
      }

      // Add to toast queue (max 5 concurrent toasts)
      setToasts((prev) => [notifItem, ...prev].slice(0, 5))

      // Add to notification center history
      setNotifications((prev) => {
        const next = [notifItem, ...prev].slice(0, 100)
        try {
          localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next))
        } catch (e) {}
        return next
      })

      // Setup auto-dismiss timer
      const timer = setTimeout(() => {
        dismissToast(id)
      }, autoDismissMs)
      timerRefs.current.set(id, timer)

      return id
    },
    [soundEnabled, desktopEnabled, mutedMap, dismissToast]
  )

  // Mark all notifications as read
  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }))
      try {
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }, [])

  // Mark a single notification as read
  const markAsRead = useCallback((id) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      try {
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }, [])

  // Mute an alert title for 1 hour
  const muteForOneHour = useCallback((title) => {
    const expiresAt = Date.now() + 3600 * 1000
    setMutedMap((prev) => {
      const next = { ...prev, [title]: expiresAt }
      try {
        localStorage.setItem(NOTIF_MUTED_KEY, JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }, [])

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    persistNotifications([])
  }, [persistNotifications])

  // Count unread notifications
  const unreadCount = notifications.filter((n) => !n.read).length

  const value = {
    toasts,
    notifications,
    unreadCount,
    soundEnabled,
    desktopEnabled,
    addNotification,
    dismissToast,
    markAllRead,
    markAsRead,
    muteForOneHour,
    clearAllNotifications,
    toggleSound,
    requestDesktopPermission,
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    return {
      toasts: [],
      notifications: [],
      unreadCount: 0,
      soundEnabled: true,
      desktopEnabled: false,
      addNotification: () => {},
      dismissToast: () => {},
      markAllRead: () => {},
      markAsRead: () => {},
      muteForOneHour: () => {},
      clearAllNotifications: () => {},
      toggleSound: () => {},
      requestDesktopPermission: async () => false,
    }
  }
  return ctx
}
