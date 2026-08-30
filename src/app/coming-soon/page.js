'use client'

import { useState } from 'react'
import Layout from '../../components/Layout'
import {
  Lock,
  MapPin,
  Bluetooth,
  Layers,
  TrendingUp,
  Cpu,
  Eye,
  Volume2,
  Zap,
  Sparkles,
  Check,
  Bell,
  HardDrive,
  Radio,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

const ROADMAP_FEATURES = [
  {
    id: 'gps',
    title: '1. GPS Fleet & Remote Asset Tracking',
    icon: MapPin,
    color: '#38BDF8',
    hardware: 'u-blox NEO-6M / NEO-8M GNSS Module',
    shows: 'Precise real-time battery pack geofencing, transit history, and speed tracking on interactive map.',
    useCase: 'Commercial fleet EVs, marine battery banks, golf carts, and off-grid remote telecom sites.',
    availability: 'Q3 2026',
    status: 'Prototype Testing',
  },
  {
    id: 'ble',
    title: '2. Bluetooth Proximity & Anti-Theft Beacon',
    icon: Bluetooth,
    color: '#00E8A0',
    hardware: 'ESP32 Internal BLE / iBeacon Subsystem',
    shows: 'Instant perimeter breach notifications when battery pack is disconnected or moved outside beacon range.',
    useCase: 'Anti-theft prevention, warehouse inventory tracking, and localized technician pairing.',
    availability: 'Q3 2026',
    status: 'Firmware Dev',
  },
  {
    id: 'multi',
    title: '3. Multi-Battery Bank Parallel Telemetry',
    icon: Layers,
    color: '#FFD60A',
    hardware: 'TCA9548A I2C Multiplexer + Multiple INA219 Shunts',
    shows: 'Synchronous cross-pack voltage divergence, current balancing, and weakest-cell identification.',
    useCase: 'Commercial solar energy storage systems (ESS), RV dual-bank systems, and datacenter UPS.',
    availability: 'Q4 2026',
    status: 'Hardware Design',
  },
  {
    id: 'forecast',
    title: '4. AI Dynamic Load & Runtime Forecasting',
    icon: TrendingUp,
    color: '#A78BFA',
    hardware: 'Edge Neural Coprocessor / Server ML Pipeline',
    shows: 'Minute-by-minute projected discharge curve and exact minutes of remaining operational backup.',
    useCase: 'Critical medical UPS runtime, emergency power units, and solar overnight reserve sizing.',
    availability: 'Q4 2026',
    status: 'Algorithm Training',
  },
  {
    id: 'cell_balance',
    title: '5. Cell-Level Voltage Balancing & Monitoring',
    icon: Cpu,
    color: '#F472B6',
    hardware: 'BQ76930 / LTC6804 Cell Monitor ASIC',
    shows: 'Millivolt-accurate individual cell delta, passive/active balancing state, and cell IR deviation.',
    useCase: '4S-16S custom LiFePO4 packs, drone battery analysis, and high-power EV conversions.',
    availability: 'Q1 2027',
    status: 'Component Sourcing',
  },
  {
    id: 'thermal',
    title: '6. MLX90640 Thermal Hotspot Imaging',
    icon: Eye,
    color: '#FF2D55',
    hardware: 'Melexis MLX90640 32x24 Far-Infrared Thermal Camera',
    shows: 'Full 768-pixel thermal heat map overlaid on battery pack to pinpoint runaway dendrites and bad crimps.',
    useCase: 'Early thermal runaway prevention, busbar contact resistance audits, and fire safety certification.',
    availability: 'Q1 2027',
    status: 'R&D Phase',
  },
  {
    id: 'acoustic',
    title: '7. Acoustic Emission & Arc Fault Monitoring',
    icon: Volume2,
    color: '#FF6B35',
    hardware: 'MEMS Piezo Ultra-High Frequency Acoustic Sensor',
    shows: 'Micro-acoustic crackle detection indicative of electrolyte venting, micro-arcing, and internal shorting.',
    useCase: 'Pre-smoke catastrophic failure alerts up to 48 hours before thermal manifestation.',
    availability: 'Q2 2027',
    status: 'Concept Phase',
  },
  {
    id: 'wireless',
    title: '8. Wireless Qi & Inductive Charging Analytics',
    icon: Zap,
    color: '#00E8A0',
    hardware: 'Qi Inductive Coupling Current Sense Resistor',
    shows: 'Wireless power transfer efficiency, coil misalignment detection, and inductive thermal dissipation.',
    useCase: 'Automated Guided Vehicles (AGVs), warehouse robotics, and contactless consumer devices.',
    availability: 'Q2 2027',
    status: 'Roadmap',
  },
]

export default function ComingSoonPage() {
  const [email, setEmail] = useState('')
  const [submittedFor, setSubmittedFor] = useState(null)

  const handleNotifyMe = (featureId) => {
    const userEmail = prompt('Enter your email to receive early access hardware notifications:')
    if (userEmail && userEmail.includes('@')) {
      setSubmittedFor(featureId)
      setTimeout(() => setSubmittedFor(null), 4000)
    }
  }

  return (
    <Layout connected={true}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            <Sparkles size={22} style={{ verticalAlign: 'middle', marginRight: 8 }} color="#A78BFA" />
            Tier 2 Hardware <span className="gradText">Expansion Roadmap</span>
          </h1>
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>
            Next-generation sensor integrations currently in lab prototype testing and validation.
          </p>
        </div>

        <div className="chip" style={{ color: '#A78BFA', borderColor: 'rgba(167, 139, 250, 0.4)' }}>
          <Lock size={12} /> Hardware Upgrade Required
        </div>
      </div>

      {submittedFor && (
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(0, 232, 160, 0.1)',
            border: '1px solid rgba(0, 232, 160, 0.3)',
            borderRadius: 10,
            color: '#00E8A0',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
          }}
        >
          <Check size={16} /> Notification registered! You will be notified when hardware shields ship.
        </div>
      )}

      {/* Feature Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {ROADMAP_FEATURES.map((feat) => {
          const Icon = feat.icon
          return (
            <div
              key={feat.id}
              style={{
                position: 'relative',
                background: 'var(--card-bg-safe, var(--bg-surface))',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '20px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14,
                boxShadow: 'var(--shadow)',
                overflow: 'hidden',
              }}
            >
              {/* Top Bar with Icon & Lock */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      display: 'grid',
                      placeItems: 'center',
                      background: `${feat.color}18`,
                      border: `1px solid ${feat.color}35`,
                    }}
                  >
                    <Icon size={22} color={feat.color} />
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <span
                      className="chip"
                      style={{
                        background: 'var(--bg-surface-raised)',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Lock size={10} /> Locked
                    </span>
                    <span
                      className="chip"
                      style={{
                        borderColor: `${feat.color}44`,
                        color: feat.color,
                        background: `${feat.color}12`,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {feat.status}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {feat.title}
                </h3>

                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
                  {feat.shows}
                </p>

                <div
                  style={{
                    padding: '8px 10px',
                    background: 'var(--bg-surface-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ color: 'var(--text-primary)' }}>Hardware:</strong> {feat.hardware}
                  <br />
                  <strong style={{ color: 'var(--text-primary)' }}>Use Case:</strong> {feat.useCase}
                </div>
              </div>

              {/* Bottom Footer: Availability & Notify Button */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Est. Availability: <strong style={{ color: 'var(--text-primary)' }}>{feat.availability}</strong>
                </span>

                <button
                  onClick={() => handleNotifyMe(feat.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    background: 'rgba(167, 139, 250, 0.12)',
                    color: '#d8c7ff',
                    transition: 'all 0.2s',
                  }}
                >
                  <Bell size={12} />
                  <span>Notify Me</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
