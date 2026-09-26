'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import Layout from '../../components/Layout'
import FailureForecast from '../../components/ai/FailureForecast'
import { useRealTimeData } from '../../hooks/useRealTimeData'
import { evaluateBatterySafety } from '../../lib/batterySafety'
import { predictRulWithUncertainty, detectTelemetryDrift } from '../../lib/rulModel'

export default function DemoPage() {
  const [activeStep, setActiveStep] = useState(1)
  const { data: liveData, connected } = useRealTimeData()

  // Interactive safety injector state for Step 3
  const [injectedScenario, setInjectedScenario] = useState('nominal')

  const scenarios = {
    nominal: {
      name: '🟢 Nominal Float (Healthy)',
      voltage: 3.72,
      current: 0.42,
      temperature: 24.5,
      humidity: 48,
      soc: 88,
      soh: 96,
      gas_raw: 120,
    },
    thermal_warning: {
      name: '🟡 Thermal Rise Caution (48.5°C)',
      voltage: 3.65,
      current: 1.85,
      temperature: 48.5,
      humidity: 42,
      soc: 64,
      soh: 91,
      gas_raw: 180,
    },
    critical_overvoltage: {
      name: '🔴 Overvoltage & Thermal Runaway (4.32V, 62°C)',
      voltage: 4.32,
      current: 3.40,
      temperature: 62.0,
      humidity: 35,
      soc: 100,
      soh: 84,
      gas_raw: 340,
    },
    cell_collapse: {
      name: '🚨 Deep Under-Voltage Collapse (2.45V)',
      voltage: 2.45,
      current: 0.05,
      temperature: 23.0,
      humidity: 50,
      soc: 5,
      soh: 76,
      gas_raw: 95,
    },
  }

  const currentScenario = scenarios[injectedScenario] || scenarios.nominal

  // Evaluate deterministic safety engine on injected scenario
  const evaluatedSafety = useMemo(() => {
    return evaluateBatterySafety({
      voltage: currentScenario.voltage,
      current: currentScenario.current,
      temperature: currentScenario.temperature,
      soc: currentScenario.soc,
      gas_raw: currentScenario.gas_raw,
    })
  }, [currentScenario])

  // Live telemetry metrics
  const liveVoltage = liveData?.battery?.voltage ?? liveData?.voltage ?? null
  const liveCurrent = liveData?.battery?.current ?? liveData?.current ?? null
  const liveTemp = liveData?.battery?.temperature ?? liveData?.temperature ?? null
  const liveSoc = liveData?.battery?.soc ?? liveData?.soc ?? null
  const liveSoh = liveData?.battery?.soh ?? liveData?.soh ?? null

  const driftAnalysis = useMemo(() => {
    if (liveVoltage == null || liveTemp == null) {
      return {
        hasDrift: false,
        transferabilityScore: 100,
        liveMetrics: { voltageMean: '--', temperatureMean: '--' },
      }
    }
    return detectTelemetryDrift([
      { voltage: liveVoltage, temperature: liveTemp },
    ])
  }, [liveVoltage, liveTemp])

  // Steps definition
  const steps = [
    { num: 1, title: 'The Core Problem', icon: '🎯', desc: 'BMS Limitations' },
    { num: 2, title: 'Live ESP32 Telemetry', icon: '📡', desc: 'Physical Hardware' },
    { num: 3, title: 'Deterministic Safety', icon: '🛡️', desc: 'Hardware Supremacy' },
    { num: 4, title: 'AI & RUL Prognostics', icon: '🧠', desc: 'Bootstrap Forecasting' },
    { num: 5, title: 'Empirical Proof', icon: '📊', desc: 'NASA Ames Validation' },
  ]

  const safetyBadgeStyle = (status) => {
    switch (status) {
      case 'SAFE':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', color: '#10b981' }
      case 'CAUTION':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', color: '#f59e0b' }
      case 'WARNING':
        return { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', color: '#eab308' }
      case 'CRITICAL':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', color: '#ef4444' }
      case 'EMERGENCY':
        return { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', color: '#f43f5e' }
      default:
        return { bg: 'var(--bg-surface-raised)', border: 'var(--border)', color: 'var(--text-secondary)' }
    }
  }

  const badgeStyle = safetyBadgeStyle(evaluatedSafety.status)

  return (
    <Layout>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Header Breadcrumb Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              <Link href="/" style={{ color: '#38bdf8', textDecoration: 'none' }}>Home</Link>
              <span>/</span>
              <span style={{ color: 'var(--text-secondary)' }}>Competition Interactive Demo</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🏆</span> Battery Vital Guided Tour
            </h1>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
              Interactive 5-stage walkthrough for judges: Problem → Live Hardware → Deterministic Safety → RUL Prognostics → Empirical Validation.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href="/validation"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📊</span> Full Benchmark Suite
            </Link>
            <Link
              href="/ai"
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>🧠</span> Live AI Dashboard
            </Link>
          </div>
        </div>

        {/* Step Progress Navigation Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          {steps.map((s) => {
            const isCurrent = activeStep === s.num
            const isCompleted = activeStep > s.num
            return (
              <button
                key={s.num}
                onClick={() => setActiveStep(s.num)}
                style={{
                  backgroundColor: isCurrent ? 'var(--bg-surface-raised)' : 'var(--bg-surface)',
                  border: isCurrent ? '2px solid #38bdf8' : isCompleted ? '1px solid #10b981' : '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: isCurrent ? '#0284c7' : isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-surface-raised)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: isCurrent ? '#38bdf8' : 'var(--text-muted)', fontWeight: '700' }}>
                    Step {s.num}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {s.title}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ──────────────────────────────────────────────────────────── */}
        {/* STAGE 1: THE CORE PROBLEM */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid #f59e0b',
                borderRadius: '12px',
                padding: '28px',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                The Fundamental Problem In Battery Management
              </div>
              <blockquote
                style={{
                  fontSize: '22px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  lineHeight: '1.4',
                  margin: '0 0 16px 0',
                  borderLeft: '4px solid #f59e0b',
                  paddingLeft: '16px',
                  fontStyle: 'italic',
                }}
              >
                “Standard BMS measures voltage, current, and temperature, but cannot tell you how much life is left or catch a developing fault before a threshold is crossed.”
              </blockquote>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
                Existing approaches suffer from two fatal extremes:
                traditional hardware BMS only trips when disaster is already occurring, while naive ML models over-estimate cell life by 40%+ because they fail to anticipate non-linear electrochemical degradation knees.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>❌</span> Traditional BMS (Reactive)
                </div>
                <ul style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', paddingLeft: '18px', margin: 0 }}>
                  <li>Static upper/lower voltage and temp cutoffs only.</li>
                  <li>No predictive foresight of remaining useful life.</li>
                  <li>Zero internal resistance drift tracking during operation.</li>
                  <li>Cannot detect early internal short-circuit micro-faults.</li>
                </ul>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span> Naive ML Models (Unreliable)
                </div>
                <ul style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', paddingLeft: '18px', margin: 0 }}>
                  <li>Linear extrapolations assume initial gentle decay persists forever.</li>
                  <li>Misses accelerated capacity degradation knee onset completely.</li>
                  <li>Generates single point estimates without honest uncertainty bounds.</li>
                  <li>High risk of LLM hallucinations if coupled to physical actuators.</li>
                </ul>
              </div>

              <div style={{ backgroundColor: 'var(--bg-surface)', border: '2px solid #38bdf8', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>✨</span> Battery Vital Solution
                </div>
                <ul style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', paddingLeft: '18px', margin: 0 }}>
                  <li><strong>Deterministic Safety Supremacy</strong>: Physical thresholds hold final veto power.</li>
                  <li><strong>Resistance-Coupled Prognostics</strong>: Anticipates degradation knees.</li>
                  <li><strong>Calibrated Bootstrap Bounds</strong>: Rigorous P10/P50/P90 percentiles.</li>
                  <li><strong>One Validated Engine</strong>: Same code tested on NASA and running live.</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                onClick={() => setActiveStep(2)}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Proceed to Step 2: Live ESP32 Telemetry <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* STAGE 2: LIVE PHYSICAL HARDWARE TELEMETRY */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📡</span> Live ESP32 Hardware Stream
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                    Physical sensor telemetry streaming via Firebase RTDB from ESP32 Microcontroller (Firmware v13.1.0).
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: connected ? '#10b981' : '#f59e0b',
                      boxShadow: connected ? '0 0 10px #10b981' : 'none',
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: connected ? '#10b981' : '#f59e0b' }}>
                    {connected ? 'HARDWARE ONLINE (STREAMING)' : 'SYNCHRONIZING WITH CLOUD RTDB'}
                  </span>
                </div>
              </div>

              {/* Hardware Telemetry Metric Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Terminal Voltage</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
                    {liveVoltage != null ? Number(liveVoltage).toFixed(2) : '--'} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>V</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>INA219 High-Side Shunt</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Shunt Current</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                    {liveCurrent != null ? Number(liveCurrent).toFixed(2) : '--'} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>A</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Discharge / Load Draw</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Pack Temperature</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: liveTemp != null && liveTemp > 45 ? '#f59e0b' : 'var(--text-primary)', marginTop: '4px' }}>
                    {liveTemp != null ? Number(liveTemp).toFixed(1) : '--'} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>°C</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>DHT11 / Thermal Probe</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>State of Charge</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#a855f7', marginTop: '4px' }}>
                    {liveSoc != null ? Math.round(liveSoc) : '--'} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>%</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>OCV + Coulomb Counter</div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>State of Health</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
                    {liveSoh != null ? Math.round(liveSoh) : '--'} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>%</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Capacity vs 2.60 Ah Rated</div>
                </div>
              </div>

              {/* Hardware Sensor Architecture Callout */}
              <div style={{ backgroundColor: 'var(--bg-surface-raised)', borderRadius: '8px', padding: '14px 18px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>⚡</span>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Autonomous ESP32 Safety Loop:</strong> The firmware evaluates critical thresholds every 1.5 seconds locally on hardware. Even if WiFi disconnects, the onboard buzzer and LED alarm activate instantly without network latency.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={() => setActiveStep(1)}
                style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                <span>←</span> Back to Problem
              </button>
              <button
                onClick={() => setActiveStep(3)}
                style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                Proceed to Step 3: Deterministic Safety <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* STAGE 3: DETERMINISTIC SAFETY ENGINE VISIBLY REACTING */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🛡️</span> Deterministic Safety Supremacy In Action
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px 0' }}>
                Strict safety rule: <code>SAFE(0) &lt; CAUTION(1) &lt; WARNING(2) &lt; CRITICAL(3) &lt; EMERGENCY(4)</code>. AI can interpret, but can never downgrade a deterministic safety trip. Test different conditions below to see the engine react in real time.
              </p>

              {/* Scenario Selector Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                {Object.entries(scenarios).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => setInjectedScenario(key)}
                    style={{
                      backgroundColor: injectedScenario === key ? 'var(--bg-surface-raised)' : 'var(--bg-surface)',
                      border: injectedScenario === key ? '2px solid #38bdf8' : '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      color: injectedScenario === key ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Live Safety Reaction Panel */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-raised)',
                  border: `2px solid ${badgeStyle.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '24px',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>
                    Deterministic Engine Status
                  </div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: badgeStyle.bg,
                      border: `1px solid ${badgeStyle.border}`,
                      color: badgeStyle.color,
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '20px',
                      fontWeight: '800',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <span>{evaluatedSafety.status === 'SAFE' ? '🟢' : evaluatedSafety.status === 'WARNING' ? '🟡' : '🔴'}</span>
                    {evaluatedSafety.status}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginTop: '12px', margin: '12px 0 0 0' }}>
                    {evaluatedSafety.actionRequired || 'System operating within nominal electrochemical safety limits.'}
                  </p>
                </div>

                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>
                    Hardware Actuator Response
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Audible Alarm Buzzer:</span>
                      <strong style={{ color: evaluatedSafety.status === 'CRITICAL' || evaluatedSafety.status === 'EMERGENCY' ? '#ef4444' : '#10b981' }}>
                        {evaluatedSafety.status === 'CRITICAL' || evaluatedSafety.status === 'EMERGENCY' ? '🔊 ACTIVE ALARM (LATCHED)' : '🔇 SILENT'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Charge Relay Breaker:</span>
                      <strong style={{ color: evaluatedSafety.status === 'CRITICAL' || evaluatedSafety.status === 'EMERGENCY' ? '#ef4444' : '#10b981' }}>
                        {evaluatedSafety.status === 'CRITICAL' || evaluatedSafety.status === 'EMERGENCY' ? '⚡ DISCONNECTED (TRIPPED)' : 'CONNECTED'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Remote Web Override:</span>
                      <strong style={{ color: evaluatedSafety.status === 'CRITICAL' ? '#f59e0b' : '#38bdf8' }}>
                        {evaluatedSafety.status === 'CRITICAL' ? '⛔ BLOCKED (PHYSICAL LOCKOUT)' : 'ALLOWED'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={() => setActiveStep(2)}
                style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                <span>←</span> Back to Telemetry
              </button>
              <button
                onClick={() => setActiveStep(4)}
                style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                Proceed to Step 4: AI & RUL Prognostics <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* STAGE 4: AI & RUL PROGNOSTICS (REAL BOOTSTRAP UNCERTAINTY) */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🧠</span> Real-Time RUL Prognostic Model with Bootstrap Uncertainty
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
                    Powered by <code>src/lib/rulModel.js</code>. The exact same mathematical model evaluated on NASA data runs here on live history.
                  </p>
                </div>
              </div>

              {/* Real Failure Forecast Card */}
              <FailureForecast batteryId="BAT001" />

              {/* Explanatory Callout */}
              <div style={{ marginTop: '20px', backgroundColor: 'var(--bg-surface-raised)', borderRadius: '8px', padding: '16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8', marginBottom: '6px' }}>
                  💡 Why Residual Bootstrap Uncertainty?
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                  Standard linear extrapolation assumes early slow degradation continues indefinitely, resulting in a false sense of security.
                  Our model bootstraps fit residuals $N=150$ times and couples internal resistance drift ($\Delta R / R_0$) to produce a conservative <strong>P10 bound</strong> (early failure risk) alongside the <strong>P50 median</strong> and <strong>P90 optimistic</strong> estimate.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                onClick={() => setActiveStep(3)}
                style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                <span>←</span> Back to Safety
              </button>
              <button
                onClick={() => setActiveStep(5)}
                style={{ backgroundColor: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                Proceed to Step 5: Empirical Proof <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────── */}
        {/* STAGE 5: EMPIRICAL PROOF (NASA AMES VALIDATION BENCHMARK) */}
        {/* ──────────────────────────────────────────────────────────── */}
        {activeStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📊</span> Empirical Validation Benchmark (NASA Ames Dataset)
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '0 0 20px 0' }}>
                Evaluated on 4 held-out 18650 Li-ion cells (B0005, B0006, B0007, B0018) across 50%, 70%, and 85% lifecycle splits against all naive baselines required by the brief.
              </p>

              {/* Main Comparison Table */}
              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 14px' }}>Method / Architecture</th>
                      <th style={{ padding: '10px 14px' }}>Model Type</th>
                      <th style={{ padding: '10px 14px' }}>MAE (Cycles)</th>
                      <th style={{ padding: '10px 14px' }}>RMSE (Cycles)</th>
                      <th style={{ padding: '10px 14px' }}>P10–P90 Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ backgroundColor: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#38bdf8' }}>
                        ⭐ Battery Vital RUL Model (Ours)
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>Bootstrap Exponential Fit</td>
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: '#10b981' }}>18.8</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>30.2</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#38bdf8' }}>67%</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>Gaussian Process Regression (Extra Credit)</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>RBF Kernel Analytical Epistemic</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-primary)' }}>49.3</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>60.3</td>
                      <td style={{ padding: '12px 14px', color: '#10b981' }}>100%</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>Capacity Threshold Baseline</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>Direct Point Interpolation</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>32.2</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>54.5</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>N/A (Point est)</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>Linear Trend Baseline</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>Naive OLS Extrapolation</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>42.6</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>65.5</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>N/A (Point est)</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>Exponential Trend Baseline</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>Naive Log-Linear Decay</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>50.5</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>74.3</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>N/A (Point est)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Domain Transferability Badge */}
              <div style={{ backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>
                    Hardware Domain Transferability Check
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '2px' }}>
                    Live Rig Status: <strong style={{ color: driftAnalysis.hasDrift ? '#f59e0b' : '#10b981' }}>{driftAnalysis.hasDrift ? 'DRIFT DETECTED' : 'BENCHMARK ALIGNED'}</strong> (Transferability: {driftAnalysis.transferabilityScore}%)
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Live Voltage: {driftAnalysis.liveMetrics?.voltageMean}V • Live Temp: {driftAnalysis.liveMetrics?.temperatureMean}°C
                </div>
              </div>

              {/* Call-to-Action Deliverables */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <Link
                  href="/validation"
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '14px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>📊</span> Explore Interactive Validation Charts
                </Link>

                <a
                  href="/MODEL_CARD.md"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '14px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>📜</span> View Technical Model Card
                </a>

                <a
                  href="/COMPETITION_SUMMARY.md"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid #10b981',
                    color: '#10b981',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '14px',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>⏱️</span> 90-Second Executive Summary
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '12px' }}>
              <button
                onClick={() => setActiveStep(4)}
                style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
              >
                <span>←</span> Back to AI & RUL
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
