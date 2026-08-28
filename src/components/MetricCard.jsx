import styles from './components.module.css'

const CHIP_META = {
  OK: { label: 'OK', color: '#00E8A0' },
  WARM: { label: 'WARM', color: '#FFD60A' },
  N_C: { label: 'N/C', color: '#94A3B8' },
  STUCK: { label: 'STUCK', color: '#FF6B35' },
  RANGE: { label: 'RANGE', color: '#FF2D55' },
  ERR: { label: 'ERR', color: '#FF2D55' },
}

export default function MetricCard({ title, value, unit, color = '#00E8A0', icon: Icon, chip, delta }) {
  const chipMeta = CHIP_META[(chip || '').toUpperCase()]

  return (
    <div className={styles.metricCard} style={{ '--glow': color }}>
      <div className={styles.metricTop}>
        <span className={styles.metricTitle}>{title}</span>
        {Icon ? (
          <span className={styles.metricIcon}>
            <Icon size={14} color={color} />
          </span>
        ) : null}
      </div>
      <div className={styles.metricValue} style={{ color }}>
        {value ?? '--'}
        {unit ? <span className={styles.metricUnit}>{unit}</span> : null}
      </div>
      {(chip || delta) && (
        <div className={styles.metricSub}>
          {chipMeta ? (
            <span
              className="chip"
              style={{ background: `${chipMeta.color}1a`, borderColor: `${chipMeta.color}55`, color: chipMeta.color }}
            >
              {chipMeta.label}
            </span>
          ) : null}
          {delta != null ? (
            <span className={styles.metricDelta} style={{ color: delta >= 0 ? '#00E8A0' : '#FF2D55' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
