'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, Check } from 'lucide-react'
import styles from './components.module.css'

const COOKIE_KEY = 'bv_cookie_consent_v1'

// E5 - GDPR-style cookie/consent banner. Battery Vital stores no tracking
// cookies (only functional/localStorage preferences), and we say exactly that.
export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(COOKIE_KEY)) {
        const timer = setTimeout(() => setVisible(true), 2500)
        return () => clearTimeout(timer)
      }
    } catch (e) {}
  }, [])

  if (!visible) return null

  const accept = () => {
    try {
      localStorage.setItem(COOKIE_KEY, 'accepted')
    } catch (e) {}
    setVisible(false)
  }

  return (
    <div className={styles.cookieBanner} role="region" aria-label="Cookie consent">
      <div className={styles.cookieIcon}>
        <Cookie size={16} />
      </div>
      <div className={styles.cookieBody}>
        <strong>Cookies &amp; local storage</strong>
        <p>
          Battery Vital only uses functional localStorage (theme, notification prefs, onboarding
          progress). No tracking, advertising or third-party analytics cookies are set. See our{' '}
          <Link href="/privacy" onClick={accept}>
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      <div className={styles.cookieActions}>
        <button className={styles.cookieAcceptBtn} onClick={accept}>
          <Check size={13} /> Accept
        </button>
      </div>
    </div>
  )
}