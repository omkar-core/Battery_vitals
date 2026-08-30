'use client'

import React, { useState, useRef, useEffect } from 'react'
import styles from './components.module.css'

export default function Tooltip({
  children,
  text,
  shortcut,
  position = 'top', // 'top' | 'bottom' | 'left' | 'right'
  delay = 500, // 0.5s default as required
  maxWidth = 250,
}) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!text) return children

  return (
    <span
      className={styles.tooltipContainer}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {visible && (
        <span
          className={`${styles.tooltipBox} ${styles['tooltip_' + position] || styles.tooltip_top}`}
          style={{ maxWidth }}
          role="tooltip"
        >
          <span className={styles.tooltipText}>{text}</span>
          {shortcut && <kbd className={styles.tooltipKbd}>{shortcut}</kbd>}
        </span>
      )}
    </span>
  )
}
