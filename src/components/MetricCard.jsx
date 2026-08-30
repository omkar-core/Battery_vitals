'use client'

import React from 'react'
import Tooltip from './Tooltip'
import { SkeletonBox } from './SkeletonLoader'
import useAnimatedNumber from '../hooks/useAnimatedNumber'
import styles from './components.module.css'

const CHIP_META = {
  OK: { label: 'OK', color: 'var(--state-safe)', bg: 'rgba(61, 220, 151, 0.12)' },
  WARM: { label: 'WARM', color: 'var(--state-caution)', bg: 'rgba(245, 185, 66, 0.12)' },
  N_C: { label: 'N/C', color: 'var(--text-tertiary)', bg: 'rgba(92, 102, 117, 0.12)' },
  STUCK: { label: 'STUCK', color: 'var(--state-warning)', bg: 'rgba(245, 185, 66, 0.14)' },
  RANGE: { label: 'RANGE', color: 'var(--state-critical)', bg: 'rgba(240, 71, 92, 0.14)' },
  FAULT: { label: 'FAULT', color: 'var(--state-critical)', bg: 'rgba(240, 71, 92, 0.14)' },
  ERR: { label: 'ERR', color: 'var(--state-critical)', bg: 'rgba(240, 71, 92, 0.14)' },
}

const DEFAULT_TOOLTIPS = {
  soc: 'State of Charge - Percentage of battery capacity remaining',
  voltage: 'Terminal Voltage - Live DC operating potential across cells',
  current: 'Current Flow - Positive represents charging, negative indicates discharge load',
  temperature: 'Cell Temperature - Monitored via high-precision thermal sensors',
  bhi: 'Battery Health Index - Composite AI risk & safety score (0 = Perfect, 100 = Hazardous)',
  'gas risk': 'Gas Sensor Index - Volatile organic and flammable smoke concentration (MQ-2/135)',
  soh: 'State of Health - Retained usable capacity relative to factory nominal rating',
  'internal resistance': 'Dynamic internal impedance in milliohms (mΩ) under active load',
}

export default function MetricCard({
  title,
  value,
  unit,
  color = 'var(--accent-primary)',
  icon: Icon,
  chip,
  delta,
  subtext,
  tooltip,
  onClick,
  animate = true,
}) {
  const chipUpper = (chip || '').toUpperCase()
  const chipMeta = CHIP_META[chipUpper] || (chip ? { label: chipUpper, color, bg: `${color}1a` } : null)
  const isValueMissing = value == null || value === '' || value === '--'

  // K2 - Animated numeric values (count-up with easing, reduced-motion aware).
  const parsedValue = parseFloat(value)
  const digits =
    typeof value === 'number'
      ? Number.isInteger(value) ? 0 : 2
      : String(value).includes('.')
      ? Math.min(3, String(value).split('.')[1].length)
      : 0
  const animatedValue = useAnimatedNumber(parsedValue, 450, digits)
  const useAnimated = animate && !isValueMissing && !Number.isNaN(parsedValue)
  const displayValue = useAnimated && animatedValue != null ? animatedValue : value

  const titleKey = (title || '').toLowerCase().trim()
  const tooltipText = tooltip || DEFAULT_TOOLTIPS[titleKey] || `Real-time metric: ${title}`

  return (
    <div
      className={styles.metricCard}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className={styles.metricTop}>
        <Tooltip text={tooltipText}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'help' }}>
            {Icon ? (
              <span className={styles.metricIcon}>
                <Icon size={16} color={color} />
              </span>
            ) : null}
            <span className={styles.metricTitle}>{title}</span>
          </div>
        </Tooltip>

        {chipMeta ? (
          <span
            className="chip"
            style={{
              background: chipMeta.bg,
              borderColor: `${chipMeta.color}44`,
              color: chipMeta.color,
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {chipMeta.label}
          </span>
        ) : null}
      </div>

      <div className={styles.metricValue}>
        {isValueMissing ? (
          <SkeletonBox width="80px" height="32px" borderRadius="6px" />
        ) : (
          <span style={{ color }}>{displayValue}</span>
        )}
        {unit && !isValueMissing ? <span className={styles.metricUnit}>{unit}</span> : null}
      </div>

      {(delta != null || subtext) && (
        <div className={styles.metricSub}>
          {delta != null ? (
            <span
              className={styles.metricDelta}
              style={{ color: delta >= 0 ? 'var(--state-safe)' : 'var(--state-critical)' }}
            >
              {delta >= 0 ? '↑ +' : '↓ '}
              {typeof delta === 'number' ? delta.toFixed(1) : delta}
            </span>
          ) : null}
          {subtext && <span style={{ color: 'var(--text-tertiary)' }}>{subtext}</span>}
        </div>
      )}
    </div>
  )
}
