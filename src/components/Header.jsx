'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BatteryCharging,
  Activity,
  SlidersHorizontal,
  Bot,
  Bell,
  Clock,
  Settings,
  Home,
  Cpu,
  ShieldCheck,
  Sun,
  Moon,
} from 'lucide-react'
import { getConnectionState } from '../lib/utils'
import { useTheme } from '../hooks/useTheme'
import styles from './components.module.css'

export const NAV = [
  { key: '/', label: 'Dashboard', icon: Home },
  { key: '/controls', label: 'Controls', icon: SlidersHorizontal },
  { key: '/analytics', label: 'Graphs & Trends', icon: Activity },
  { key: '/ai', label: 'AI Analyst', icon: Bot },
  { key: '/alerts', label: 'Alerts', icon: Bell },
  { key: '/diagnostics', label: 'Diagnostics', icon: Cpu },
  { key: '/passport', label: 'Passport', icon: ShieldCheck },
  { key: '/history', label: 'History & Export', icon: Clock },
  { key: '/settings', label: 'Settings', icon: Settings },
]

export default function Header({ connected, lastSeen }) {
  const pathname = usePathname()
  const { isDark, toggleTheme } = useTheme()
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [connInfo, setConnInfo] = useState(getConnectionState(lastSeen))

  useEffect(() => {
    setConnInfo(getConnectionState(lastSeen))
    const timer = setInterval(() => {
      setConnInfo(getConnectionState(lastSeen))
    }, 3000)
    return () => clearInterval(timer)
  }, [lastSeen, connected])

  useEffect(() => {
    let active = true
    const fetchUnread = () => {
      fetch('/api/alerts?limit=50')
        .then((r) => r.json())
        .then((alerts) => {
          if (active && Array.isArray(alerts)) {
            const count = alerts.filter((a) => !a.acknowledged).length
            setUnreadAlerts(count)
          }
        })
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 15000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const stateKey = connInfo.state.toLowerCase()

  return (
    <nav className={styles.shell}>
      <Link href="/" className={styles.brand}>
        <div className={styles.brandLogo}>
          <BatteryCharging size={18} color="var(--accent-primary)" />
        </div>
        <div>
          <div className={styles.brandTitle}>
            Battery <span className={styles.brandAccent}>Vital</span>
          </div>
          <div className={styles.brandSub}>Signal Room Safety Console</div>
        </div>
      </Link>

      <div className={styles.nav}>
        {NAV.map((n) => {
          const Icon = n.icon
          const active = pathname === n.key
          const isAlertTab = n.key === '/alerts'
          return (
            <Link
              key={n.key}
              href={n.key}
              className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
            >
              <Icon size={14} />
              <span>{n.label}</span>
              {isAlertTab && unreadAlerts > 0 && (
                <span className={styles.badgeCount}>{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>
              )}
            </Link>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Dark / Light Mode Toggle Button */}
        <button
          onClick={toggleTheme}
          className={styles.themeToggle}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun size={16} color="var(--state-caution)" /> : <Moon size={16} color="var(--state-info)" />}
        </button>

        {/* Real-Time Connection Indicator Pill */}
        <div
          className={`${styles.status} ${styles['status_' + stateKey] || ''}`}
          title={`Status: ${connInfo.state} (Last seen: ${connInfo.ageSec != null ? `${connInfo.ageSec}s ago` : 'never'})`}
        >
          <span
            className={`${styles.dot} ${styles['dot_' + stateKey] || ''}`}
            style={{ background: connInfo.color }}
          />
          <span style={{ color: connInfo.color, fontWeight: 700 }}>{connInfo.state}</span>
        </div>
      </div>
    </nav>
  )
}
