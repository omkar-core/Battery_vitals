import { Bell } from 'lucide-react'
import styles from './components.module.css'

const SEVERITY_COLOR = {
  CRITICAL: '#FF2D55',
  EMERGENCY: '#FF2D55',
  WARNING: '#FF6B35',
  CAUTION: '#FFD60A',
  INFO: '#00BFFF',
  SAFE: '#00E8A0',
}

export default function AlertsList({ alerts = [], loading }) {
  return (
    <div className={styles.alertsCard}>
      <div className={styles.aiHeader}>
        <Bell size={16} color="#FFD60A" />
        <h3 className={styles.panelTitle}>Alerts</h3>
      </div>

      {alerts.length === 0 ? (
        <div className={styles.aiEmpty}>
          {loading ? 'Loading alerts...' : 'No alerts recorded. System is monitoring.'}
        </div>
      ) : (
        <div className={styles.alertsList}>
          {alerts.map((a) => {
            const color = SEVERITY_COLOR[(a.severity || 'INFO').toUpperCase()] || '#94A3B8'
            return (
              <div key={a.id} className={styles.alertItem}>
                <span className={styles.alertSeverity} style={{ background: color }} />
                <div className={styles.alertBody}>
                  <div className={styles.alertTop}>
                    <span className={styles.alertType} style={{ color }}>{a.severity || 'INFO'}</span>
                    <span className={styles.alertTime}>{a.time ? new Date(a.time).toLocaleTimeString() : '--'}</span>
                  </div>
                  <div className={styles.alertMsg}>{a.message || a.type || 'Alert'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
