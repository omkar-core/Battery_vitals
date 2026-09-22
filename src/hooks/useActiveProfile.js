'use client'

import { useState, useEffect, useCallback } from 'react'
import { authHeaders } from '../lib/clientToken'

// Fetches the active battery profile deployment once on mount (or when
// batteryId changes). Returns the profile's voltage/current/temperature
// bands so UI components can display dynamic thresholds instead of
// hardcoded 12V references. Does NOT refetch on every telemetry frame.
export function useActiveProfile(batteryId = 'BAT001') {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/battery/active?batteryId=${encodeURIComponent(batteryId)}`,
        { headers: { ...authHeaders() } },
      )
      const data = await res.json()
      setProfile(data?.profile || null)
    } catch (e) {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [batteryId])

  useEffect(() => { load() }, [load])

  // Convenience: voltage band text for display
  const voltageBand = profile?.voltage
    ? `${profile.voltage.minOperating}V – ${profile.voltage.maxAllowed}V`
    : null

  return { profile, loading, voltageBand, reload: load }
}
