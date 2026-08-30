'use client'

import React from 'react'
import {
  X,
  BookOpen,
  Cpu,
  Info,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle,
  ExternalLink,
  Code2,
} from 'lucide-react'
import styles from './components.module.css'

export function UserManualModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.shortcutsModal} ${styles.helpModalLarge}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="User Manual"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={20} color="var(--accent-primary)" />
            <h3 className={styles.modalTitle}>Battery Vital User Manual &amp; Safety Guide</h3>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close user manual">
            <X size={18} />
          </button>
        </div>

        <div className={styles.helpModalBody}>
          <div className={styles.manualSection}>
            <h4>1. Overview &amp; Safety Disclaimer</h4>
            <p>
              Battery Vital provides continuous telemetry acquisition, edge protection interlocks,
              and AI predictive health analytics. It is designed as an active diagnostic and supervisory
              instrument. <strong>Always ensure a primary hardware BMS is installed</strong> for pack-level
              short-circuit protection.
            </p>
          </div>

          <div className={styles.manualSection}>
            <h4>2. Battery Health Index (BHI) Scale</h4>
            <div className={styles.bhiTable}>
              <div className={styles.bhiRow} style={{ borderLeft: '4px solid #00E8A0' }}>
                <strong>0 - 24 (Optimal / Safe):</strong> Nominal voltage, balanced cells, ambient temperature &lt; 35°C, baseline gas sensors.
              </div>
              <div className={styles.bhiRow} style={{ borderLeft: '4px solid #FFD60A' }}>
                <strong>25 - 44 (Caution):</strong> Minor voltage drift, elevated thermal climb (+1.5°C/min), or slight IR increase.
              </div>
              <div className={styles.bhiRow} style={{ borderLeft: '4px solid #FF8C00' }}>
                <strong>45 - 69 (Warning):</strong> Cell delta &gt; 100mV, elevated MQ-2/135 gas readings, temperature 40°C - 50°C.
              </div>
              <div className={styles.bhiRow} style={{ borderLeft: '4px solid #FF2D55' }}>
                <strong>70 - 100 (Critical Risk):</strong> Severe thermal climb &gt; 55°C, volatile organic compounds / smoke detected, or voltage breach. Automatic relay shutdown is triggered.
              </div>
            </div>
          </div>

          <div className={styles.manualSection}>
            <h4>3. Operating Limits &amp; Chemistries</h4>
            <ul className={styles.manualList}>
              <li><strong>9V Alkaline / Lithium:</strong> Cutoff at 6.0V (Alkaline) or 7.0V (Li-MnO2). Nominal: 9.0V. Max: 9.6V.</li>
              <li><strong>12V Lead-Acid / LiFePO4:</strong> Low cutoff 10.5V, Absorption 14.4V, Float 13.6V.</li>
              <li><strong>18650 / 21700 Li-Ion (1S to 4S):</strong> 3.0V cutoff per cell, 4.20V maximum charge. Delta imbalance limit: 50mV.</li>
              <li><strong>48V - 72V EV Packs:</strong> High-voltage divider required. Temperature sensors must be placed on central cells.</li>
            </ul>
          </div>

          <div className={styles.manualSection}>
            <h4>4. Maintenance &amp; Calibration</h4>
            <p>
              Perform current shunt zero-calibration monthly via <em>System &rarr; Calibration</em> with
              no load connected. Clean the MQ-2 and MQ-135 sensor meshes every 90 days.
            </p>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Manual Rev 2.1 • Compliant with UL1973 &amp; IEC 62619 guidelines
          </span>
          <button className={styles.primaryModalBtn} onClick={onClose}>
            Done Reading
          </button>
        </div>
      </div>
    </div>
  )
}

export function WiringDiagramModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.shortcutsModal} ${styles.helpModalLarge}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Wiring Diagrams"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={20} color="var(--accent-primary)" />
            <h3 className={styles.modalTitle}>Hardware Pinout &amp; Wiring Diagrams</h3>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close wiring diagrams">
            <X size={18} />
          </button>
        </div>

        <div className={styles.helpModalBody}>
          <div className={styles.wiringSchematicCard}>
            <div className={styles.wiringSchematicAscii}>
{`+-------------------------------------------------------------------+
|                     BATTERY VITAL SENSOR HUB                      |
+-------------------------------------------------------------------+
|                                                                   |
|   [ BATTERY PACK ]                                                |
|      (+) -----------> INA219 (VIN+)                               |
|                       INA219 (VIN-) ------------> [ LOAD / RELAY ]|
|      (-) ---------------------------------------> [ LOAD (GND) ]  |
|                                                          |        |
|                                                          v        |
|   [ ESP32 DEV BOARD ]                                   GND       |
|      3V3  ----------> INA219 VCC, DHT11 VCC                       |
|      5V   ----------> MQ-2 VCC, MQ-135 VCC                        |
|      GND  ----------> Common Ground (All Sensors & Battery -)     |
|      GPIO 21 -------> I2C SDA (INA219 High-Side Shunt)            |
|      GPIO 22 -------> I2C SCL (INA219 Clock)                      |
|      GPIO 4  -------> DHT11 (Ambient Temp & Humidity Data)        |
|      GPIO 34 -------> MQ-2 Analog (Combustible Gas / Smoke ADC)   |
|      GPIO 35 -------> MQ-135 Analog (Air Quality / CO2 / VOC ADC) |
|      GPIO 18 -------> Safety Relay / Solid State Contactor Gate   |
|      GPIO 19 -------> Emergency Buzzer & Visual Alarm LED         |
+-------------------------------------------------------------------+`}
            </div>
          </div>

          <div className={styles.manualSection} style={{ marginTop: 16 }}>
            <h4>Sensor Connections &amp; Specifications</h4>
            <div className={styles.pinoutGrid}>
              <div className={styles.pinoutCard}>
                <strong>INA219 Precision Shunt</strong>
                <span>Bus: I2C (Address 0x40)</span>
                <span>Pins: GPIO 21 (SDA), GPIO 22 (SCL)</span>
                <span>Accuracy: ±0.1mA, 0-26V DC</span>
              </div>
              <div className={styles.pinoutCard}>
                <strong>DHT11 Environmental</strong>
                <span>Protocol: 1-Wire Digital</span>
                <span>Pin: GPIO 4</span>
                <span>Range: 0-50°C (±2°C), 20-90% RH</span>
              </div>
              <div className={styles.pinoutCard}>
                <strong>MQ-2 Combustible Gas</strong>
                <span>Signal: Analog 12-bit ADC</span>
                <span>Pin: GPIO 34 (ADC1_CH6)</span>
                <span>Detects: LPG, Smoke, Hydrogen</span>
              </div>
              <div className={styles.pinoutCard}>
                <strong>MQ-135 Air Quality</strong>
                <span>Signal: Analog 12-bit ADC</span>
                <span>Pin: GPIO 35 (ADC1_CH7)</span>
                <span>Detects: NH3, NOx, Alcohol, Benzene</span>
              </div>
            </div>
          </div>

          <div className={styles.manualSection}>
            <h4>High-Voltage Packs (&gt;26V) Warning</h4>
            <p>
              The onboard INA219 has a maximum rated bus voltage of 26V. When monitoring 48V or 72V
              EV packs, you must install an isolated high-voltage Hall-effect current transducer
              (e.g., LEM HO-P or Allegro ACS758) and a precision 10:1 resistor divider into ADC GPIO 32.
            </p>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Hardware Specification v9.4 • ESP32-WROOM-32D Core
          </span>
          <button className={styles.primaryModalBtn} onClick={onClose}>
            Close Diagram
          </button>
        </div>
      </div>
    </div>
  )
}

export function VersionInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.shortcutsModal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Version Information"
      >
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Info size={20} color="var(--accent-primary)" />
            <h3 className={styles.modalTitle}>System Version &amp; Environment</h3>
          </div>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close version info">
            <X size={18} />
          </button>
        </div>

        <div className={styles.versionGrid}>
          <div className={styles.versionRow}>
            <span>Website Console Version</span>
            <strong>v2.1.0 (Production Release)</strong>
          </div>
          <div className={styles.versionRow}>
            <span>ESP32 Firmware Engine</span>
            <strong>v9.4.0 (Edge Safety Kernel)</strong>
          </div>
          <div className={styles.versionRow}>
            <span>Cloud Telemetry Sync</span>
            <strong>Firebase Realtime Database v12.18</strong>
          </div>
          <div className={styles.versionRow}>
            <span>AI Predictive Model</span>
            <strong>Google Gemini 1.5 Pro / Flash API</strong>
          </div>
          <div className={styles.versionRow}>
            <span>Historical Storage</span>
            <strong>MongoDB Atlas Cloud Shard</strong>
          </div>
          <div className={styles.versionRow}>
            <span>Last Updated</span>
            <strong>January 28, 2025</strong>
          </div>
        </div>

        <div className={styles.manualSection} style={{ marginTop: 14 }}>
          <h4 style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Release 2.1.0 Highlights</h4>
          <ul className={styles.manualList} style={{ fontSize: 12 }}>
            <li>Redesigned modern header with inline battery vitals card &amp; multi-tier navigation</li>
            <li>Real-time toast notification system with audio synthesis &amp; desktop alerts</li>
            <li>Embedded right-side Battery Passport slide-out digital twin</li>
            <li>Command Palette (Ctrl+K) &amp; global keyboard shortcuts</li>
            <li>6-step guided interactive onboarding walkthrough</li>
          </ul>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.primaryModalBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
