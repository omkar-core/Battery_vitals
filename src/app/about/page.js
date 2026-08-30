'use client'

import React from 'react'
import Layout from '../../components/Layout'
import {
  Sparkles,
  Cpu,
  Database,
  ShieldCheck,
  BatteryCharging,
  Thermometer,
  Zap,
  Activity,
  Wifi,
  Monitor,
  Bell,
  TrendingUp,
  RefreshCw,
  Linkedin,
  GraduationCap,
  Users,
  Target,
  Rocket,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import styles from '../../styles/pages.module.css'

const MISSION_CHAIN = ['Monitor', 'Analyze', 'Detect', 'Alert', 'Improve']

const WHAT_WE_BUILT = [
  { icon: BatteryCharging, label: 'Battery Parameter Monitoring' },
  { icon: Thermometer, label: 'Temperature Monitoring' },
  { icon: Zap, label: 'Voltage & Current Monitoring' },
  { icon: Activity, label: 'Real-Time Data Visualization' },
  { icon: Wifi, label: 'IoT Connectivity' },
  { icon: Monitor, label: 'Web-Based Dashboard' },
  { icon: Bell, label: 'Battery Safety & Alert System' },
  { icon: TrendingUp, label: 'Historical Data & Analytics' },
  { icon: Database, label: 'Cloud / Database Integration' },
  { icon: RefreshCw, label: 'Real-Time Communication' },
]

const GUIDE = {
  name: 'Prof. Dr. S. J. Patil',
  role: 'Project Guide',
  desc: 'Battery Vitals has been developed under the guidance of Prof. Dr. S. J. Patil, whose technical guidance, valuable feedback, and continuous support have contributed significantly to the development of this project.',
  linkedin: 'https://www.linkedin.com/in/dr-sandeep-patil-dkte/',
}

const TEAM = [
  {
    name: 'Omkar Balkrishna Kore',
    role: 'Project Member',
    desc: 'Responsible for project development, system integration, software development, web application, IoT implementation, and overall project coordination.',
    linkedin: 'https://www.linkedin.com/in/omkar-kore-313a0229a/',
  },
  {
    name: 'Vishwajeet Vijay Desai',
    role: 'Project Member',
    desc: 'Contributed to the development, testing, integration, and implementation of the Battery Vitals system.',
    linkedin: 'https://www.linkedin.com/in/vishwajeet-desai-75056339b',
  },
  {
    name: 'Tejas Satish Salgar',
    role: 'Project Member',
    desc: 'Contributed to system development, implementation, testing, and project integration.',
    linkedin: 'https://www.linkedin.com/in/tejas-salgar-808235416/',
  },
  {
    name: 'Supant Malkari Vhonmore',
    role: 'Project Member',
    desc: 'Contributed to the development, testing, implementation, and overall project activities.',
    linkedin: null,
  },
]

const TECH_GROUPS = [
  {
    title: 'Hardware',
    items: [
      'ESP32',
      'Voltage & Current Sensors (INA219)',
      'Temperature Sensors (DHT11)',
      'Battery Management Components',
      'OLED Display',
      'Supporting Electronic Components',
    ],
  },
  {
    title: 'Software & IoT',
    items: [
      'Embedded C / Arduino',
      'ESP32 Firmware',
      'Firebase Streaming',
      'IoT Communication',
      'WebSockets / Real-Time Communication',
    ],
  },
  {
    title: 'Web & Database',
    items: [
      'HTML',
      'CSS',
      'JavaScript',
      'Web Dashboard',
      'MongoDB',
      'REST APIs',
      'Real-Time Data Processing',
    ],
  },
]

const VISION_APPLICATIONS = [
  { title: 'Electric Vehicles', desc: 'Fleet-level cell health tracking for LEVs and light EVs.' },
  { title: 'Renewable Energy Storage', desc: 'Long-term performance logging for battery banks.' },
  { title: 'Solar Power Systems', desc: 'State-of-charge and degradation tracking for off-grid arrays.' },
  { title: 'Portable Power Systems', desc: 'Runtime and safety telemetry for generators and power stations.' },
  { title: 'Industrial Battery Systems', desc: 'Site-wide monitoring for standby and backup systems.' },
  { title: 'Battery Testing & Research', desc: 'Instrument-grade data collection for lab evaluations.' },
]

const VERSIONS = [
  { label: 'Website Console', value: 'v2.0.0 (Production)' },
  { label: 'ESP32 Firmware Engine', value: 'v12.0 (Edge Kernel)' },
  { label: 'Cloud Telemetry Sync', value: 'Firebase Realtime Database' },
  { label: 'AI Predictive Model', value: 'Google Gemini API' },
  { label: 'Historical Storage', value: 'MongoDB Atlas' },
]

function initialsOf(name) {
  return name
    .replace(/Prof\.|Dr\.|Mr\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export default function AboutPage() {
  return (
    <Layout connected={true} mode="firebase">
      <div className={styles.aboutContainer}>
        {/* ========================================================================= */}
        {/* 1. HERO                                                                   */}
        {/* ========================================================================= */}
        <div className={styles.aboutHero}>
          <span className={styles.aboutBadge}>
            <Sparkles size={13} color="#00E8A0" /> POWERING SMARTER. MONITORING BETTER.
          </span>
          <h1 className={styles.aboutHeroTitle}>
            About <span className="gradText">Battery Vitals</span>
          </h1>
          <p className={styles.aboutHeroSubtitle}>
            A smart battery monitoring and management project providing real-time insights into battery
            health, performance, safety, and operating conditions.
          </p>

          <div className={styles.aboutHeroCard}>
            <div className={styles.aboutHeroCardInner}>
              <div className={styles.aboutHeroSensorItem}>
                <div className={styles.aboutHeroIconBox}>
                  <Cpu size={24} color="#00E8A0" />
                </div>
                <div>
                  <div className={styles.aboutHeroSensorTitle}>ESP32 Edge Hub</div>
                  <div className={styles.aboutHeroSensorMeta}>Embedded Electronics &amp; Sensors</div>
                </div>
              </div>

              <div className={styles.aboutHeroFlowArrow}>&rarr;</div>

              <div className={styles.aboutHeroSensorItem}>
                <div className={styles.aboutHeroIconBox}>
                  <Database size={24} color="#38BDF8" />
                </div>
                <div>
                  <div className={styles.aboutHeroSensorTitle}>Cloud Sync</div>
                  <div className={styles.aboutHeroSensorMeta}>Firebase Realtime Database</div>
                </div>
              </div>

              <div className={styles.aboutHeroFlowArrow}>&rarr;</div>

              <div className={styles.aboutHeroSensorItem}>
                <div className={styles.aboutHeroIconBox}>
                  <ShieldCheck size={24} color="#FFB800" />
                </div>
                <div>
                  <div className={styles.aboutHeroSensorTitle}>Safety &amp; Insights</div>
                  <div className={styles.aboutHeroSensorMeta}>AI-Assisted Diagnostic Dashboard</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. OUR MISSION                                                             */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>
            <Target size={18} color="#00E8A0" /> Our Mission
          </h2>
          <div className={styles.aboutTextCard}>
            <p>
              <strong>Battery Vitals</strong> is a smart battery monitoring and management project designed
              to provide real-time insights into battery health, performance, safety, and operating
              conditions. The system combines <strong>embedded electronics, sensors, IoT connectivity,
              data monitoring, and a web-based dashboard</strong> to continuously monitor important
              battery parameters and present them in an easy-to-understand format.
            </p>
            <p style={{ marginTop: 12 }}>
              Our goal is to make battery monitoring <strong>smarter, safer, and more accessible</strong> by
              transforming raw battery data into meaningful information that can help users understand
              battery performance and identify abnormal conditions.
            </p>
          </div>

          <div className={styles.aboutMissionFlow}>
            {MISSION_CHAIN.map((step, idx) => (
              <React.Fragment key={step}>
                <div className={styles.aboutMissionChip}>{step}</div>
                {idx < MISSION_CHAIN.length - 1 && (
                  <ChevronRight size={16} className={styles.aboutMissionArrow} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. PROJECT GUIDE                                                          */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>
            <GraduationCap size={18} color="#38BDF8" /> Project Guide
          </h2>
          <div className={styles.aboutGuideCard}>
            <div className={styles.aboutGuideAvatar}>{initialsOf(GUIDE.name)}</div>
            <div className={styles.aboutGuideInfo}>
              <div className={styles.aboutGuideName}>{GUIDE.name}</div>
              <div className={styles.aboutGuideRole}>{GUIDE.role}</div>
              <p className={styles.aboutGuideDesc}>{GUIDE.desc}</p>
              <a
                href={GUIDE.linkedin}
                target="_blank"
                rel="noreferrer"
                className={styles.aboutLinkedInBtn}
              >
                <Linkedin size={15} /> <span>View LinkedIn</span>
              </a>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. PROJECT TEAM                                                           */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>
            <Users size={18} color="#FFB800" /> Project Team
          </h2>
          <div className={styles.aboutTeamGrid}>
            {TEAM.map((member) => (
              <div key={member.name} className={styles.aboutTeamCard}>
                <div className={styles.aboutTeamAvatar}>{initialsOf(member.name)}</div>
                <div className={styles.aboutTeamName}>{member.name}</div>
                <div className={styles.aboutTeamRole}>{member.role}</div>
                <p className={styles.aboutTeamDesc}>{member.desc}</p>
                {member.linkedin ? (
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.aboutLinkedInBtn}
                  >
                    <Linkedin size={14} /> <span>LinkedIn</span>
                  </a>
                ) : (
                  <div className={styles.aboutLinkedInNone}>Profile link not available</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. WHAT WE BUILT                                                          */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>
            <Rocket size={18} color="#B98CFF" /> What We Built
          </h2>
          <div className={styles.aboutBuiltGrid}>
            {WHAT_WE_BUILT.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className={styles.aboutBuiltItem}>
                  <Icon size={15} />
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. TECHNOLOGIES USED                                                      */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>
            <Cpu size={18} color="#00E8A0" /> Technologies Used
          </h2>
          <div className={styles.aboutTechColumns}>
            {TECH_GROUPS.map((group) => (
              <div key={group.title} className={styles.aboutTechColumn}>
                <h4 className={styles.aboutTechColumnTitle}>{group.title}</h4>
                <ul className={styles.aboutTechList}>
                  {group.items.map((item) => (
                    <li key={item}>
                      <ChevronRight size={12} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 7. OUR VISION                                                             */}
        {/* ========================================================================= */}
        <div className={styles.aboutSection}>
          <h2 className={styles.aboutSectionHeading}>
            <ShieldCheck size={18} color="#00E8A0" /> Our Vision
          </h2>
          <div className={styles.aboutTextCard}>
            <p>
              We envision Battery Vitals as a foundation for smarter battery monitoring systems that can be
              adapted for applications such as electric vehicles, renewable energy storage, solar power
              systems, portable power systems, industrial battery systems, and battery testing &amp; research.
            </p>
            <p style={{ marginTop: 12 }}>
              Our vision is to move from simply <strong>using batteries</strong> to intelligently{' '}
              <strong>understanding their condition and performance</strong>.
            </p>
          </div>
          <div className={styles.aboutVisionGrid}>
            {VISION_APPLICATIONS.map((app) => (
              <div key={app.title} className={styles.aboutVisionCard}>
                <div className={styles.aboutVisionTitle}>{app.title}</div>
                <div className={styles.aboutVisionDesc}>{app.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOOTER - ACADEMIC PROJECT + SYSTEM VERSION                                */}
        {/* ========================================================================= */}
        <div className={styles.aboutAcademicStrip}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={18} color="#00E8A0" />
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Academic Project</strong>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                A practical implementation of Embedded Systems, Electronics, IoT, Web Development,
                Database Management, and Real-Time Monitoring Systems.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Guided by knowledge. Built through collaboration. Powered by innovation.
              </div>
            </div>
          </div>
          <div className={styles.aboutVersionCard} style={{ marginTop: 16 }}>
            {VERSIONS.map((v) => (
              <div key={v.label} className={styles.aboutVersionItem}>
                <span>{v.label}</span>
                <strong>{v.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}