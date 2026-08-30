'use client'

import { useEffect, useRef } from 'react'

const BASE_TITLE = 'Battery Vital — Mission Control Battery Telemetry & Safety System'

// L18 - Live battery percentage in the browser tab title.
//   123: "🔋 75% | Battery Vital"
// backgrounded + SOC < 20: "⚠️ LOW 15% | Battery Vital"
// restored or SOC missing: restores the base title.
export default function useTabTitle(soc, deviceId = 'BAT001') {
  const socRef = useRef(soc)
  socRef.current = soc

  useEffect(() => {
    if (typeof document === 'undefined') return
    const update = () => {
      const s = Number(socRef.current)
      const hidden = document.hidden
      if (Number.isNaN(s) || s == null || socRef.current == null) {
        document.title = BASE_TITLE
        return
      }
      const icon = hidden && s < 20 ? '⚠️ LOW' : `🔋 ${Math.round(s)}%`
      document.title = `${icon} | Battery Vital`
    }

    update()
    const interval = setInterval(update, 3000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
      document.title = BASE_TITLE
    }
  }, [deviceId])
}