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
  Wind,
  Users,
  Flame,
  Zap,
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

  // State management for dropdowns
  const [activeDropdown, setActiveDropdown] = useState(null) // 'monitoring' | 'analytics' | 'safety' | 'system' | 'notif' | 'user'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [clockText, setClockText] = useState('')
  const [runtimeText, setRuntimeText] = useState('')
  const [lastUpdateText, setLastUpdateText] = useState('Just now')

  const headerRef = useRef(null)

  // Derived telemetry info
  const battery = useMemo(() => {
    const t = telemetryData || {}
    const b = t.battery || t
    return {
      id: t.batteryId || 'BAT001',
      voltage: b.voltage != null ? Number(b.voltage) : 12.6,
      current: b.current != null ? Number(b.current) : 0,
      soc: b.soc != null ? Math.round(Number(b.soc)) : 85,
      temperature: b.temperature != null ? b.temperature : t.environmental?.temperature ?? 25.0,
      safety: b.safety || t.safety || 'SAFE',
    }
  }, [telemetryData])

  // Rolling SOC buffer for sparkline
  const socBuffRef = useRef([])
  const [socSpark, setSocSpark] = useState([])
  useEffect(() => {
    if (battery.soc == null) return
    const last = socBuffRef.current[socBuffRef.current.length - 1]?.soc
    if (last === battery.soc) return
    socBuffRef.current.push({ soc: battery.soc })
    if (socBuffRef.current.length > 24) socBuffRef.current.shift()
    setSocSpark(socBuffRef.current.slice())
  }, [battery.soc])

  // Connection badge state
  const [connInfo, setConnInfo] = useState(() => getConnectionState(lastSeen))

  useEffect(() => {
    const updateConn = () => {
      const info = getConnectionState(lastSeen)
      setConnInfo(info)

      if (info.ageSec == null) {
        setLastUpdateText('Connecting...')
      } else if (info.ageSec < 5) {
        setLastUpdateText('Live')
      } else if (info.ageSec < 60) {
        setLastUpdateText(`${info.ageSec}s ago`)
      } else {
        const mins = Math.floor(info.ageSec / 60)
        setLastUpdateText(`${mins}m ago`)
      }

      setClockText(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )

      if (Math.abs(battery.current) > 0.05) {
        const capacity = 2.6
        const hours =
          battery.current > 0
            ? ((100 - battery.soc) / 100) * capacity / battery.current
            : (battery.soc / 100) * capacity / Math.abs(battery.current)
        if (isFinite(hours) && hours > 0) {
          const h = Math.floor(hours)
          const m = Math.floor((hours - h) * 60)
          setRuntimeText(`${battery.current > 0 ? 'Full in' : 'Empty in'} ${h}h ${m}m`)
        } else {
          setRuntimeText('')
        }
      } else {
        setRuntimeText('')
      }
    }

    updateConn()
    const timer = setInterval(updateConn, 1000)
    return () => clearInterval(timer)
  }, [lastSeen, battery])

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

  const isMonitoringActive = pathname === '/battery' || pathname === '/environmental' || pathname === '/passport'
  const isAnalyticsActive = pathname === '/analytics' || pathname === '/history'
  const isSafetyActive = pathname === '/ai' || pathname === '/alerts' || pathname === '/controls' || pathname === '/diagnostics'
  const isSystemActive = pathname === '/settings' || pathname === '/users' || pathname === '/about'

  return (
    <header className={styles.headerShell} ref={headerRef}>
      <div className={styles.headerContainer}>
        {/* ========================================================================= */}
        {/* 1. LEFT SECTION: Brand Logo & Title                                      */}
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

          {/* Brand Logo */}
          <Link href="/" className={styles.brandGroup} title="Battery Vital Home">
            <div className={styles.brandLogoIcon}>
              <BatteryCharging size={20} color="var(--accent-primary)" />
            </div>
            <div className={styles.brandTextGroup}>
              <div className={styles.brandTitleText}>
                Battery <span className={styles.brandVitalText}>Vital</span>
              </div>
            </div>
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* 2. CENTER SECTION: Consolidated 5 Category Navigation                     */}
        {/* ========================================================================= */}
        <nav className={styles.headerNav} aria-label="Main Navigation">
          {/* 1. Dashboard (Direct Link) */}
          <Link
            href="/"
            className={`${styles.navItemBtn} ${pathname === '/' ? styles.navItemActive : ''}`}
          >
            <Home size={15} />
            <span>Dashboard</span>
          </Link>

          {/* 2. Monitoring (Dropdown) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${isMonitoringActive ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('monitoring')}
              aria-expanded={activeDropdown === 'monitoring'}
            >
              <BatteryCharging size={15} />
              <span>Monitoring</span>
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'monitoring' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/battery"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Zap size={16} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Battery Monitor</div>
                    <div className={styles.dropdownItemDesc}>INA219 voltage, current, power &amp; SOC</div>
                  </div>
                </Link>
                <Link
                  href="/environmental"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Wind size={16} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Environmental Station</div>
                    <div className={styles.dropdownItemDesc}>DHT11 temp/humidity, MQ-2 gas &amp; AQI</div>
                  </div>
                </Link>
                <Link
                  href="/analytics"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Activity size={16} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Live Graphs</div>
                    <div className={styles.dropdownItemDesc}>Real-time streaming multi-sensor curves</div>
                  </div>
                </Link>
                <Link
                  href="/passport"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <ShieldCheck size={16} color="#BF5AF2" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Battery Passport</div>
                    <div className={styles.dropdownItemDesc}>Digital twin identity, SOH &amp; warranty</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 3. Analytics & History (Dropdown) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${isAnalyticsActive ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('analytics')}
              aria-expanded={activeDropdown === 'analytics'}
            >
              <Activity size={15} />
              <span>Analytics</span>
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'analytics' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/history?tab=trends"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <TrendingUp size={16} color="#38BDF8" />
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
                  <GitCompare size={16} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Compare Sessions</div>
                    <div className={styles.dropdownItemDesc}>Charge vs. discharge cycle overlay</div>
                  </div>
                </Link>
                <Link
                  href="/history?tab=export"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <FileText size={16} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Export Data Center</div>
                    <div className={styles.dropdownItemDesc}>Download raw CSV, JSON &amp; PDF reports</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 4. Safety & AI (Dropdown with Badge) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${isSafetyActive ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('safety')}
              aria-expanded={activeDropdown === 'safety'}
            >
              <Bot size={15} />
              <span>Safety &amp; AI</span>
              {unreadCount > 0 && (
                <span className={styles.navBadgeCount}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'safety' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/ai"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Bot size={16} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>AI Safety Intelligence</div>
                    <div className={styles.dropdownItemDesc}>Gemini hazard evaluation &amp; predictions</div>
                  </div>
                </Link>
                <Link
                  href="/alerts"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <AlertTriangle size={16} color="#FF2D55" />
                  <div style={{ flex: 1 }}>
                    <div className={styles.dropdownItemTitle}>
                      Active Alerts {unreadCount > 0 && `(${unreadCount})`}
                    </div>
                    <div className={styles.dropdownItemDesc}>Critical threshold alarms &amp; violation feed</div>
                  </div>
                </Link>
                <Link
                  href="/controls"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <SlidersHorizontal size={16} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Actuator Controls</div>
                    <div className={styles.dropdownItemDesc}>Manual LED toggles &amp; buzzer alarm modes</div>
                  </div>
                </Link>
                <Link
                  href="/diagnostics"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Cpu size={16} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Hardware Diagnostics</div>
                    <div className={styles.dropdownItemDesc}>ESP32 RSSI, heap memory &amp; I2C bus status</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 5. System (Dropdown) */}
          <div className={styles.navDropdownWrapper}>
            <button
              className={`${styles.navItemBtn} ${isSystemActive ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown('system')}
              aria-expanded={activeDropdown === 'system'}
            >
              <Settings size={15} />
              <span>System</span>
              <ChevronDown size={13} className={styles.navChevron} />
            </button>

            {activeDropdown === 'system' && (
              <div className={styles.navDropdownMenu}>
                <Link
                  href="/settings"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Sliders size={16} color="#00E8A0" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Settings &amp; Thresholds</div>
                    <div className={styles.dropdownItemDesc}>Battery chemistry &amp; alarm limits</div>
                  </div>
                </Link>
                <Link
                  href="/users"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Users size={16} color="#38BDF8" />
                  <div>
                    <div className={styles.dropdownItemTitle}>Users &amp; Roles</div>
                    <div className={styles.dropdownItemDesc}>RBAC permissions &amp; team access</div>
                  </div>
                </Link>
                <Link
                  href="/about"
                  className={styles.dropdownMenuItem}
                  onClick={() => setActiveDropdown(null)}
                >
                  <HelpCircle size={16} color="#FFB800" />
                  <div>
                    <div className={styles.dropdownItemTitle}>User Manual &amp; Docs</div>
                    <div className={styles.dropdownItemDesc}>Wiring diagrams, pinouts &amp; guides</div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* ========================================================================= */}
        {/* 3. RIGHT SECTION: Compact Status + Bell + Theme + User Profile            */}
        {/* ========================================================================= */}
        <div className={styles.headerRight}>
          {/* Compact Battery Vitals Pill */}
          <button
            className={styles.headerBatteryCard}
            onClick={onOpenPassport}
            title="Open Battery Passport"
          >
            <span className={styles.headerBatteryIconBox}>
              <AnimatedBatteryIcon soc={battery.soc} charging={battery.current > 0.05} size={20} />
            </span>
            <span className={styles.headerBatteryInfo}>
              <span className={styles.headerBatteryName}>
                {battery.id}
              </span>
              <span className={styles.headerBatteryMetrics}>
                <span className={styles.headerVoltage}>{battery.voltage.toFixed(1)}V</span>
                <span className={styles.headerMetricSep}>•</span>
                <span
                  className={styles.headerSoc}
                  style={{ color: battery.soc < 20 ? '#FF2D55' : '#00E8A0' }}
                >
                  {battery.soc}%
                </span>
              </span>
            </span>
            <span className={styles.headerSparkline}>
              <Sparkline data={socSpark} dataKey="soc" color="#00E8A0" height={18} />
            </span>
          </button>

          {/* Connection Status Badge */}
          <div className={styles.connectionBlock}>
            <div
              className={`${styles.connBadge} ${
                !connected || connInfo.state === 'OFFLINE'
                  ? styles.connBadge_offline
                  : connInfo.state === 'SLOW'
                  ? styles.connBadge_slow
                  : connInfo.state === 'NO_DATA'
                  ? styles.connBadge_connecting
                  : styles.connBadge_live
              }`}
              title={connected ? `Live via Firebase RTDB (${lastUpdateText})` : 'Offline'}
            >
              <span className={styles.livePulseDot}>
                <Check size={9} strokeWidth={3} />
              </span>
              <span className={styles.connBadgeText}>
                {connInfo.state === 'OFFLINE' ? 'OFFLINE' : 'LIVE'}
              </span>
            </div>
            <div className={styles.clockText}>{clockText}</div>
          </div>

          {/* Notification Bell */}
          <div className={styles.notifWrapper}>
            <Tooltip text="Notifications &amp; live alerts">
              <button
                className={`${styles.iconActionBtn} ${activeDropdown === 'notif' ? styles.iconActionBtnActive : ''}`}
                onClick={() => toggleDropdown('notif')}
                aria-label={`Notifications (${unreadCount} unread)`}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className={styles.notifCountBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </button>
            </Tooltip>

            {activeDropdown === 'notif' && (
              <NotificationCenter onClose={() => setActiveDropdown(null)} />
            )}
          </div>

          {/* Dark / Light Theme Switcher */}
          <Tooltip text={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <button
              className={`${styles.themeToggle} ${isDark ? styles.themeToggleDark : styles.themeToggleLight}`}
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              role="switch"
              aria-checked={!isDark}
            >
              <span className={styles.themeKnob}>
                {isDark ? <Moon size={12} color="#38BDF8" /> : <Sun size={12} color="#D97706" />}
              </span>
            </button>
          </Tooltip>

          {/* User Account Avatar Dropdown */}
          <div className={styles.userDropdownWrapper}>
            <button
              className={styles.userAvatarBtn}
              onClick={() => toggleDropdown('user')}
              aria-label="User Account"
              aria-expanded={activeDropdown === 'user'}
            >
              <div className={styles.avatarCircle}>
                <User size={14} />
              </div>
              <ChevronDown size={11} className={styles.avatarChevron} />
            </button>

            {activeDropdown === 'user' && (
              <div className={styles.userDropdownMenu}>
                <div className={styles.userProfileHead}>
                  <div className={styles.userProfileName}>Lead Engineer</div>
                  <div className={styles.userProfileEmail}>admin@batteryvital.local</div>
                </div>

                <div className={styles.userDropdownDivider} />

                <Link
                  href="/users"
                  className={styles.userMenuLink}
                  onClick={() => setActiveDropdown(null)}
                >
                  <Users size={14} />
                  <span>Team &amp; Roles</span>
                </Link>

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
                    if (onOpenPassport) onOpenPassport()
                  }}
                >
                  <ShieldCheck size={14} />
                  <span>Battery Passport</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MOBILE SLIDE-OUT DRAWER (<980px)                                      */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div className={styles.mobileDrawerOverlay} onClick={() => setMobileMenuOpen(false)}>
          <div className={styles.mobileDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileDrawerHead}>
              <div className={styles.brandGroup}>
                <div className={styles.brandLogoIcon}>
                  <BatteryCharging size={18} color="var(--accent-primary)" />
                </div>
                <span className={styles.brandTitleText}>
                  Battery <span className={styles.brandVitalText}>Vital</span>
                </span>
              </div>
              <button
                className={styles.mobileDrawerCloseBtn}
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.mobileDrawerContent}>
              {/* Monitoring Section */}
              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>Monitoring Stations</div>
                <Link href="/" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Home size={16} /> <span>Mission Dashboard</span>
                </Link>
                <Link href="/battery" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Zap size={16} color="#00E8A0" /> <span>Battery Monitor</span>
                </Link>
                <Link href="/environmental" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Wind size={16} color="#38BDF8" /> <span>Environmental Station</span>
                </Link>
                <Link href="/analytics" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Activity size={16} color="#FFB800" /> <span>Live Telemetry Graphs</span>
                </Link>
              </div>

              {/* Safety & AI Section */}
              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>Safety &amp; AI Intelligence</div>
                <Link href="/ai" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Bot size={16} color="#00E8A0" /> <span>AI Diagnostics &amp; Predictions</span>
                </Link>
                <Link href="/alerts" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <AlertTriangle size={16} color="#FF2D55" /> <span>Active Alerts</span>
                  {unreadCount > 0 && <span className={styles.badgeCount}>{unreadCount}</span>}
                </Link>
                <Link href="/controls" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <SlidersHorizontal size={16} color="#38BDF8" /> <span>Actuator Controls</span>
                </Link>
                <Link href="/diagnostics" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Cpu size={16} color="#FFB800" /> <span>Hardware Diagnostics</span>
                </Link>
              </div>

              {/* Analytics & History */}
              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>Analytics &amp; Data</div>
                <Link href="/history?tab=trends" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <TrendingUp size={16} /> <span>Historical Trends</span>
                </Link>
                <Link href="/history?tab=export" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <FileText size={16} /> <span>Export Data Center</span>
                </Link>
                <Link href="/passport" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <ShieldCheck size={16} /> <span>Battery Passport</span>
                </Link>
              </div>

              {/* System & Support */}
              <div className={styles.mobileSectionGroup}>
                <div className={styles.mobileSectionHeader}>Administration &amp; Help</div>
                <Link href="/users" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Users size={16} /> <span>Users &amp; Roles (RBAC)</span>
                </Link>
                <Link href="/settings" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <Settings size={16} /> <span>Settings &amp; Limits</span>
                </Link>
                <Link href="/about" className={styles.mobileNavLink} onClick={() => setMobileMenuOpen(false)}>
                  <HelpCircle size={16} /> <span>About &amp; Documentation</span>
                </Link>
              </div>
            </div>

            {/* Mobile Drawer Footer */}
            <div className={styles.mobileDrawerFooter}>
              <button className={styles.mobileThemeToggleBtn} onClick={toggleTheme}>
                {isDark ? <Sun size={15} color="#FFB800" /> : <Moon size={15} color="#38BDF8" />}
                <span>{isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
