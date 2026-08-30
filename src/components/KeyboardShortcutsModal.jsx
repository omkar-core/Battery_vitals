'use client'

import React from 'react'
import { X, Command, Keyboard } from 'lucide-react'
import styles from './components.module.css'

const SHORTCUTS_LIST = [
  { key: 'Ctrl + D', desc: 'Go to Dashboard' },
  { key: 'Ctrl + A', desc: 'Go to Alerts' },
  { key: 'Ctrl + K', desc: 'Open Command Palette (Quick Search)' },
  { key: 'Ctrl + /', desc: 'Open Quick Start & Help' },
  { key: '?', desc: 'Show Keyboard Shortcuts Overlay' },
  { key: 'N', desc: 'Mark all notifications as read' },
  { key: 'R', desc: 'Refresh dashboard telemetry data' },
  { key: 'S', desc: 'Go to Settings & Configuration' },
  { key: 'ESC', desc: 'Close any active modal or dropdown' },
]

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.shortcutsModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard Shortcuts"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Keyboard size={20} color="var(--accent-primary)" />
            <h3 className={styles.modalTitle}>Keyboard Shortcuts</h3>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className={styles.shortcutsGrid}>
          {SHORTCUTS_LIST.map((item) => (
            <div key={item.key} className={styles.shortcutRow}>
              <span className={styles.shortcutDesc}>{item.desc}</span>
              <kbd className={styles.shortcutKbd}>{item.key}</kbd>
            </div>
          ))}
        </div>

        <div className={styles.modalFooter}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Tip: Press <kbd className={styles.tooltipKbd}>?</kbd> anytime to open this cheatsheet.
          </span>
          <button className={styles.primaryModalBtn} onClick={onClose}>
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}
