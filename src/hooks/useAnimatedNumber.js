'use client'

import { useEffect, useRef, useState } from 'react'

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

// K2 - Number Counting Animation: animates a numeric value from its previous
// render value to `targetValue` over `duration` ms via requestAnimationFrame.
// Respects prefers-reduced-motion (jumps straight to the value). Returns null
// when the target is null/NaN so callers can render their '--' placeholder.
export default function useAnimatedNumber(targetValue, duration = 500, digits = null) {
  const prevRef = useRef(null)
  const rafRef = useRef(null)
  const [display, setDisplay] = useState(null)

  useEffect(() => {
    const target = Number(targetValue)
    if (targetValue == null || Number.isNaN(target)) {
      prevRef.current = null
      setDisplay(null)
      return
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced || prevRef.current == null) {
      prevRef.current = target
      setDisplay(target)
      return
    }

    const from = prevRef.current
    const to = target
    if (from === to) return
    const start = performance.now()

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const val = from + (to - from) * easeOutCubic(t)
      prevRef.current = val
      setDisplay(val)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [targetValue, duration])

  if (display == null || Number.isNaN(Number(display))) return null
  const digitsFinal = digits != null ? digits : Number.isInteger(Number(targetValue)) ? 0 : 2
  return Number(display).toFixed(digitsFinal)
}