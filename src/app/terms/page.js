'use client'

import React from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import styles from '../../styles/pages.module.css'

export default function TermsPage() {
  return (
    <Layout connected={true} mode="firebase">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            Terms <span className="gradText">of Use</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Last updated: August 2026
          </p>
        </div>
      </div>

      <div className={styles.aboutTextCard}>
        <h2>Academic &amp; educational use</h2>
        <p>
          Battery Vital is an academic engineering demonstration (not a commercial product) built to
          showcase real-time battery telemetry acquisition, cloud streaming, deterministic safety logic
          and AI-assisted analytics on an ESP32 hardware platform.
        </p>

        <h2>Not a certified BMS</h2>
        <p>
          This system is <strong>monitoring-only</strong> and is NOT a certified battery-management
          system. It must never be used as the sole protective layer for batteries in critical or
          commercial applications. Always rely on certified hardware BMS protection and follow battery
          manufacturer specifications.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Use the console for monitoring, learning and evaluation. Do not attempt to drive connected
          relays or actuators beyond rated hardware limits, bypass software interlocks, or use the
          platform to stir unrecoverable battery states. Hardware controls reflect real electrical
          actions and may affect battery safety.
        </p>

        <h2>Data accuracy</h2>
        <p>
          The platform displays telemetry exactly as reported by the hardware. Where a sensor has not
          reported a value or a measurement is not yet valid (for example, State of Health before a
          resistance measurement), the dashboard renders “--” rather than inventing numbers. Analytical
          outputs are advisory only.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the extent permitted by law, the project team accepts no liability for damage, loss or
          injury arising from use of this software or hardware, including battery damage from incorrect
          wiring, over-voltage, over-temperature or relay misuse.
        </p>

        <p style={{ marginTop: 24 }}>
          <Link href="/privacy">Read the Privacy Policy →</Link>
        </p>
      </div>
    </Layout>
  )
}