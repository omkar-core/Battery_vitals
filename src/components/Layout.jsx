'use client'

import { useEffect } from 'react'
import Header from './Header'
import MobileNav from './MobileNav'
import styles from './layout.module.css'

export default function Layout({ children, connected, mode, lastSeen }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register resilient service worker and auto-update
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => {})
        })
        .catch(() => {})
    }
  }, [])

  return (
    <div className={styles.layout}>
      <Header connected={connected} lastSeen={lastSeen} />

      <main className={styles.main}>
        {mode === 'firebase' ? (
          <div className={styles.banner}>
            <span className={styles.bannerDot} /> Real-time Firebase stream active
          </div>
        ) : null}

        {!connected && (
          <div className={styles.offlineBanner} role="status">
            <span className={styles.offlineDot} />
            {mode === 'poll'
              ? 'Backend unreachable — showing last cached state. Retrying automatically...'
              : 'Device offline / waiting for telemetry. Showing last known reading.'}
          </div>
        )}

        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.disclaimer}>
          <strong>System is monitoring only - NOT a certified BMS.</strong> Battery Vital provides
          predictive analytics, edge telemetry, and environmental hazard tracking. Always rely on
          certified hardware BMS protection and follow battery manufacturer specifications.
        </div>
      </footer>

      <MobileNav />
    </div>
  )
}
