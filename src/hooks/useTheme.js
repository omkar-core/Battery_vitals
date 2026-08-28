'use client'

import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setThemeState] = useState('dark')

  useEffect(() => {
    const saved = localStorage.getItem('bv_theme') || 'dark'
    setThemeState(saved)
    document.documentElement.setAttribute('data-theme', saved)

    const handleStorage = (e) => {
      if (e.key === 'bv_theme' && e.newValue) {
        setThemeState(e.newValue)
        document.documentElement.setAttribute('data-theme', e.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('bv_theme', next)
    } catch (e) {}
  }

  const setTheme = (newTheme) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    try {
      localStorage.setItem('bv_theme', newTheme)
    } catch (e) {}
  }

  return { theme, isDark: theme === 'dark', toggleTheme, setTheme }
}
