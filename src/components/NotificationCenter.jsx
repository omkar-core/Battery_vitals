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
  Filter,
} from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'
import styles from './components.module.css'

export default function NotificationCenter({ onClose }) {
  const {
    notifications,
    unreadCount,
    markAllRead,
    markAsRead,
    soundEnabled,
    toggleSound,
    desktopEnabled,
    requestDesktopPermission,
  } = useNotifications()

  const [activeTab, setActiveTab] = useState('all') // 'all', 'critical', 'warning', 'info'

  const filtered = notifications.filter((n) => {
    if (activeTab === 'critical') return n.type === 'critical'
    if (activeTab === 'warning') return n.type === 'warning'
    if (activeTab === 'info') return n.type === 'info' || n.type === 'success' || n.type === 'charging'
    return true
  }).slice(0, 10)

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
        return <ShieldAlert size={14} color="#FF2D55" />
      case 'warning':
        return <AlertTriangle size={14} color="#FFB800" />
      case 'charging':
        return <Zap size={14} color="#00E8A0" />
      case 'success':
        return <CheckCircle2 size={14} color="#00E8A0" />
      default:
        return <Info size={14} color="#38BDF8" />
    }
  }

  return (
    <div className={styles.notifDropdown}>
      {/* Header */}
      <div className={styles.notifHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} color="var(--accent-primary)" />
          <span className={styles.notifTitle}>Notifications</span>
          {unreadCount > 0 && (
            <span className={styles.notifUnreadBadge}>{unreadCount} new</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={styles.notifControlBtn}
            onClick={toggleSound}
            title={soundEnabled ? 'Mute notification chimes' : 'Enable notification chimes'}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} color="#FF2D55" />}
          </button>
          {unreadCount > 0 && (
            <button
              className={styles.notifMarkAllBtn}
              onClick={markAllRead}
              title="Mark all notifications as read"
            >
              <CheckCheck size={13} />
              <span>Mark read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.notifFilterBar}>
        {['all', 'critical', 'warning', 'info'].map((tab) => (
          <button
            key={tab}
            className={`${styles.notifFilterTab} ${activeTab === tab ? styles.notifFilterTabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className={styles.notifList}>
        {filtered.length === 0 ? (
          <div className={styles.notifEmpty}>
            <Bell size={24} color="var(--text-tertiary)" style={{ opacity: 0.5, marginBottom: 6 }} />
            <span>No notifications in this category</span>
          </div>
        ) : (
          filtered.map((item) => (
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
                  <span className={styles.notifItemTitle}>{item.title}</span>
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
          ))
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
          View All Alert History &rarr;
        </Link>
      </div>
    </div>
  )
}
