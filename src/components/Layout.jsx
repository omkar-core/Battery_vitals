'use client'

import React, { useState, useEffect } from 'react'
import Header from './Header'
import Breadcrumbs from './Breadcrumbs'
import ContextualActions from './ContextualActions'
import BatteryPassportSlideout from './BatteryPassportSlideout'
import CommandPalette from './CommandPalette'
import KeyboardShortcutsModal from './KeyboardShortcutsModal'
import OnboardingModal from './OnboardingModal'
import { UserManualModal, WiringDiagramModal, VersionInfoModal } from './HelpModals'
import ToastContainer from './ToastContainer'
import { NotificationProvider, useNotifications } from '../context/NotificationContext'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import styles from './layout.module.css'

function LayoutInner({ children, connected, mode, lastSeen, data }) {
  const { markAllRead } = useNotifications()

  // Modal and drawer visibility states
  const [passportOpen, setPassportOpen] = useState(false)
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [wiringOpen, setWiringOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)

  // First-time onboarding trigger check
  useEffect(() => {
    try {
      const done = localStorage.getItem('bv_onboarding_completed')
      if (!done) {
        const timer = setTimeout(() => {
          setOnboardingOpen(true)
        }, 1000)
        return () => clearTimeout(timer)
      }
    } catch (e) {}
  }, [])

  // Register service worker if available
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => {})
        })
        .catch(() => {})
    }
  }, [])

  // Close all open dialogs helper
  const closeAllModals = () => {
    setPassportOpen(false)
    setCmdPaletteOpen(false)
    setShortcutsOpen(false)
    setOnboardingOpen(false)
    setManualOpen(false)
    setWiringOpen(false)
    setVersionOpen(false)
  }

  // Bind global keyboard shortcuts
  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCmdPaletteOpen(true),
    onOpenHelp: () => setOnboardingOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
    onMarkAllNotificationsRead: markAllRead,
    onCloseAll: closeAllModals,
  })

  return (
    <div className={styles.layout}>
      {/* 1. Global Redesigned Header */}
      <Header
        connected={connected}
        lastSeen={lastSeen}
        telemetryData={data}
        onOpenPassport={() => setPassportOpen(true)}
        onOpenCommandPalette={() => setCmdPaletteOpen(true)}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        onOpenManual={() => setManualOpen(true)}
        onOpenWiring={() => setWiringOpen(true)}
        onOpenVersion={() => setVersionOpen(true)}
      />

      {/* 2. Breadcrumbs Bar */}
      <Breadcrumbs />

      {/* 3. Page-Specific Contextual Action Bar */}
      <ContextualActions onRefresh={() => window.location.reload()} />

      {/* 4. Main Page Body */}
      <main className={styles.main}>
        {mode === 'firebase' && (
          <div className={styles.banner}>
            <span className={styles.bannerDot} /> Real-time Firebase stream active
          </div>
        )}

        {!connected && (
          <div className={styles.offlineBanner} role="status">
            <span className={styles.offlineDot} />
            {mode === 'poll'
              ? 'Backend unreachable — showing last cached state. Retrying automatically...'
              : 'Device offline / waiting for telemetry. Showing last known reading.'}
          </div>
        )}

        {children}
      </main>

      {/* 5. Modernized Footer with Keyboard Shortcut Hint */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.disclaimer}>
            <strong>System is monitoring only - NOT a certified BMS.</strong> Battery Vital provides
            predictive analytics, edge telemetry, and environmental hazard tracking. Always rely on
            certified hardware BMS protection and follow battery manufacturer specifications.
          </div>
          <div className={styles.footerShortcutsHint}>
            <span>
              Press <kbd onClick={() => setShortcutsOpen(true)} className={styles.footerKbd}>?</kbd> for keyboard shortcuts • <kbd onClick={() => setCmdPaletteOpen(true)} className={styles.footerKbd}>Ctrl+K</kbd> to search
            </span>
          </div>
        </div>
      </footer>

      {/* 6. Real-time Toast Notifications Container */}
      <ToastContainer />

      {/* 7. Right-Side Battery Passport Slide-out Drawer */}
      <BatteryPassportSlideout
        isOpen={passportOpen}
        onClose={() => setPassportOpen(false)}
        data={data}
      />

      {/* 8. Command Palette Modal (Ctrl+K) */}
      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onAction={(action) => {
          if (action === 'onboarding') setOnboardingOpen(true)
          if (action === 'wiring') setWiringOpen(true)
          if (action === 'manual') setManualOpen(true)
        }}
      />

      {/* 9. Keyboard Shortcuts Overlay Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {/* 10. 6-Step Guided Onboarding Modal */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onOpenManual={() => setManualOpen(true)}
      />

      {/* 11. Help & Diagnostic Resource Modals */}
      <UserManualModal isOpen={manualOpen} onClose={() => setManualOpen(false)} />
      <WiringDiagramModal isOpen={wiringOpen} onClose={() => setWiringOpen(false)} />
      <VersionInfoModal isOpen={versionOpen} onClose={() => setVersionOpen(false)} />
    </div>
  )
}

export default function Layout(props) {
  return (
    <NotificationProvider>
      <LayoutInner {...props} />
    </NotificationProvider>
  )
}
