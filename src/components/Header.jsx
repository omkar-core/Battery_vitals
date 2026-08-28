'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BatteryCharging, Activity, SlidersHorizontal, Bot, Bell, Clock, Settings, Home } from 'lucide-react'
import styles from './components.module.css'

const NAV = [
  { key: '/', label: 'Dashboard', icon: Home },
  { key: '/analytics', label: 'Analytics', icon: Activity },
  { key: '/controls', label: 'Controls', icon: SlidersHorizontal },
  { key: '/ai', label: 'AI Analyst', icon: Bot },
  { key: '/alerts', label: 'Alerts', icon: Bell },
  { key: '/history', label: 'History', icon: Clock },
  { key: '/settings', label: 'Settings', icon: Settings },
]

export default function Header({ connected, uptime }) {
  const pathname = usePathname()

  return (
    <nav className={styles.shell}>
      <div className={styles.brand}>
        <BatteryCharging size={24} color="#00E8A0" />
        <div>
          <div className={styles.brandTitle}>Battery Vital</div>
          <div className={styles.brandSub}>Safety System</div>
        </div>
      </div>

      <div className={styles.nav}>
        {NAV.map((n) => {
          const Icon = n.icon
          const active = pathname === n.key
          return (
            <Link key={n.key} href={n.key} className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}>
              <Icon size={15} />
              <span>{n.label}</span>
            </Link>
          )
        })}
      </div>

      <div className={styles.status}>
        <span className={`${styles.dot} ${connected ? styles.dotOn : styles.dotOff}`} />
        <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
        {uptime ? <span className={styles.uptime}>{uptime}</span> : null}
      </div>
    </nav>
  )
}