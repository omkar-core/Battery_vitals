'use client'

import { useEffect } from 'react'
import Header from './Header'
import styles from './layout.module.css'

export default function Layout({ children, connected, mode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <div className={styles.layout}>
      <Header connected={connected} />
      <main className={styles.main}>
        {mode === 'mqtt' ? (
          <div className={styles.banner}>
            <span className={styles.bannerDot} /> Real-time MQTT stream active
          </div>
        ) : null}
        {children}
      </main>
    </div>
  )
}
