'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import {
  Zap,
  Bot,
  Activity,
  Bell,
  Smartphone,
  Sliders,
  Globe,
  ShieldCheck,
  Cpu,
  Database,
  ArrowRight,
  CheckCircle2,
  Github,
  Mail,
  FileCode,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Award,
  Radio,
  ExternalLink,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

const KEY_FEATURES = [
  {
    icon: Zap,
    color: '#00E8A0',
    title: 'Real-Time Monitoring',
    desc: 'High-frequency streaming of terminal voltage, bidirectional current flow, internal resistance, and State of Charge (SOC).',
  },
  {
    icon: Bot,
    color: '#38BDF8',
    title: 'AI-Powered Safety & Health',
    desc: 'Deep integration with Google Gemini AI to analyze chemical degradation, evaluate thermal runaway hazards, and predict remaining cycle life.',
  },
  {
    icon: Activity,
    color: '#FFB800',
    title: 'Historical Data Logging',
    desc: 'Comprehensive multi-day telemetry logs, charge/discharge session timelines, and instant CSV/JSON exports for fleet records.',
  },
  {
    icon: Bell,
    color: '#FF2D55',
    title: 'Instant Multi-Tier Alerts',
    desc: 'Configurable audible synthesizers, browser push notifications, and automated emergency hardware relay shutdowns on fault conditions.',
  },
  {
    icon: Smartphone,
    color: '#B98CFF',
    title: 'Any Device Accessibility',
    desc: 'Responsive web application optimized for desktop mission consoles, workshop tablets, and on-site smartphone inspection.',
  },
  {
    icon: Sliders,
    color: '#00E8A0',
    title: 'Easy Calibration & Tuning',
    desc: 'One-click INA219 current shunt zero-offset calibration, ADC voltage divider ratio adjustments, and custom threshold modeling.',
  },
  {
    icon: Globe,
    color: '#38BDF8',
    title: '20+ Battery Chemistries',
    desc: 'Pre-configured profiles for Alkaline, Li-Ion, LiFePO4, NiMH, Sealed Lead-Acid (SLA), and multi-cell high-voltage energy storage systems.',
  },
  {
    icon: ShieldCheck,
    color: '#FFB800',
    title: 'Battery Passport & Twin',
    desc: 'Cryptographically hashed digital asset passports tracking install dates, serial numbers, total energy throughput, and audit provenance.',
  },
]

const SUPPORTED_BATTERIES = [
  {
    type: '9V Transistor / Smoke Alarms',
    chemistries: 'Alkaline (6LR61), NiMH, Li-MnO2 (Ultralife)',
    voltage: '6.0V - 9.6V',
    badge: 'Popular',
  },
  {
    type: 'AA, AAA, C, D Cylindrical Cells',
    chemistries: 'Alkaline, Carbon Zinc, NiMH, NiCd, 1.5V Li-Ion',
    voltage: '0.9V - 1.6V / Cell',
    badge: 'Universal',
  },
  {
    type: '18650, 21700, 26650 Cells',
    chemistries: 'NMC, NCA, LiCoO2 (1S to 4S Packs)',
    voltage: '3.0V - 16.8V',
    badge: 'Power Cells',
  },
  {
    type: 'CR123A & Specialty Camera',
    chemistries: 'Lithium Primary (Li-MnO2, Li-SOCl2)',
    voltage: '2.0V - 3.2V',
    badge: 'Specialty',
  },
  {
    type: '6V Lantern & Industrial Standby',
    chemistries: 'Heavy Duty Zinc Chloride, Lead-Acid',
    voltage: '4.8V - 6.6V',
    badge: 'Industrial',
  },
  {
    type: '12V SLA & 12V LiFePO4',
    chemistries: 'AGM, Deep-Cycle Gel, Lithium Iron Phosphate',
    voltage: '10.5V - 14.6V',
    badge: 'Solar / Marine',
  },
  {
    type: '24V Solar & Forklift Banks',
    chemistries: 'Flooded Lead-Acid, 8S LiFePO4',
    voltage: '21.0V - 29.2V',
    badge: 'Off-Grid',
  },
  {
    type: '48V & 72V Light EV / LEV',
    chemistries: '13S-16S LiFePO4, 14S-20S Li-Ion (Divider Required)',
    voltage: '42.0V - 84.0V',
    badge: 'EV & Mobility',
  },
]

const FAQS = [
  {
    q: 'Can Battery Vital replace my dedicated Hardware BMS?',
    a: 'No. Battery Vital is an intelligent supervisory telemetry, safety monitoring, and diagnostic system. It works in conjunction with a certified primary hardware BMS (which handles instantaneous short-circuit disconnections). Battery Vital adds predictive AI analytics, off-site cloud visibility, and environmental hazard tracking.',
  },
  {
    q: 'How does Battery Vital communicate with the cloud?',
    a: 'The edge ESP32 micro-controller reads hardware sensor buses (I2C for INA219, 1-Wire for DHT11, and ADC for MQ gas sensors) and transmits sanitized telemetry payloads directly to Firebase Realtime Database over secure Wi-Fi every 1 to 2 seconds.',
  },
  {
    q: 'How accurate is the State of Charge (SOC) estimation?',
    a: 'SOC is derived using a combined Coulomb Counting (current integration over time) and Open-Circuit Voltage (OCV) curve fitting algorithm adjusted for the selected battery chemistry profile and temperature coefficients.',
  },
  {
    q: 'Is the hardware open-source?',
    a: 'Yes! The ESP32 firmware and wiring schematics are open-source under the MIT license, allowing anyone to build their own sensor hub with readily available components.',
  },
]

export default function AboutPage() {
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <Layout connected={true} mode="firebase">
      <div className={styles.aboutContainer}>
        {/* ========================================================================= */}
        {/* 1. HERO SECTION                                                           */}
        {/* ========================================================================= */}
        <div className={styles.aboutHero}>
          <span className={styles.aboutBadge}>
            <Sparkles size={13} color="#00E8A0" /> NEXT-GEN BATTERY TELEMETRY
          </span>
          <h1 className={styles.aboutHeroTitle}>
            About <span className="gradText">Battery Vital</span>
          </h1>
          <p className={styles.aboutHeroSubtitle}>
            Professional Battery Monitoring for Everyone — From Household 9V Cells to Industrial EV Packs
          </p>

          {/* Interactive Hero Schematic Mockup */}
          <div className={styles.aboutHeroCard}>
            <div className={styles.aboutHeroCardInner}>
              <div className={styles.aboutHeroSensorItem}>
                <div className={styles.aboutHeroIconBox}>
                  <Cpu size={24} color="#00E8A0" />
                </div>
                <div>
                  <div className={styles.aboutHeroSensorTitle}>ESP32 Edge Hub</div>
                  <div className={styles.aboutHeroSensorMeta}>Dual-Core 240MHz • Wi-Fi Telemetry Stream</div>
                </div>
              </div>

              <div className={styles.aboutHeroFlowArrow}>&rarr;</div>

              <div className={styles.aboutHeroSensorItem}>
                <div className={styles.aboutHeroIconBox}>
                  <Database size={24} color="#38BDF8" />
                </div>
                <div>
                  <div className={styles.aboutHeroSensorTitle}>Firebase Realtime Sync</div>
                  <div className={styles.aboutHeroSensorMeta}>Sub-50ms Cloud Streaming • No Port Forwarding</div>
                </div>
              </div>

              <div className={styles.aboutHeroFlowArrow}>&rarr;</div>

              <div className={styles.aboutHeroSensorItem}>
                <div className={styles.aboutHeroIconBox}>
                  <ShieldCheck size={24} color="#FFB800" />
                </div>
                <div>
                  <div className={styles.aboutHeroSensorTitle}>Safety Interlocks &amp; AI</div>
                  <div className={styles.aboutHeroSensorMeta}>Gemini 1.5 Diagnostic Safety Engine</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. WHAT IS BATTERY VITAL?                                                 */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>What Is Battery Vital?</h2>
          <div className={styles.aboutTextCard}>
            <p>
              <strong>Battery Vital</strong> is a comprehensive real-time battery telemetry, edge safety interlock,
              and predictive health monitoring platform. Designed from the ground up to bring industrial-grade
              laboratory diagnostic capabilities to everyday energy storage systems, Battery Vital protects
              batteries against thermal runaway, over-discharge, overcurrent events, and chemical venting.
            </p>
            <p style={{ marginTop: 12 }}>
              Whether you are safeguarding a critical <strong>9V smoke detector</strong>, maintaining a{' '}
              <strong>12V solar LiFePO4 bank</strong>, or verifying cells in an <strong>EV commuter pack</strong>,
              Battery Vital offers plug-and-play hardware integration via low-cost ESP32 modules, instant cloud
              sync through Firebase, and cutting-edge Gemini AI anomaly analysis.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. KEY FEATURES GRID                                                      */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>Key Features</h2>
          <div className={styles.aboutFeaturesGrid}>
            {KEY_FEATURES.map((feat) => {
              const Icon = feat.icon
              return (
                <div key={feat.title} className={styles.aboutFeatureCard}>
                  <div className={styles.aboutFeatureIconWrap} style={{ color: feat.color, borderColor: `${feat.color}44` }}>
                    <Icon size={20} />
                  </div>
                  <h3 className={styles.aboutFeatureTitle}>{feat.title}</h3>
                  <p className={styles.aboutFeatureDesc}>{feat.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. HOW IT WORKS (ARCHITECTURE PIPELINE)                                  */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>How It Works</h2>
          <div className={styles.aboutStepsGrid}>
            <div className={styles.aboutStepCard}>
              <div className={styles.aboutStepNum}>01</div>
              <h3 className={styles.aboutStepTitle}>Connect Hardware</h3>
              <p className={styles.aboutStepDesc}>
                Connect the INA219 current shunt, DHT11 thermal sensor, and MQ gas detectors to your ESP32.
                Attach the high-side terminal to your battery pack.
              </p>
            </div>
            <div className={styles.aboutStepCard}>
              <div className={styles.aboutStepNum}>02</div>
              <h3 className={styles.aboutStepTitle}>Configure Chemistry</h3>
              <p className={styles.aboutStepDesc}>
                Select your chemistry profile (9V Alkaline, LiFePO4, 18650 Li-Ion, etc.) in the web console.
                The system automatically loads safe voltage and thermal thresholds.
              </p>
            </div>
            <div className={styles.aboutStepCard}>
              <div className={styles.aboutStepNum}>03</div>
              <h3 className={styles.aboutStepTitle}>Monitor in Real-Time</h3>
              <p className={styles.aboutStepDesc}>
                View live telemetry curves, receive push notifications on hazardous spikes, and run Gemini AI
                safety evaluations from anywhere on phone, tablet, or PC.
              </p>
            </div>
          </div>

          {/* Pipeline Diagram */}
          <div className={styles.aboutArchitectureDiagram}>
            <div className={styles.archNode}>
              <strong>Battery Pack</strong>
              <span>9V, 12V, 18650, 48V</span>
            </div>
            <div className={styles.archArrow}>&rarr;</div>
            <div className={styles.archNode}>
              <strong>ESP32 Hardware Hub</strong>
              <span>INA219 + DHT11 + MQ Sensors</span>
            </div>
            <div className={styles.archArrow}>&rarr;</div>
            <div className={styles.archNode}>
              <strong>Firebase Cloud</strong>
              <span>Realtime Database Stream</span>
            </div>
            <div className={styles.archArrow}>&rarr;</div>
            <div className={styles.archNode}>
              <strong>Battery Vital Web</strong>
              <span>Mission Control &amp; AI</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. SUPPORTED BATTERIES GRID                                               */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>Supported Batteries &amp; Chemistries</h2>
          <div className={styles.aboutBatteriesGrid}>
            {SUPPORTED_BATTERIES.map((bat) => (
              <div key={bat.type} className={styles.aboutBatteryCard}>
                <div className={styles.aboutBatteryTop}>
                  <h3 className={styles.aboutBatteryTitle}>{bat.type}</h3>
                  <span className={styles.aboutBatteryBadge}>{bat.badge}</span>
                </div>
                <div className={styles.aboutBatteryChemistry}>{bat.chemistries}</div>
                <div className={styles.aboutBatteryVoltage}>
                  Operating Range: <strong>{bat.voltage}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. TECHNOLOGY STACK                                                       */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>Technology Stack</h2>
          <div className={styles.aboutTechGrid}>
            <div className={styles.aboutTechCard}>
              <Cpu size={22} color="#00E8A0" />
              <h4>Edge Hardware</h4>
              <p>ESP32 dual-core 240MHz, INA219 I2C shunt, DHT11 thermistor, MQ-2 flammable gas sensor, MQ-135 air quality detector.</p>
            </div>
            <div className={styles.aboutTechCard}>
              <Database size={22} color="#38BDF8" />
              <h4>Cloud Realtime Backend</h4>
              <p>Firebase Realtime Database for sub-second reactive state synchronization, with MongoDB Atlas for persistent long-term storage.</p>
            </div>
            <div className={styles.aboutTechCard}>
              <FileCode size={22} color="#FFB800" />
              <h4>Frontend Engineering</h4>
              <p>Next.js 14 App Router, React 18, high-performance Recharts data visualization, and aerospace-inspired CSS glassmorphism.</p>
            </div>
            <div className={styles.aboutTechCard}>
              <Bot size={22} color="#B98CFF" />
              <h4>Artificial Intelligence</h4>
              <p>Google Gemini 1.5 Pro &amp; Flash multi-modal reasoning engine for telemetry risk scoring and remaining life forecasting.</p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 7. OPEN SOURCE & LICENSE                                                  */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>Open Source &amp; Licensing</h2>
          <div className={styles.aboutTextCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Github size={24} />
              <div>
                <strong>Released under the Permissive MIT License</strong>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Free for personal, educational, and commercial battery monitoring deployments.
                </div>
              </div>
            </div>
            <p>
              We believe safety telemetry should be universally accessible. Contributions to the ESP32
              firmware, Next.js frontend, or AI prompt engineering are enthusiastically welcomed.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <a
                href="https://github.com/batteryvital/batteryvital"
                target="_blank"
                rel="noreferrer"
                className={styles.aboutActionBtn}
              >
                <Github size={15} /> <span>GitHub Repository</span> <ExternalLink size={12} />
              </a>
              <a
                href="https://github.com/batteryvital/batteryvital/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noreferrer"
                className={styles.aboutActionSecondaryBtn}
              >
                <BookOpen size={15} /> <span>Contribution Guide</span>
              </a>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 8. SYSTEM VERSION INFORMATION                                             */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection} id="version">
          <h2 className={styles.aboutSectionHeading}>System Version Information</h2>
          <div className={styles.aboutVersionCard}>
            <div className={styles.aboutVersionItem}>
              <span>Firmware Version</span>
              <strong>v9.4.0 (Edge Kernel)</strong>
            </div>
            <div className={styles.aboutVersionItem}>
              <span>Website Console</span>
              <strong>v2.1.0 (Production)</strong>
            </div>
            <div className={styles.aboutVersionItem}>
              <span>Last Updated</span>
              <strong>January 28, 2025</strong>
            </div>
            <div className={styles.aboutVersionItem}>
              <span>Protocol Specification</span>
              <strong>BV-TELEMETRY-JSON-v2</strong>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 9. FAQ ACCORDION                                                          */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection} id="faq">
          <h2 className={styles.aboutSectionHeading}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div key={faq.q} className={styles.faqItem}>
                  <button
                    className={styles.faqQuestionBtn}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {isOpen && <div className={styles.faqAnswer}>{faq.a}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 10. CONTACT & SUPPORT                                                     */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection} style={{ marginBottom: 48 }}>
          <h2 className={styles.aboutSectionHeading}>Contact &amp; Engineering Support</h2>
          <div className={styles.aboutContactGrid}>
            <div className={styles.aboutContactCard}>
              <Mail size={20} color="#00E8A0" />
              <h4>Direct Support</h4>
              <p>Questions about sensor wiring or calibration?</p>
              <a href="mailto:support@batteryvital.com" className={styles.aboutContactLink}>
                support@batteryvital.com
              </a>
            </div>
            <div className={styles.aboutContactCard}>
              <Github size={20} color="#38BDF8" />
              <h4>Issue Tracker</h4>
              <p>Found a bug or need a custom feature?</p>
              <a
                href="https://github.com/batteryvital/issues"
                target="_blank"
                rel="noreferrer"
                className={styles.aboutContactLink}
              >
                github.com/batteryvital/issues &rarr;
              </a>
            </div>
            <div className={styles.aboutContactCard}>
              <BookOpen size={20} color="#FFB800" />
              <h4>Documentation</h4>
              <p>Hardware schematics, pinout guides, API schemas.</p>
              <a
                href="https://docs.batteryvital.com"
                target="_blank"
                rel="noreferrer"
                className={styles.aboutContactLink}
              >
                docs.batteryvital.com &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
