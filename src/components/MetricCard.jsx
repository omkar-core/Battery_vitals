import styles from './components.module.css'

const CHIP_META = {
  OK: { label: 'OK', color: '#00E8A0', bg: 'rgba(0, 232, 160, 0.12)' },
  WARM: { label: 'WARM', color: '#FFD60A', bg: 'rgba(255, 214, 10, 0.12)' },
  N_C: { label: 'N/C', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)' },
  STUCK: { label: 'STUCK', color: '#FF6B35', bg: 'rgba(255, 107, 53, 0.14)' },
  RANGE: { label: 'RANGE', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.14)' },
  FAULT: { label: 'FAULT', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.14)' },
  ERR: { label: 'ERR', color: '#FF2D55', bg: 'rgba(255, 45, 85, 0.14)' },
}

export default function MetricCard({
  title,
  value,
  unit,
  color = '#00E8A0',
  icon: Icon,
  chip,
  delta,
  subtext,
  onClick,
}) {
  const chipUpper = (chip || '').toUpperCase()
  const chipMeta = CHIP_META[chipUpper] || (chip ? { label: chipUpper, color, bg: `${color}1a` } : null)

  return (
    <div
      className={styles.metricCard}
      style={{ '--glow': color, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className={styles.metricTop}>
        <span className={styles.metricTitle}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {chipMeta ? (
            <span
              className="chip"
              style={{
                background: chipMeta.bg,
                borderColor: `${chipMeta.color}44`,
                color: chipMeta.color,
                padding: '2px 7px',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {chipMeta.label}
            </span>
          ) : null}
          {Icon ? (
            <span className={styles.metricIcon}>
              <Icon size={14} color={color} />
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.metricValue} style={{ color }}>
        {value ?? '--'}
        {unit ? <span className={styles.metricUnit}>{unit}</span> : null}
      </div>

      {(delta != null || subtext) && (
        <div className={styles.metricSub}>
          {delta != null ? (
            <span className={styles.metricDelta} style={{ color: delta >= 0 ? '#00E8A0' : '#FF2D55' }}>
              {delta >= 0 ? '▲ +' : '▼ '}
              {typeof delta === 'number' ? delta.toFixed(1) : delta}
            </span>
          ) : null}
          {subtext && <span style={{ color: 'var(--text-muted)' }}>{subtext}</span>}
        </div>
      )}
    </div>
  )
}
