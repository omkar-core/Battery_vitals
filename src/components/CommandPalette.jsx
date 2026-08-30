'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Home,
  Activity,
  Bot,
  Bell,
  SlidersHorizontal,
  Cpu,
  ShieldCheck,
  Clock,
  Settings,
  HelpCircle,
  Zap,
  Battery,
  AlertTriangle,
  BookOpen,
  Sun,
  Moon,
  RefreshCw,
  Download,
  FileSpreadsheet,
  X,
  CornerDownLeft,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import styles from './components.module.css'

const COMMAND_ITEMS = [
  // Pages
  { id: 'p-dash', category: 'Pages', title: 'Dashboard', desc: 'Real-time telemetry and overview', icon: Home, path: '/' },
  { id: 'p-analytics', category: 'Pages', title: 'Analytics & Graphs', desc: 'Live curves and multi-metric charts', icon: Activity, path: '/analytics' },
  { id: 'p-ai', category: 'Pages', title: 'AI Insights & Predictions', desc: 'Gemini-powered safety and degradation forecast', icon: Bot, path: '/ai' },
  { id: 'p-alerts', category: 'Pages', title: 'Alerts & Incidents', desc: 'Active safety warnings and history', icon: Bell, path: '/alerts' },
  { id: 'p-controls', category: 'Pages', title: 'Controls & Relays', desc: 'Manual breaker and charging control', icon: SlidersHorizontal, path: '/controls' },
  { id: 'p-diag', category: 'Pages', title: 'Diagnostics & Health', desc: 'Network RSSI, memory and sensor tests', icon: Cpu, path: '/diagnostics' },
  { id: 'p-passport', category: 'Pages', title: 'Battery Passport', desc: 'Digital twin and verified asset details', icon: ShieldCheck, path: '/passport' },
  { id: 'p-history', category: 'Pages', title: 'History & Export', desc: 'Aggregated telemetry logs and CSV/JSON export', icon: Clock, path: '/history' },
  { id: 'p-settings', category: 'Pages', title: 'Settings & Profiles', desc: 'Chemistry thresholds and general preferences', icon: Settings, path: '/settings' },
  { id: 'p-about', category: 'Pages', title: 'About Battery Vital', desc: 'Product info, architecture and specs', icon: HelpCircle, path: '/about' },

  // Batteries
  { id: 'b-smoke', category: 'Batteries', title: 'Living Room Smoke Detector', desc: 'Active 9V Li-MnO2 (BV-9V-001) • 8.7V • 72% SOC', icon: Battery, path: '/' },
  { id: 'b-solar', category: 'Batteries', title: 'Solar LiFePO4 Bank (BAT002)', desc: '12V 100Ah Storage Pack • 13.2V • Standby', icon: Battery, path: '/analytics' },
  { id: 'b-bike', category: 'Batteries', title: 'E-Bike Commuter Pack (BAT003)', desc: '48V 14Ah NMC Pack • 52.4V • Full', icon: Battery, path: '/passport' },

  // Settings
  { id: 's-battery', category: 'Settings', title: 'Battery Configuration', desc: 'Set nominal voltage, capacity, and chemistry (9V, AA, 18650, etc.)', icon: Settings, path: '/settings' },
  { id: 's-notif', category: 'Settings', title: 'Notification Preferences', desc: 'Configure audible chimes, push alerts, and quiet hours', icon: Bell, path: '/settings' },
  { id: 's-calib', category: 'Settings', title: 'Sensor Calibration', desc: 'Zero INA219 current shunt and calibrate ADC voltage divider', icon: SlidersHorizontal, path: '/settings' },

  // Help Articles
  { id: 'h-quick', category: 'Help', title: 'Quick Start Guide', desc: 'Launch the 6-step interactive onboarding tutorial', icon: BookOpen, action: 'onboarding' },
  { id: 'h-wiring', category: 'Help', title: 'Wiring Diagrams', desc: 'ESP32, INA219, DHT11 and gas sensor pinout schematics', icon: Cpu, action: 'wiring' },
  { id: 'h-manual', category: 'Help', title: 'User Manual & Safety Guide', desc: 'Operational limits, temperature bounds, and BHI reference', icon: BookOpen, action: 'manual' },
  { id: 'h-soc', category: 'Help', title: 'Understanding SOC and SOH', desc: 'How coulomb counting and OCV lookup tables work', icon: HelpCircle, path: '/about#faq' },

  // Actions
  { id: 'a-theme', category: 'Actions', title: 'Toggle Light / Dark Mode', desc: 'Switch interface contrast theme', icon: Sun, action: 'toggle_theme' },
  { id: 'a-refresh', category: 'Actions', title: 'Refresh Telemetry Stream', desc: 'Force reload live sensor data from cloud', icon: RefreshCw, action: 'refresh' },
  { id: 'a-export', category: 'Actions', title: 'Export Historical Data (CSV)', desc: 'Download recent telemetry readings in CSV format', icon: FileSpreadsheet, path: '/history' },
]

export default function CommandPalette({ isOpen, onClose, onAction }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const { toggleTheme } = useTheme()
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Filter items
  const filtered = COMMAND_ITEMS.filter((item) => {
    if (!query) return true
    const q = query.toLowerCase().trim()
    return (
      item.title.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
  })

  const handleSelect = useCallback((item) => {
    onClose()
    if (item.action) {
      if (item.action === 'toggle_theme') {
        toggleTheme()
      } else if (item.action === 'refresh') {
        window.location.reload()
      } else if (onAction) {
        onAction(item.action)
      }
    } else if (item.path) {
      router.push(item.path)
    }
  }, [onClose, toggleTheme, onAction, router])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filtered, selectedIndex, handleSelect, onClose])

  if (!isOpen) return null

  // Group filtered results by category
  const groups = filtered.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || []
    acc[item.category].push(item)
    return acc
  }, {})

  let flatCounter = 0

  return (
    <div className={styles.cmdOverlay} onClick={onClose}>
      <div
        className={styles.cmdModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command Palette"
      >
        {/* Search Bar Input */}
        <div className={styles.cmdInputWrap}>
          <Search size={18} className={styles.cmdSearchIcon} />
          <input
            ref={inputRef}
            className={styles.cmdInput}
            placeholder="Type a page, battery, setting, or command... (e.g. 'bat conf')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
          />
          {query && (
            <button className={styles.cmdClearBtn} onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
          <kbd className={styles.cmdEscKbd}>ESC</kbd>
        </div>

        {/* Results List */}
        <div className={styles.cmdList}>
          {filtered.length === 0 ? (
            <div className={styles.cmdEmpty}>
              <HelpCircle size={24} style={{ opacity: 0.5, marginBottom: 8 }} />
              <span>No results found for &ldquo;{query}&rdquo;</span>
            </div>
          ) : (
            Object.entries(groups).map(([cat, items]) => (
              <div key={cat} className={styles.cmdGroup}>
                <div className={styles.cmdGroupTitle}>{cat}</div>
                {items.map((item) => {
                  const currentIndex = flatCounter++
                  const isSelected = currentIndex === selectedIndex
                  const Icon = item.icon

                  return (
                    <div
                      key={item.id}
                      className={`${styles.cmdItem} ${isSelected ? styles.cmdItemSelected : ''}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <div className={styles.cmdItemIcon}>
                        <Icon size={16} />
                      </div>
                      <div className={styles.cmdItemContent}>
                        <span className={styles.cmdItemTitle}>{item.title}</span>
                        <span className={styles.cmdItemDesc}>{item.desc}</span>
                      </div>
                      {isSelected && (
                        <div className={styles.cmdEnterHint}>
                          <CornerDownLeft size={12} />
                          <span>Select</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className={styles.cmdFooter}>
          <div style={{ display: 'flex', gap: 14 }}>
            <span><kbd>&uarr;</kbd> <kbd>&darr;</kbd> to navigate</span>
            <span><kbd>&crarr;</kbd> to open</span>
            <span><kbd>ESC</kbd> to close</span>
          </div>
          <span>Battery Vital Command Hub</span>
        </div>
      </div>
    </div>
  )
}
