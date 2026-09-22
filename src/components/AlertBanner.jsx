'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, Volume2, VolumeX, Search, Sparkles } from 'lucide-react'
import { playAlertChime } from '../lib/utils'
import styles from './layout.module.css'

// DESIGN.md §4.5 — Global Emergency Alert Banner.
// Anchored below the header whenever the deterministic safety engine enters
// CRITICAL or EMERGENCY. High-visibility pulsing red background, high-contrast
// white text, quick actions to inspect the root cause, mute the browser audio
// chime, and view suggested Gemini remediations.
export default function AlertBanner({ data }) {
  const [muted, setMuted] = useState(false)

  const rawSafety = (data?.battery?.safety ?? data?.safety ?? 'SAFE').toUpperCase()
  const active = rawSafety === 'CRITICAL' || rawSafety === 'EMERGENCY'

  // Audible alarm once per activation window, honoring the mute toggle.
  useEffect(() => {
    if (active && !muted) playAlertChime(rawSafety)
  }, [active, muted, rawSafety])

  if (!active) return null

  return (
    <div className={styles.alertBanner} role="alert" aria-live="assertive">
      <div className={styles.alertBannerTitle}>
        <AlertTriangle size={18} strokeWidth={2.5} />
        <span>
          {rawSafety} — Battery safety engine has locked actuator silencing.
        </span>
      </div>

      <div className={styles.alertBannerActions}>
        <Link href="/controls" className={styles.alertBannerBtn} title="Open the control center">
          <Search size={13} /> Inspect Root Cause
        </Link>
        <Link href="/ai" className={styles.alertBannerBtn} title="Open Gemini remediations">
          <Sparkles size={13} /> Gemini Remediations
        </Link>
        <button
          type="button"
          className={styles.alertBannerBtn}
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          title={muted ? 'Unmute the browser alert chime' : 'Mute the browser alert chime'}
        >
          {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          {muted ? 'Unmute Chime' : 'Mute Chime'}
        </button>
      </div>
    </div>
  )
}