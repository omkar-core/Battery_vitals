'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  BatteryCharging,
  Wind,
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
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useNotifications } from '../context/NotificationContext'

const PRIMARY_MOBILE = [
  { key: '/', label: 'Live', icon: Home },
  { key: '/battery', label: 'Battery', icon: Zap },
  { key: '/environmental', label: 'Env', icon: Wind },
  { key: '/ai', label: 'AI', icon: Bot },
  { key: '/alerts', label: 'Alerts', icon: Bell },
]

const MORE_NAV = [
  { key: '/analytics', label: 'Live Graphs', icon: Activity },
  { key: '/controls', label: 'Actuator Controls', icon: SlidersHorizontal },
  { key: '/users', label: 'Users & Roles (RBAC)', icon: Users },
  { key: '/diagnostics', label: 'Diagnostics', icon: Cpu },
  { key: '/history?tab=trends', label: 'Historical Trends', icon: Clock },
  { key: '/settings', label: 'Settings & Limits', icon: Settings },
  { key: '/passport', label: 'Battery Passport', icon: ShieldCheck },
  { key: '/about', label: 'About & Manual', icon: HelpCircle },
]

export default function MobileNav() {
  const pathname = usePathname()
  const [openMore, setOpenMore] = useState(false)
  const { unreadCount } = useNotifications()

  return (
    <>
      <style jsx global>{`
        .bv-mobile-bottom-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .bv-mobile-bottom-nav {
            display: grid !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: rgba(10, 14, 22, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid var(--border-subtle);
            grid-template-columns: repeat(6, 1fr);
            align-items: center;
            z-index: 85;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.35);
          }
        }
      `}</style>

      {openMore && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 9, 15, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
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
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-strong)',
              borderRadius: 18,
              padding: '16px 14px',
              marginBottom: 64,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              maxHeight: '75vh',
              overflowY: 'auto',
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
                System Navigation
              </span>
              <button
                onClick={() => setOpenMore(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  padding: 6,
                  cursor: 'pointer',
                  minHeight: 44,
                  minWidth: 44,
                  display: 'grid',
                  placeItems: 'center',
                }}
                aria-label="Close more navigation menu"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {MORE_NAV.map((n) => {
                const Icon = n.icon
                const active = pathname === n.key.split('?')[0]
                return (
                  <Link
                    key={n.key}
                    href={n.key}
                    onClick={() => setOpenMore(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 10px',
                      minHeight: 44,
                      borderRadius: 12,
                      background: active ? 'rgba(0, 232, 160, 0.12)' : 'rgba(255,255,255,0.03)',
                      color: active ? '#00E8A0' : 'var(--text-primary)',
                      border: active ? '1px solid rgba(0, 232, 160, 0.3)' : '1px solid var(--border-subtle)',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <Icon size={16} color={active ? '#00E8A0' : '#38BDF8'} />
                    <span>{n.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="bv-mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
        {PRIMARY_MOBILE.map((item) => {
          const Icon = item.icon
          const active = pathname === item.key
          const isAlerts = item.key === '/alerts'

          return (
            <Link
              key={item.key}
              href={item.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                color: active ? '#00E8A0' : 'var(--text-secondary)',
                textDecoration: 'none',
                height: '100%',
                minHeight: 44,
                position: 'relative',
              }}
            >
              <Icon size={18} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
              {isAlerts && unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: '20%',
                    background: '#FF2D55',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: 10,
                    padding: '1px 5px',
                    lineHeight: 1,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </Link>
          )
        })}

        <button
          onClick={() => setOpenMore(!openMore)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            color: openMore ? '#00E8A0' : 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            height: '100%',
            minHeight: 44,
            cursor: 'pointer',
          }}
          aria-label="More navigation links"
        >
          <MoreHorizontal size={18} />
          <span style={{ fontSize: 10, fontWeight: 500 }}>More</span>
        </button>
      </nav>
    </>
  )
}
