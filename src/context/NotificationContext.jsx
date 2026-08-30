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

const SEED_NOTIFICATIONS = []

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [desktopEnabled, setDesktopEnabled] = useState(false)
  const [mutedMap, setMutedMap] = useState({})
  // K8 - Per-toast countdown state + hover pause support.
  const remainingRef = useRef(new Map())
  const hoverRef = useRef(new Set())

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

  // K8 - Toast countdown driven by a 1s ticker; hover holds the countdown.
  useEffect(() => {
    const ticker = setInterval(() => {
      setToasts((prev) => {
        let changed = false
        const next = prev.filter((t) => {
          if (hoverRef.current.has(t.id)) return true
          const remaining = (remainingRef.current.get(t.id) ?? t.duration ?? 5000) - 1000
          remainingRef.current.set(t.id, remaining)
          if (remaining <= 0) {
            changed = true
            return false
          }
          return true
        })
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(ticker)
  }, [])

  // Dismiss a single toast
  const dismissToast = useCallback((id) => {
    remainingRef.current.delete(id)
    hoverRef.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // K8 - Pause/resume a toast countdown while the pointer is over it
  const setToastHover = useCallback((id, hovering) => {
    if (hovering) hoverRef.current.add(id)
    else hoverRef.current.delete(id)
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

      // Track remaining countdown per toast
      remainingRef.current.set(id, autoDismissMs)

      // Add to notification center history
      setNotifications((prev) => {
        const next = [notifItem, ...prev].slice(0, 100)
        try {
          localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next))
        } catch (e) {}
        return next
      })

      return id
    },
    [soundEnabled, desktopEnabled, mutedMap]
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
    setToastHover,
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
      setToastHover: () => {},
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
