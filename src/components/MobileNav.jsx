'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV } from './Header'

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="mobileNav" aria-label="Primary navigation">
      <div className="mobileNavInner">
        {NAV.map((n) => {
          const Icon = n.icon
          const active = pathname === n.key
          return (
            <Link
              key={n.key}
              href={n.key}
              className={`mobileNavLink ${active ? 'mobileNavLinkActive' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{n.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
