'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Activity,
  Bot,
  Bell,
  MoreHorizontal,
  Cpu,
  SlidersHorizontal,
  ShieldCheck,
  Clock,
  Settings,
  HelpCircle,
  X,
} from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'

const PRIMARY_MOBILE = [
  { key: '/', label: 'Live', icon: Home },
  { key: '/analytics', label: 'Analytics', icon: Activity },
  { key: '/ai', label: 'AI Insights', icon: Bot },
  { key: '/alerts', label: 'Alerts', icon: Bell },
]

const MORE_NAV = [
  { key: '/settings', label: 'Battery Config', icon: Settings },
  { key: '/controls', label: 'Controls & Relays', icon: SlidersHorizontal },
  { key: '/diagnostics', label: 'Diagnostics & Flow', icon: Cpu },
  { key: '/passport', label: 'Battery Passport', icon: ShieldCheck },
  { key: '/history', label: 'History & Export', icon: Clock },
  { key: '/about', label: 'About & Help', icon: HelpCircle },
]

export default function MobileNav() {
  const pathname = usePathname()
  const [openMore, setOpenMore] = useState(false)
  const { unreadCount } = useNotifications()

  return (
    <>
      {openMore && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 14, 18, 0.88)',
            backdropFilter: 'blur(16px)',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 16,
          }}
          onClick={() => setOpenMore(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 16,
              padding: '16px 14px',
              marginBottom: 64,
              boxShadow: 'var(--shadow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 4px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                System &amp; Help Modules
              </span>
              <button
                onClick={() => setOpenMore(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  padding: 4,
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MORE_NAV.map((n) => {
                const Icon = n.icon
                const active = pathname === n.key
                return (
                  <Link
                    key={n.key}
                    href={n.key}
                    onClick={() => setOpenMore(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 14px',
                      minHeight: 44,
                      borderRadius: 8,
                      background: active
                        ? 'rgba(61, 220, 151, 0.12)'
                        : 'var(--bg-surface-raised)',
                      border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      color: active ? 'var(--accent-primary)' : 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <Icon size={16} />
                    <span>{n.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="mobileNav" aria-label="Primary bottom navigation">
        <div className="mobileNavInner">
          {PRIMARY_MOBILE.map((n) => {
            const Icon = n.icon
            const active = pathname === n.key
            const isAlertTab = n.key === '/alerts'
            return (
              <Link
                key={n.key}
                href={n.key}
                className={`mobileNavLink ${active ? 'mobileNavLinkActive' : ''}`}
                aria-current={active ? 'page' : undefined}
                style={{ minHeight: 44, position: 'relative' }}
              >
                <Icon size={18} />
                <span>{n.label}</span>
                {isAlertTab && unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 14,
                      background: '#FF2D55',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 800,
                      borderRadius: 8,
                      height: 14,
                      minWidth: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
          <button
            className={`mobileNavLink ${openMore ? 'mobileNavLinkActive' : ''}`}
            onClick={() => setOpenMore(!openMore)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', minHeight: 44 }}
          >
            <MoreHorizontal size={18} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
