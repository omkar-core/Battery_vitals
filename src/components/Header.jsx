'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BatteryCharging,
  Activity,
  Bot,
  Bell,
  Settings,
  Home,
  Cpu,
  ShieldCheck,
  Sun,
  Moon,
  ChevronDown,
  Check,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  HelpCircle,
  User,
  SlidersHorizontal,
  Sliders,
  FileText,
  Clock,
  Sparkles,
  GitCompare,
  Layers,
  ExternalLink,
  Menu,
  X,
  Radio,
  LogOut,
  PlusCircle,
  TrendingUp,
} from 'lucide-react'
import { getConnectionState } from '../lib/utils'
import { useTheme } from '../hooks/useTheme'
import { useNotifications } from '../context/NotificationContext'
import NotificationCenter from './NotificationCenter'
import Tooltip from './Tooltip'
import AnimatedBatteryIcon from './AnimatedBatteryIcon'
import MoodBadge from './MoodBadge'
import Sparkline from './Sparkline'
import styles from './components.module.css'

export default function Header({
  connected = true,
  lastSeen,
  telemetryData,
  onOpenPassport,
  onOpenOnboarding,
  onOpenManual,
  onOpenWiring,
  onOpenVersion,
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { isDark, toggleTheme } = useTheme()
  const { unreadCount } = useNotifications()

  // State management for dropdowns and popups
  const [activeDropdown, setActiveDropdown] = useState(null) // 'analytics' | 'ai' | 'alerts' | 'system' | 'help' | 'user' | 'notif'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [lastUpdateText, setLastUpdateText] = useState('Just now')
  const [clockText, setClockText] = useState('')
  const [runtimeText, setRuntimeText] = useState('')

  // Monitored devices are derived exclusively from live telemetry — no fabricated packs.
  const devices = useMemo(() => {
    const t = telemetryData || {}
    const battery = t.battery || t
    const batteryId = t.batteryId || 'BAT001'
    const deviceId = t.deviceId || null
    const profile = t.profile || battery.profile || null
    return [
      {
        id: batteryId,
        name: profile || batteryId,
        type: deviceId || '--',
        voltage: battery.voltage != null ? `${Number(battery.voltage).toFixed(1)}V` : '--',
        soc: battery.soc != null ? Math.round(Number(battery.soc)) : null,
        active: true,
      },
    ]
  }, [telemetryData])

  // Rolling SOC buffer for the mini sparkline (real telemetry only).
  const socBuffRef = useRef([])
  const [socSpark, setSocSpark] = useState([])
  useEffect(() => {
    const t = telemetryData || {}
    const s = t.battery?.soc ?? t.soc
    if (s == null) return
    const last = socBuffRef.current[socBuffRef.current.length - 1]?.soc
    if (last === s) return
    socBuffRef.current.push({ soc: Number(s) })
    if (socBuffRef.current.length > 28) socBuffRef.current.shift()
    setSocSpark(socBuffRef.current.slice())
  }, [telemetryData])

  const headerRef = useRef(null)

  // Current battery data (from telemetry or defaults matching specifications)
  // Dynamic connection badge calculation
  const [connInfo, setConnInfo] = useState(() => getConnectionState(lastSeen))

  useEffect(() => {
    const updateConn = () => {
      const info = getConnectionState(lastSeen)
      setConnInfo(info)

      if (info.ageSec == null) {
        setLastUpdateText('Connecting...')
      } else if (info.ageSec < 5) {
        setLastUpdateText('Last update: Just now')
      } else if (info.ageSec < 60) {
        setLastUpdateText(`Last update: ${info.ageSec} seconds ago`)
      } else {
        const mins = Math.floor(info.ageSec / 60)
        setLastUpdateText(`Last update: ${mins}m ago`)
      }

      // L11 - Live wall clock (HH:MM:SS) next to the connection badge.
      setClockText(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )

      // L11 - Runtime estimate: time-to-empty (discharge) or time-to-full (charge),
      // derived from real SOC + current. Never fabricates — nulls when missing.
      const t = telemetryData || {}
      const s = t.battery?.soc != null ? Number(t.battery.soc) : t.soc != null ? Number(t.soc) : null
      const c = t.battery?.current != null ? Number(t.battery.current) : t.current != null ? Number(t.current) : null
      const capAh = t.battery?.capacityAh ?? t.capacityAh
      if (s == null || c == null || Math.abs(c) < 0.02) {
        setRuntimeText('')
      } else {
        const capacity = Number(capAh) > 0 ? Number(capAh) : 1.4 // vendor nominal when unreported
        const hours =
          c > 0 ? ((100 - s) / 100) * capacity / c : (s / 100) * capacity / Math.abs(c)
        if (!isFinite(hours) || hours <= 0) {
          setRuntimeText('')
        } else {
          const h = Math.floor(hours)
          const m = Math.floor((hours - h) * 60)
          setRuntimeText(`${c > 0 ? 'Full at' : 'Empty in'} ${h}h ${m.toString().padStart(2, '0')}m`)
        }
      }
    }

    updateConn()
    const timer = setInterval(updateConn, 1000)
    return () => clearInterval(timer)
  }, [lastSeen, connected, telemetryData])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setActiveDropdown(null)
  }, [pathname])

  const toggleDropdown = (name) => {
    setActiveDropdown((prev) => (prev === name ? null : name))
  }

  // Connection badge styling and icon
  const renderConnectionBadge = () => {
    if (!connected || connInfo.state === 'OFFLINE') {
      return (
        <div
          className={`${styles.connBadge} ${styles.connBadge_offline}`}
          title="Device offline - telemetry paused"
        >
          <AlertTriangle size={13} className={styles.blinkAnimation} />
          <span className={styles.connBadgeText}>OFFLINE</span>
        </div>
      )
    }

    if (connInfo.state === 'NO_DATA') {
      return (
        <div
          className={`${styles.connBadge} ${styles.connBadge_connecting}`}
          title="No telemetry frames received yet"
        >
          <RefreshCw size={13} className={styles.spinAnimation} />
          <span className={styles.connBadgeText}>NO DATA</span>
        </div>
      )
    }

    if (connInfo.state === 'SLOW') {
      return (
        <div
          className={`${styles.connBadge} ${styles.connBadge_slow}`}
          title="Stream is lagging - last frame 10-30s ago"
        >
          <Clock size={13} className={styles.blinkAnimation} />
          <span className={styles.connBadgeText}>SLOW</span>
        </div>
      )
    }

    // Default LIVE state
    return (
      <div
        className={`${styles.connBadge} ${styles.connBadge_live}`}
        title="Streaming live telemetry via Firebase Realtime Database"
      >
        <span className={styles.livePulseDot}>
          <Check size={10} strokeWidth={3} />
        </span>
        <span className={styles.connBadgeText}>LIVE</span>
      </div>
    )
  }

  return (
    <header className={styles.headerShell} ref={headerRef}>
      <div className={styles.headerContainer}>
        {/* ========================================================================= */}
        {/* 1. LEFT SECTION: Logo + Tagline                                       */}
        {/* ========================================================================= */}
        <div className={styles.headerLeft}>
          {/* Mobile Hamburger Button */}
          <button
            className={styles.mobileHamburgerBtn}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Brand Logo & Updated Tagline */}
          <Link href="/" className={styles.brandGroup} title="Battery Vitals Home">
            <div className={styles.brandLogoIcon}>
              <BatteryCharging size={20} color="var(--accent-primary)" />
            </div>
            <div className={styles.brandTextGroup}>
              <div className={styles.brandTitleText}>
                Battery <span className={styles.brandVitalText}>Vitals</span>
              </div>
            </div>
          </Link>

        </div>

        {/* ========================================================================= */}
        {/* 2. CENTER SECTION: Reorganized 6 Main Navigation Items with Dropdowns    */}
        {/* ========================================================================= */}
        <nav className={styles.headerNav} aria-label="Main Navigation">
          {/* 1. Dashboard (Direct Link) */}
          <Tooltip text="Mission control overview & live gauges" shortcut="Ctrl+D">
            <Link
              href="/"
              className={`${styles.navItemBtn} ${pathname === '/' ? styles.navItemActive : ''}`}
            >
              <Home size={16} />
              <span>Dashboard</span>
            </Link>
          </Tooltip>

          {/* 2. Analytics (Dropdown) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${pathname === '/analytics' || pathname === '/history' ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('analytics')}
              aria-expanded={activeDropdown === 'analytics'}
            >
              <Activity size={16} />
              <span>Analytics</span>
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'analytics' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/analytics"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Activity size={15} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Live Graphs</div>
                    <div className={styles.dropdownItemDesc}>Real-time voltage, current &amp; temp curves</div>
                  </div>
                </Link>
                <Link
                  href="/history?tab=trends"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <TrendingUp size={15} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Historical Trends</div>
                    <div className={styles.dropdownItemDesc}>Multi-day degradation &amp; capacity analysis</div>
                  </div>
                </Link>
                <Link
                  href="/history?tab=compare"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <GitCompare size={15} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Compare Sessions</div>
                    <div className={styles.dropdownItemDesc}>Overlay charging &amp; discharge cycles</div>
                  </div>
                </Link>
                <Link
                  href="/history?tab=export"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <FileText size={15} color="#B98CFF" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Export Data</div>
                    <div className={styles.dropdownItemDesc}>Download raw CSV, JSON &amp; audit reports</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 3. AI Insights (Dropdown) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${pathname === '/ai' ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('ai')}
              aria-expanded={activeDropdown === 'ai'}
            >
              <Bot size={16} />
              <span>AI Insights</span>
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'ai' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/ai"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Bot size={15} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Smart Analysis</div>
                    <div className={styles.dropdownItemDesc}>Gemini AI diagnostic safety evaluations</div>
                  </div>
                </Link>
                <Link
                  href="/ai?tab=predictions"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Sparkles size={15} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Predictions</div>
                    <div className={styles.dropdownItemDesc}>Remaining cycle life &amp; replacement dates</div>
                  </div>
                </Link>
                <Link
                  href="/ai?tab=recommendations"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <ShieldCheck size={15} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Recommendations</div>
                    <div className={styles.dropdownItemDesc}>Thermal mitigations &amp; charging rate advice</div>
                  </div>
                </Link>
                <Link
                  href="/ai?tab=training"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Layers size={15} color="#B98CFF" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Training Data</div>
                    <div className={styles.dropdownItemDesc}>Physics-informed ML degradation models</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 4. Alerts (Dropdown with Badge) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${pathname === '/alerts' ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('alerts')}
              aria-expanded={activeDropdown === 'alerts'}
            >
              <Bell size={16} />
              <span>Alerts</span>
              {unreadCount > 0 && (
                <span className={styles.navBadgeCount}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'alerts' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/alerts"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <AlertTriangle size={15} color="#FF2D55" />
                  <div style={{ flex: 1 }}>
                    <div className={styles.dropdownItemTitle}>
                      Active Alerts {unreadCount > 0 && `(${unreadCount})`}
                    </div>
                    <div className={styles.dropdownItemDesc}>Critical safety hazards &amp; sensor warnings</div>
                  </div>
                </Link>
                <Link
                  href="/alerts?tab=history"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Clock size={15} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Alert History</div>
                    <div className={styles.dropdownItemDesc}>Full historical log of acknowledged events</div>
                  </div>
                </Link>
                <Link
                  href="/settings?tab=alerts"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <SlidersHorizontal size={15} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Alert Settings</div>
                    <div className={styles.dropdownItemDesc}>Threshold boundaries for voltage &amp; temp</div>
                  </div>
                </Link>
                <Link
                  href="/settings?tab=notifications"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Bell size={15} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Notification Preferences</div>
                    <div className={styles.dropdownItemDesc}>Sound effects, desktop push &amp; quiet hours</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 5. System (Dropdown) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${pathname === '/settings' || pathname === '/controls' || pathname === '/diagnostics' ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('system')}
              aria-expanded={activeDropdown === 'system'}
            >
              <Settings size={16} />
              <span>System</span>
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'system' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/settings?tab=battery"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Sliders size={15} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Battery Configuration</div>
                    <div className={styles.dropdownItemDesc}>Set 9V, AA, 18650, or EV chemistry model</div>
                  </div>
                </Link>
                <Link
                  href="/controls"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <SlidersHorizontal size={15} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Controls &amp; Commands</div>
                    <div className={styles.dropdownItemDesc}>Manual relay breakers &amp; buzzer triggers</div>
                  </div>
                </Link>
                <Link
                  href="/diagnostics"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Cpu size={15} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Diagnostics</div>
                    <div className={styles.dropdownItemDesc}>Hardware health, RSSI &amp; memory telemetry</div>
                  </div>
                </Link>
                <Link
                  href="/settings?tab=calibration"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <RefreshCw size={15} color="#B98CFF" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Calibration</div>
                    <div className={styles.dropdownItemDesc}>Zero current shunts &amp; voltage dividers</div>
                  </div>
                </Link>
                <Link
                  href="/settings"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Settings size={15} color="var(--text-secondary)" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Settings</div>
                    <div className={styles.dropdownItemDesc}>Global system preferences &amp; backups</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 6. Help (Dropdown) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${pathname === '/about' ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('help')}
              aria-expanded={activeDropdown === 'help'}
            >
              <HelpCircle size={16} />
              <span>Help</span>
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'help' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/about"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <HelpCircle size={15} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>About Battery Vital</div>
                    <div className={styles.dropdownItemDesc}>Overview, supported batteries &amp; architecture</div>
                  </div>
                </Link>
                <button
                  className={styles.dropdownMenuItemBtn}
                  onClick={() => {
                    setActiveDropdown(null)
                    if (onOpenOnboarding) onOpenOnboarding()
                  }}
                >
                  <Sparkles size={15} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Quick Start Guide</div>
                    <div className={styles.dropdownItemDesc}>6-step interactive onboarding walkthrough</div>
                  </div>
                </button>
                <button
                  className={styles.dropdownMenuItemBtn}
                  onClick={() => {
                    setActiveDropdown(null)
                    if (onOpenManual) onOpenManual()
                  }}
                >
                  <BookOpen size={15} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>User Manual</div>
                    <div className={styles.dropdownItemDesc}>Operating guidelines &amp; safety limits</div>
                  </div>
                </button>
                <button
                  className={styles.dropdownMenuItemBtn}
                  onClick={() => {
                    setActiveDropdown(null)
                    if (onOpenWiring) onOpenWiring()
                  }}
                >
                  <Cpu size={15} color="#B98CFF" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Wiring Diagrams</div>
                    <div className={styles.dropdownItemDesc}>Pinouts for ESP32, INA219, DHT11 &amp; gas sensors</div>
                  </div>
                </button>
                <Link
                  href="/about#faq"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <HelpCircle size={15} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>FAQ</div>
                    <div className={styles.dropdownItemDesc}>Frequently asked battery monitoring questions</div>
                  </div>
                </Link>
                <a
                  href="mailto:support@batteryvital.com"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <ExternalLink size={15} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Contact Support</div>
                    <div className={styles.dropdownItemDesc}>Direct technical engineering assistance</div>
                  </div>
                </a>
                <button
                  className={styles.dropdownMenuItemBtn}
                  onClick={() => {
                    setActiveDropdown(null)
                    if (onOpenVersion) onOpenVersion()
                  }}
                >
                  <FileText size={15} color="var(--text-secondary)" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Version Info</div>
                    <div className={styles.dropdownItemDesc}>ESP32 Firmware v12.0 • Firebase streaming</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* 3. RIGHT SECTION: Battery Mini-Card + Status + Bell + Passport + Theme + User */}
        {/* ========================================================================= */}
        <div className={styles.headerRight}>
          {/* Battery Mini Status Card (Requirement #4 - live SOC + sparkline + mood) */}
          {(() => {
            const t = telemetryData || {}
            const b = t.battery || t
            const socMini = b.soc != null ? Number(b.soc) : null
            const voltMini = b.voltage
            const curMini = b.current != null ? Number(b.current) : null
            const charging = curMini != null && curMini > 0.05
            return (
              <button
                className={styles.headerBatteryCard}
                onClick={onOpenPassport}
                title="Open Battery Passport"
              >
                <span className={styles.headerBatteryIconBox}>
                  <AnimatedBatteryIcon soc={socMini} charging={charging} size={22} />
                </span>
                <span className={styles.headerBatteryInfo}>
                  <span className={styles.headerBatteryName}>
                    {devices[0].name} · {devices[0].id}
                  </span>
                  <span className={styles.headerBatteryMetrics}>
                    <span className={styles.headerVoltage}>
                      {voltMini != null ? `${Number(voltMini).toFixed(1)}V` : '--'}
                    </span>
                    <span className={styles.headerMetricSep}>•</span>
                    <span className={styles.headerSoc} style={{ color: socMini != null && socMini < 20 ? '#FF2D55' : '#00E8A0' }}>
                      {socMini != null ? `${Math.round(socMini)}%` : '--'}
                    </span>
                    <span className={styles.headerMetricSep}>•</span>
                    <MoodBadge
                      soc={socMini}
                      current={curMini}
                      temperature={b.temperature != null ? b.temperature : t.environment?.temperature ?? t.temperature}
                      safety={b.safety ?? t.safety}
                    />
                  </span>
                </span>
                <span className={styles.headerSparkline}>
                  <Sparkline data={socSpark} dataKey="soc" color="#00E8A0" height={22} />
                </span>
              </button>
            )
          })()}

          {/* Connection Status Badge (Requirement #2) */}
          <div className={styles.connectionBlock}>
            {renderConnectionBadge()}
            <div className={styles.clockText}>
              {clockText}
              {runtimeText ? ` · ${runtimeText}` : ''}
            </div>
            <div className={styles.lastUpdateLabel}>{lastUpdateText}</div>
          </div>

          {/* Notification Bell with Center Dropdown */}
          <div className={styles.notifWrapper}>
            <Tooltip text="Notifications &amp; live alerts" shortcut="N to mark read">
              <button
                className={`${styles.iconActionBtn} ${activeDropdown === 'notif' ? styles.iconActionBtnActive : ''}`}
                onClick={() => toggleDropdown('notif')}
                aria-label={`Notifications (${unreadCount} unread)`}
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className={styles.notifCountBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            </Tooltip>

            {activeDropdown === 'notif' && (
              <NotificationCenter onClose={() => setActiveDropdown(null)} />
            )}
          </div>

          {/* Dark / Light Theme Toggle */}
          <Tooltip text={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <button
              className={`${styles.themeToggle} ${isDark ? styles.themeToggleDark : styles.themeToggleLight}`}
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              role="switch"
              aria-checked={!isDark}
            >
              <span className={styles.themeKnob}>
                {isDark ? (
                  <Moon size={13} color="#38BDF8" />
                ) : (
                  <Sun size={13} color="#D97706" />
                )}
              </span>
            </button>
          </Tooltip>

          {/* Battery Passport Slide-out Button (Requirement #3, #7) */}
          <Tooltip text="View Battery Passport &amp; verified digital twin">
            <button
              className={styles.iconActionBtn}
              onClick={onOpenPassport}
              aria-label="Open Battery Passport Slideout"
            >
              <ShieldCheck size={18} color="#00E8A0" />
            </button>
          </Tooltip>

          {/* User Account Avatar & Device Switcher Dropdown (Requirement #3, #8) */}
          <div className={styles.userDropdownWrapper}>
            <button
              className={styles.userAvatarBtn}
              onClick={() => toggleDropdown('user')}
              aria-label="User Account and Devices"
              aria-expanded={activeDropdown === 'user'}
            >
              <div className={styles.avatarCircle}>
                <User size={15} />
              </div>
              <ChevronDown size={12} className={styles.avatarChevron} />
            </button>

            {activeDropdown === 'user' && (
              <div className={styles.userDropdownMenu}>
                <div className={styles.userProfileHead}>
                  <div className={styles.userProfileName}>Station Admin</div>
                  <div className={styles.userProfileEmail}>admin@batteryvital.local</div>
                </div>

                <div className={styles.userDropdownDivider} />
                <div className={styles.dropdownSubheader}>My Monitored Devices</div>

                {devices.map((d) => (
                  <button
                    key={d.id}
                    className={`${styles.deviceItemBtn} ${d.active ? styles.deviceItemActive : ''}`}
                    onClick={() => {
                      setActiveDropdown(null)
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Radio size={12} color={d.active ? '#00E8A0' : 'var(--text-tertiary)'} />
                      <div style={{ textAlign: 'left' }}>
                        <div className={styles.deviceName}>{d.name}</div>
                        <div className={styles.deviceMeta}>{d.id} • {d.voltage} ({d.soc != null ? `${d.soc}%` : '--'})</div>
                      </div>
                    </div>
                    {d.active && <Check size={14} color="#00E8A0" />}
                  </button>
                ))}

                <button
                  className={styles.addDeviceBtn}
                  onClick={() => {
                    setActiveDropdown(null)
                    router.push('/settings?tab=battery')
                  }}
                >
                  <PlusCircle size={14} />
                  <span>Add New Battery Pack...</span>
                </button>

                <div className={styles.userDropdownDivider} />
                <Link
                  href="/settings"
                  className={styles.userMenuLink}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Settings size={14} />
                  <span>Preferences</span>
                </Link>
                <button
                  className={styles.userMenuLink}
                  onClick={() => {
                    setActiveDropdown(null)
                    if (confirm('Switch console profile?')) {
                      window.location.reload()
                    }
                  }}
                >
                  <LogOut size={14} />
                  <span>Switch Profile</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MOBILE SLIDE-OUT DRAWER (<768px)                                      */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className={styles.mobileDrawerOverlay} onClick={() => setMobileMenuOpen(false)}>
          <div className={styles.mobileDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileDrawerHead}>
              <div className={styles.brandGroup}>
                <BatteryCharging size={20} color="var(--accent-primary)" />
                <span className={styles.brandTitleText}>
                  Battery <span className={styles.brandVitalText}>Vitals</span>
                </span>
              </div>
              <button
                className={styles.mobileDrawerCloseBtn}
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Categorized Nav Sections */}
            <div className={styles.mobileDrawerContent}>
              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>Monitoring</div>
                <Link href="/" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Home size={16} /> <span>Dashboard</span>
                </Link>
                <Link href="/analytics" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Activity size={16} /> <span>Live Graphs</span>
                </Link>
                <Link href="/history?tab=trends" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <TrendingUp size={16} /> <span>Historical Trends</span>
                </Link>
                <Link href="/history?tab=compare" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <GitCompare size={16} /> <span>Compare Sessions</span>
                </Link>
              </div>

              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>Analysis &amp; Safety</div>
                <Link href="/ai" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Bot size={16} /> <span>AI Insights</span>
                </Link>
                <Link href="/alerts" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Bell size={16} /> <span>Active Alerts</span>
                  {unreadCount > 0 && <span className={styles.badgeCount}>{unreadCount}</span>}
                </Link>
                <button
                  className={styles.mobileNavLinkBtn}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    if (onOpenPassport) onOpenPassport()
                  }}
                >
                  <ShieldCheck size={16} /> <span>Battery Passport</span>
                </button>
              </div>

              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>System &amp; Controls</div>
                <Link href="/settings?tab=battery" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Sliders size={16} /> <span>Battery Configuration</span>
                </Link>
                <Link href="/controls" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <SlidersHorizontal size={16} /> <span>Controls &amp; Relays</span>
                </Link>
                <Link href="/diagnostics" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Cpu size={16} /> <span>Diagnostics</span>
                </Link>
                <Link href="/settings" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Settings size={16} /> <span>System Settings</span>
                </Link>
              </div>

              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>Help &amp; Documentation</div>
                <Link href="/about" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <HelpCircle size={16} /> <span>About Battery Vital</span>
                </Link>
                <button
                  className={styles.mobileNavLinkBtn}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    if (onOpenOnboarding) onOpenOnboarding()
                  }}
                >
                  <Sparkles size={16} /> <span>Quick Start Guide</span>
                </button>
                <button
                  className={styles.mobileNavLinkBtn}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    if (onOpenManual) onOpenManual()
                  }}
                >
                  <BookOpen size={16} /> <span>User Manual</span>
                </button>
                <button
                  className={styles.mobileNavLinkBtn}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    if (onOpenWiring) onOpenWiring()
                  }}
                >
                  <Cpu size={16} /> <span>Wiring Diagrams</span>
                </button>
              </div>
            </div>

            {/* Mobile Footer */}
            <div className={styles.mobileDrawerFooter}>
              <button className={styles.mobileThemeToggleBtn} onClick={toggleTheme}>
                {isDark ? <Sun size={16} color="#FFB800" /> : <Moon size={16} color="#38BDF8" />}
                <span>{isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
