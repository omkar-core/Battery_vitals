'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sliders,
  Bell,
  Activity,
  Gauge,
  Radio,
  BookOpen,
} from 'lucide-react'
import styles from './components.module.css'

const ONBOARDING_STORAGE_KEY = 'bv_onboarding_completed'

const STEPS = [
  {
    step: 1,
    title: 'Welcome to Battery Vital!',
    message:
      "We'll guide you through setting up your first battery in 3 easy steps. Learn how live telemetry, edge safety interlocks, and AI diagnostics keep your packs safe.",
    target: 'none',
    icon: Sparkles,
    highlightNote: 'Professional Battery Monitoring for All Chemistries',
  },
  {
    step: 2,
    title: 'Live Connection Status',
    message:
      'This indicator shows your ESP32 hardware connection status in real time. It displays a green pulsing LIVE badge when connected, and tracks the exact seconds since your last telemetry reading.',
    target: 'connection-badge',
    icon: Radio,
    highlightNote: 'Top-Right Header Indicator',
  },
  {
    step: 3,
    title: 'Configure Your Battery Chemistry',
    message:
      'Set your battery type (9V, AA, 18650, 12V LiFePO4, or 48V EV pack). Configuring your chemistry tells the edge firmware what voltage and temperature ranges to expect for safety interlocks.',
    target: 'system-menu',
    icon: Sliders,
    highlightNote: 'Navigate to System → Battery Configuration',
    actionRoute: '/settings',
    actionText: 'Configure Now',
  },
  {
    step: 4,
    title: 'Telemetry & Fuel Gauge Overview',
    message:
      'Once configured, your live gauges will show voltage, current, and temperature in real time. The State of Charge (SOC) acts as your digital fuel gauge, calculating remaining run time.',
    target: 'dashboard-overview',
    icon: Gauge,
    highlightNote: 'Live Dashboard Gauges & Curves',
  },
  {
    step: 5,
    title: 'Safety Interlocks & Alerts',
    message:
      'You will receive instant multi-channel alerts if voltage drops below safe thresholds, temperature rises excessively, or gas sensors detect cell venting.',
    target: 'alerts-bell',
    icon: Bell,
    highlightNote: 'Notification Center & Push Alerts',
  },
  {
    step: 6,
    title: "You're All Set!",
    message:
      'Your dashboard will automatically populate with live data once your ESP32 starts transmitting readings. Enjoy peace of mind with 24/7 battery protection.',
    target: 'none',
    icon: CheckCircle2,
    highlightNote: 'Mission Control Active',
  },
]

export default function OnboardingModal({ isOpen, onClose, onOpenManual }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const stepData = STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === STEPS.length - 1
  const StepIcon = stepData.icon

  const handleFinish = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
      } catch (e) {}
    }
    onClose()
  }

  const handleNext = () => {
    if (isLast) {
      handleFinish()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  return (
    <div className={styles.onboardingOverlay} onClick={handleFinish}>
      <div
        className={styles.onboardingCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Quick Start Guide"
      >
        {/* Spotlight Top Badge */}
        <div className={styles.onboardingTopBar}>
          <div className={styles.onboardingStepBadge}>
            Step {stepData.step} of {STEPS.length}
          </div>
          <button
            className={styles.onboardingCloseBtn}
            onClick={handleFinish}
            aria-label="Skip Tutorial"
          >
            <X size={18} />
          </button>
        </div>

        {/* Visual Header */}
        <div className={styles.onboardingHeader}>
          <div className={styles.onboardingIconBox}>
            <StepIcon size={24} color="#00E8A0" />
          </div>
          <div className={styles.onboardingPill}>{stepData.highlightNote}</div>
          <h2 className={styles.onboardingTitle}>{stepData.title}</h2>
          <p className={styles.onboardingMessage}>{stepData.message}</p>
        </div>

        {/* Step dots progress */}
        <div className={styles.onboardingDots}>
          {STEPS.map((s, idx) => (
            <span
              key={s.step}
              className={`${styles.onboardingDot} ${idx === currentStep ? styles.onboardingDotActive : ''}`}
              onClick={() => setCurrentStep(idx)}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className={styles.onboardingFooter}>
          <label className={styles.onboardingCheckboxLabel}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            <span>Don&apos;t show again</span>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            {isFirst ? (
              <button className={styles.onboardingSkipBtn} onClick={handleFinish}>
                Skip (I know what I&apos;m doing)
              </button>
            ) : (
              <button className={styles.onboardingBackBtn} onClick={handleBack}>
                <ArrowLeft size={14} /> Back
              </button>
            )}

            {stepData.actionRoute ? (
              <button
                className={styles.onboardingActionBtn}
                onClick={() => {
                  handleFinish()
                  router.push(stepData.actionRoute)
                }}
              >
                {stepData.actionText || 'Go'} &rarr;
              </button>
            ) : null}

            <button className={styles.onboardingNextBtn} onClick={handleNext}>
              {isLast ? 'Go to Dashboard' : isFirst ? 'Start Setup' : 'Next'}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>

        {isLast && onOpenManual && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              className={styles.onboardingManualLink}
              onClick={() => {
                handleFinish()
                onOpenManual()
              }}
            >
              <BookOpen size={13} />
              <span>View Full User Manual</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
