'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import styles from './components.module.css'

const ROUTE_NAME_MAP = {
  '': 'Dashboard',
  analytics: 'Analytics',
  ai: 'AI Insights',
  alerts: 'Alerts',
  controls: 'Controls & Relays',
  diagnostics: 'Diagnostics & Health',
  passport: 'Battery Passport',
  history: 'History & Export',
  settings: 'System & Settings',
  about: 'About Battery Vital',
}

const TAB_NAME_MAP = {
  live: 'Live Graphs',
  trends: 'Historical Trends',
  compare: 'Compare Sessions',
  export: 'Export Data',
  predictions: 'Predictions',
  recommendations: 'Recommendations',
  training: 'Training Data',
  history: 'Alert History',
  active: 'Active Alerts',
  alerts: 'Alert Settings',
  notifications: 'Notification Preferences',
  battery: 'Battery Configuration',
  calibration: 'Sensor Calibration',
  faq: 'FAQ',
  manual: 'User Manual',
  version: 'Version Info',
}

export default function Breadcrumbs({ customCrumbs }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams?.get('tab') || searchParams?.get('filter')

  // If we are on dashboard root ('/') and no custom crumbs or tab, we don't need a lone Home
  if ((pathname === '/' || pathname === '') && !tab && !customCrumbs) {
    return null
  }

  // Build crumbs array
  let crumbs = [{ label: 'Home', href: '/' }]

  if (customCrumbs && Array.isArray(customCrumbs)) {
    crumbs = crumbs.concat(customCrumbs)
  } else {
    const segments = pathname.split('/').filter(Boolean)
    let accum = ''
    segments.forEach((seg, idx) => {
      accum += `/${seg}`
      const isLast = idx === segments.length - 1 && !tab
      const label = ROUTE_NAME_MAP[seg.toLowerCase()] || seg.charAt(0).toUpperCase() + seg.slice(1)
      crumbs.push({
        label,
        href: isLast ? null : accum,
      })
    })

    if (tab && TAB_NAME_MAP[tab.toLowerCase()]) {
      crumbs.push({
        label: TAB_NAME_MAP[tab.toLowerCase()],
        href: null,
      })
    }
  }

  return (
    <nav className={styles.breadcrumbBar} aria-label="Breadcrumb navigation">
      <div className={styles.breadcrumbInner}>
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1
          return (
            <React.Fragment key={crumb.label + idx}>
              {idx > 0 && <ChevronRight size={12} className={styles.breadcrumbSep} />}
              {idx === 0 ? (
                <Link href="/" className={styles.breadcrumbHome} title="Go to Dashboard">
                  <Home size={13} />
                  <span className={styles.breadcrumbText}>Home</span>
                </Link>
              ) : isLast || !crumb.href ? (
                <span className={styles.breadcrumbCurrent} aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className={styles.breadcrumbLink}>
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </nav>
  )
}
