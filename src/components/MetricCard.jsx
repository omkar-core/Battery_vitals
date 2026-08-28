import styles from './components.module.css'

export default function MetricCard({ title, value, unit, color = '#00E8A0' }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricTitle}>{title}</div>
      <div className={styles.metricValue}>
        {value ?? '--'}
        {unit ? <span className={styles.metricUnit} style={{ color }}>{unit}</span> : null}
      </div>
    </div>
  )
}
