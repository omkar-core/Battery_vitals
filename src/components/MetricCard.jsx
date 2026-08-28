import styles from './components.module.css'

export default function MetricCard({ title, value, unit, icon, color = '#00E8A0', sub }) {
  return (
    <div className={styles.metricCard}>
      {icon && (
        <div className={styles.metricIcon} style={{ color }}>
          {icon}
        </div>
      )}
      <div className={styles.metricTitle}>{title}</div>
      <div className={styles.metricValue}>
        {value ?? '--'}
        {unit ? <span className={styles.metricUnit} style={{ color }}>{unit}</span> : null}
      </div>
      {sub ? <div className={styles.metricSub} style={{ color }}>{sub}</div> : null}
    </div>
  )
}
