'use client'

import React from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import styles from '../../styles/pages.module.css'

export default function PrivacyPage() {
  return (
    <Layout connected={true} mode="firebase">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            Privacy <span className="gradText">Policy</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Last updated: August 2026
          </p>
        </div>
      </div>

      <div className={styles.aboutTextCard}>
        <h2>What Battery Vital collects</h2>
        <p>
          Battery Vital is an academic engineering project. It stores battery telemetry reported by your
          ESP32 battery monitor in Google Firebase Realtime Database. This includes voltage, current,
          temperature, gas-sensor readings, firmware version, device identifiers and network diagnostics.
          This data is used solely to power the monitoring dashboard, analytics and safety engine.
        </p>

        <h2>Local browser storage</h2>
        <p>
          The console uses <code>localStorage</code> for purely functional preferences: theme choice,
          notification sound settings, read/unread alert history, onboarding progress, command history and
          cookie consent acknowledgement. None of this leaves your browser.
        </p>

        <h2>No tracking, no ads, no third-party cookies</h2>
        <p>
          Battery Vital does not set advertising cookies, does not embed analytics trackers, and does not
          sell or share personal data with third parties. External calls are limited to the services the
          app itself depends on: Firebase Real-time Database and (optionally) the Gemini generative AI API
          for diagnostic text, which receives only sanitized numeric telemetry.
        </p>

        <h2>Your controls</h2>
        <p>
          Clear your browser storage to remove localStorage preferences at any time. Telemetry stored in
          Firebase can be wiped by deleting the project database or removing the associated ESP32 device.
          For academic-review purposes, anonymized sample datasets may be presented alongside this project.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy may be directed to the project team via{' '}
          <a href="mailto:support@batteryvital.com">support@batteryvital.com</a>.
        </p>

        <p style={{ marginTop: 24 }}>
          <Link href="/terms">Read the Terms of Use →</Link>
        </p>
      </div>
    </Layout>
  )
}