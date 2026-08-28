'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Activity,
  SlidersHorizontal,
  Bell,
  MoreHorizontal,
  Cpu,
  Bot,
  ShieldCheck,
  Clock,
  Sparkles,
  Settings,
  X,
} from 'lucide-react'

const PRIMARY_MOBILE = [
  { key: '/', label: 'Live', icon: Home },
  { key: '/analytics', label: 'Graphs', icon: Activity },
  { key: '/controls', label: 'Controls', icon: SlidersHorizontal },
  { key: '/alerts', label: 'Alerts', icon: Bell },
]

const MORE_NAV = [
  { key: '/diagnostics', label: 'Diagnostics & Flow', icon: Cpu },
  { key: '/ai', label: 'AI Health Assistant', icon: Bot },
  { key: '/passport', label: 'Battery Passport', icon: ShieldCheck },
  { key: '/history', label: 'History & Sessions', icon: Clock },
  { key: '/coming-soon', label: 'Coming Soon', icon: Sparkles },
  { key: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileNav() {
  const pathname = usePathname()
  const [openMore, setOpenMore] = useState(false)

  return (
    <>
      {openMore && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 18, 0.85)',
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
              background: '#0D1424',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 20,
              padding: '16px 12px',
              marginBottom: 60,
              boxShadow: '0 -10px 40px rgba(0,0,0,0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0 8px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F4F6FB' }}>
                All Modules
              </span>
              <button
                onClick={() => setOpenMore(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9AA7BF',
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
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: active
                        ? 'rgba(0, 232, 160, 0.12)'
                        : 'rgba(255, 255, 255, 0.03)',
                      color: active ? '#00E8A0' : '#CBD5E1',
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

      <nav className="mobileNav" aria-label="Primary navigation">
        <div className="mobileNavInner">
          {PRIMARY_MOBILE.map((n) => {
            const Icon = n.icon
            const active = pathname === n.key
            return (
              <Link
                key={n.key}
                href={n.key}
                className={`mobileNavLink ${active ? 'mobileNavLinkActive' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{n.label}</span>
              </Link>
            )
          })}
          <button
            className={`mobileNavLink ${openMore ? 'mobileNavLinkActive' : ''}`}
            onClick={() => setOpenMore(!openMore)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <MoreHorizontal size={18} />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
