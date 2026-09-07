'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  Zap,
  CheckCheck,
  Volume2,
  VolumeX,
  ExternalLink,
  Trash2,
  Sparkles,
  Cpu,
  RefreshCw,
  Radio,
  X,
  Send,
} from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import styles from './components.module.css'

export default function NotificationCenter({ onClose }) {
  const {
    notifications,
    unreadCount,
    markAllRead,
    markAsRead,
    clearAllNotifications,
    triggerTestNotification,
    soundEnabled,
    toggleSound,
  } = useNotifications()

  const [activeTab, setActiveTab] = useState('all') // 'all', 'esp32', 'safety', 'sync'

  const filtered = notifications.filter((n) => {
    if (activeTab === 'esp32') return n.category === 'esp32' || n.title?.toLowerCase().includes('esp32') || n.title?.toLowerCase().includes('sensor')
    if (activeTab === 'safety') return n.category === 'safety' || n.type === 'critical' || n.type === 'warning'
    if (activeTab === 'sync') return n.category === 'sync' || n.title?.toLowerCase().includes('sync') || n.title?.toLowerCase().includes('update') || n.title?.toLowerCase().includes('mongo')
    return true
  }).slice(0, 15)

  const formatTime = (ts) => {
    if (!ts) return ''
    const diffSec = Math.floor((Date.now() - ts) / 1000)
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return `${Math.floor(diffHr / 24)}d ago`
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'critical':
        return <ShieldAlert size={15} color="#FF2D55" />
      case 'warning':
        return <AlertTriangle size={15} color="#FFB800" />
      case 'charging':
        return <Zap size={15} color="#00E8A0" />
      case 'success':
        return <CheckCircle2 size={15} color="#00E8A0" />
      default:
        return <Info size={15} color="#38BDF8" />
    }
  }

  const getCategoryBadge = (category, type) => {
    if (category === 'esp32') {
      return { label: 'ESP32 & Sensors', color: '#00E8A0', bg: 'rgba(0,232,160,0.1)' }
    }
    if (category === 'safety' || type === 'critical' || type === 'warning') {
      return { label: 'Safety Guard', color: '#FF2D55', bg: 'rgba(255,45,85,0.1)' }
    }
    if (category === 'sync') {
      return { label: 'Cloud & Updates', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' }
    }
    return { label: 'System Message', color: '#BF5AF2', bg: 'rgba(191,90,242,0.1)' }
  }

  return (
    <div className={styles.notifDropdown} role="dialog" aria-label="Notification Center">
      {/* Header */}
      <div className={styles.notifHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(0, 232, 160, 0.15)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Bell size={14} color="var(--accent-primary)" />
          </div>
          <div>
            <span className={styles.notifTitle}>Notification Center</span>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Real-time telemetry &amp; system feed</div>
          </div>
          {unreadCount > 0 && (
            <span className={styles.notifUnreadBadge}>{unreadCount} new</span>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={styles.notifControlBtn}
            onClick={triggerTestNotification}
            title="Generate a dynamic test notification"
          >
            <Sparkles size={13} color="#BF5AF2" />
            <span style={{ fontSize: 11 }}>+ Test</span>
          </button>

          <button
            className={styles.notifControlBtn}
            onClick={toggleSound}
            title={soundEnabled ? 'Mute audio notification chimes' : 'Enable audio notification chimes'}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} color="#FF2D55" />}
          </button>

          {unreadCount > 0 && (
            <button
              className={styles.notifMarkAllBtn}
              onClick={markAllRead}
              title="Mark all notifications as read"
            >
              <CheckCheck size={12} />
              <span>Read All</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              className={styles.notifControlBtn}
              onClick={clearAllNotifications}
              title="Clear all notification history"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.notifFilterBar}>
        {[
          { id: 'all', label: 'All' },
          { id: 'esp32', label: 'ESP32 & Sensors' },
          { id: 'safety', label: 'Safety Alerts' },
          { id: 'sync', label: 'Updates & Sync' },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`${styles.notifFilterTab} ${activeTab === tab.id ? styles.notifFilterTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className={styles.notifList}>
        {filtered.length === 0 ? (
          <div className={styles.notifEmpty}>
            <Bell size={28} color="var(--text-tertiary)" style={{ opacity: 0.4, marginBottom: 8 }} />
            <span style={{ fontWeight: 600 }}>No notifications in this category</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Telemetry events and safety status alerts will appear here in real time.
            </span>
            <button
              onClick={triggerTestNotification}
              style={{
                marginTop: 10,
                padding: '5px 12px',
                borderRadius: 8,
                background: 'rgba(0, 232, 160, 0.12)',
                border: '1px solid rgba(0, 232, 160, 0.3)',
                color: '#00E8A0',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Send Test Notification
            </button>
          </div>
        ) : (
          filtered.map((item) => {
            const catBadge = getCategoryBadge(item.category, item.type)
            return (
              <div
                key={item.id}
                className={`${styles.notifListItem} ${!item.read ? styles.notifListItemUnread : ''}`}
                onClick={() => markAsRead(item.id)}
              >
                <div className={styles.notifItemLeft}>
                  <span className={styles.notifItemIcon}>{getTypeIcon(item.type)}</span>
                </div>
                <div className={styles.notifItemContent}>
                  <div className={styles.notifItemTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className={styles.notifItemTitle}>{item.title}</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 100,
                          background: catBadge.bg,
                          color: catBadge.color,
                          border: `1px solid ${catBadge.color}33`,
                        }}
                      >
                        {catBadge.label}
                      </span>
                    </div>
                    <span className={styles.notifItemTime}>{formatTime(item.timestamp)}</span>
                  </div>

                  <p className={styles.notifItemMsg}>{item.message}</p>

                  {item.actionUrl && (
                    <Link
                      href={item.actionUrl}
                      className={styles.notifItemLink}
                      onClick={() => {
                        markAsRead(item.id)
                        if (onClose) onClose()
                      }}
                    >
                      <span>{item.actionLabel || 'View Details'}</span>
                      <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
                {!item.read && <span className={styles.notifUnreadDot} />}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className={styles.notifFooter}>
        <Link
          href="/alerts"
          className={styles.notifViewAllBtn}
          onClick={() => {
            if (onClose) onClose()
          }}
        >
          View Full Incident Logs &rarr;
        </Link>
      </div>
    </div>
  )
}
