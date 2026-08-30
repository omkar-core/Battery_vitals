'use client'

import React from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  ShieldAlert,
  Zap,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import styles from './components.module.css'

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    color: '#00E8A0',
    borderColor: 'rgba(0, 232, 160, 0.4)',
    bg: 'rgba(7, 24, 18, 0.94)',
    badgeBg: 'rgba(0, 232, 160, 0.15)',
    label: 'SUCCESS',
  },
  info: {
    icon: Info,
    color: '#38BDF8',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    bg: 'rgba(10, 22, 35, 0.94)',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    label: 'INFO',
  },
  warning: {
    icon: AlertTriangle,
    color: '#FFB800',
    borderColor: 'rgba(255, 184, 0, 0.45)',
    bg: 'rgba(30, 22, 5, 0.94)',
    badgeBg: 'rgba(255, 184, 0, 0.15)',
    label: 'WARNING',
  },
  critical: {
    icon: ShieldAlert,
    color: '#FF2D55',
    borderColor: 'rgba(255, 45, 85, 0.55)',
    bg: 'rgba(35, 8, 14, 0.96)',
    badgeBg: 'rgba(255, 45, 85, 0.2)',
    label: 'CRITICAL',
  },
  charging: {
    icon: Zap,
    color: '#00E8A0',
    borderColor: 'rgba(0, 232, 160, 0.45)',
    bg: 'rgba(7, 26, 20, 0.94)',
    badgeBg: 'rgba(0, 232, 160, 0.18)',
    label: 'CHARGING',
  },
}

export default function ToastContainer() {
  const { toasts, dismissToast, setToastHover, muteForOneHour } = useNotifications()

  if (!toasts || toasts.length === 0) return null

  return (
    <div className={styles.toastViewport} aria-live="polite" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const conf = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info
        const Icon = conf.icon

        return (
          <div
            key={toast.id}
            className={`${styles.toastItem} ${styles['toast_' + toast.type] || ''}`}
            style={{
              borderColor: conf.borderColor,
              background: conf.bg,
            }}
            onMouseEnter={() => setToastHover(toast.id, true)}
            onMouseLeave={() => setToastHover(toast.id, false)}
          >
            <div className={styles.toastHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={styles.toastIconWrap}
                  style={{ background: conf.badgeBg, color: conf.color }}
                >
                  <Icon size={16} />
                </span>
                <span className={styles.toastTitle} style={{ color: conf.color }}>
                  {toast.title}
                </span>
                <span
                  className={styles.toastBadge}
                  style={{ background: conf.badgeBg, color: conf.color, borderColor: conf.borderColor }}
                >
                  {conf.label}
                </span>
              </div>
              <button
                className={styles.toastCloseBtn}
                onClick={() => dismissToast(toast.id)}
                title="Dismiss notification"
                aria-label="Close notification"
              >
                <X size={14} />
              </button>
            </div>

            <p className={styles.toastMessage}>{toast.message}</p>

            <div className={styles.toastFooter}>
              <div className={styles.toastActions}>
                {toast.actionUrl ? (
                  <Link
                    href={toast.actionUrl}
                    className={styles.toastActionBtn}
                    onClick={() => dismissToast(toast.id)}
                  >
                    {toast.actionLabel || 'View Details'}
                  </Link>
                ) : null}

                {toast.onAction ? (
                  <button
                    className={styles.toastActionBtn}
                    onClick={() => {
                      toast.onAction()
                      dismissToast(toast.id)
                    }}
                  >
                    {toast.actionLabel || 'Acknowledge'}
                  </button>
                ) : (
                  <button
                    className={styles.toastActionSecondaryBtn}
                    onClick={() => dismissToast(toast.id)}
                  >
                    Acknowledge
                  </button>
                )}

                {toast.type === 'warning' || toast.type === 'critical' ? (
                  <button
                    className={styles.toastMuteBtn}
                    onClick={() => {
                      muteForOneHour(toast.title)
                      dismissToast(toast.id)
                    }}
                    title="Stop similar notifications for 1 hour"
                  >
                    Mute 1h
                  </button>
                ) : null}
              </div>
            </div>

            {/* Countdown duration bar */}
            <div
              className={styles.toastProgressBar}
              style={{
                animationDuration: `${toast.duration}ms`,
                background: conf.color,
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
