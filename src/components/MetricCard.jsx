import styles from './components.module.css'
import { SkeletonBox } from './SkeletonLoader'

const CHIP_META = {
  OK: { label: 'OK', color: 'var(--state-safe)', bg: 'rgba(61, 220, 151, 0.12)' },
  WARM: { label: 'WARM', color: 'var(--state-caution)', bg: 'rgba(245, 185, 66, 0.12)' },
  N_C: { label: 'N/C', color: 'var(--text-tertiary)', bg: 'rgba(92, 102, 117, 0.12)' },
  STUCK: { label: 'STUCK', color: 'var(--state-warning)', bg: 'rgba(245, 185, 66, 0.14)' },
  RANGE: { label: 'RANGE', color: 'var(--state-critical)', bg: 'rgba(240, 71, 92, 0.14)' },
  FAULT: { label: 'FAULT', color: 'var(--state-critical)', bg: 'rgba(240, 71, 92, 0.14)' },
  ERR: { label: 'ERR', color: 'var(--state-critical)', bg: 'rgba(240, 71, 92, 0.14)' },
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
  onClick,
}) {
  const chipUpper = (chip || '').toUpperCase()
  const chipMeta = CHIP_META[chipUpper] || (chip ? { label: chipUpper, color, bg: `${color}1a` } : null)
  const isValueMissing = value == null || value === '' || value === '--'

  return (
    <div
      className={styles.metricCard}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className={styles.metricTop}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon ? (
            <span className={styles.metricIcon}>
              <Icon size={16} color={color} />
            </span>
          ) : null}
          <span className={styles.metricTitle}>{title}</span>
        </div>

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
          <span style={{ color }}>{value}</span>
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
