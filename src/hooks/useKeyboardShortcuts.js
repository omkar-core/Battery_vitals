'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useKeyboardShortcuts({
  onOpenCommandPalette,
  onOpenHelp,
  onOpenShortcuts,
  onMarkAllNotificationsRead,
  onCloseAll,
}) {
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is actively typing in an input, textarea, or select
      const activeEl = document.activeElement
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable)

      const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Escape always closes open modals
      if (e.key === 'Escape') {
        if (onCloseAll) onCloseAll()
        return
      }

      // If user is inside an input, ignore global shortcut hotkeys except Escape
      if (isInput) return

      // Ctrl/Cmd + K: Command Palette
      if (isCmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        if (onOpenCommandPalette) onOpenCommandPalette()
        return
      }

      // Ctrl/Cmd + D: Dashboard
      if (isCmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        router.push('/')
        return
      }

      // Ctrl/Cmd + A: Alerts
      if (isCmdOrCtrl && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        router.push('/alerts')
        return
      }

      // Ctrl/Cmd + /: Help / Quick Start
      if (isCmdOrCtrl && e.key === '/') {
        e.preventDefault()
        if (onOpenHelp) onOpenHelp()
        return
      }

      // Single key shortcuts (when not in input):
      // ?: Show Keyboard Shortcuts Modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        if (onOpenShortcuts) onOpenShortcuts()
        return
      }

      // N: Mark all notifications as read
      if (e.key === 'n' || e.key === 'N') {
        if (!isCmdOrCtrl && onMarkAllNotificationsRead) {
          e.preventDefault()
          onMarkAllNotificationsRead()
          return
        }
      }

      // R: Refresh dashboard data
      if ((e.key === 'r' || e.key === 'R') && !isCmdOrCtrl) {
        e.preventDefault()
        window.location.reload()
        return
      }

      // S: Go to Settings
      if ((e.key === 's' || e.key === 'S') && !isCmdOrCtrl) {
        e.preventDefault()
        router.push('/settings')
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router, onOpenCommandPalette, onOpenHelp, onOpenShortcuts, onMarkAllNotificationsRead, onCloseAll])
}
