'use client'

import styles from './components.module.css'

export function SkeletonBox({ width = '100%', height = '20px', borderRadius = '8px', className = '' }) {
  return (
    <div
      className={`${styles.skeleton} ${className}`}
      style={{ width, height, borderRadius }}
      aria-hidden="true"
    />
  )
}

export function SkeletonMetric() {
  return (
    <div className={styles.skeletonMetricCard}>
      <div className={styles.skeletonTop}>
        <SkeletonBox width="80px" height="12px" />
        <SkeletonBox width="28px" height="28px" borderRadius="8px" />
      </div>
      <SkeletonBox width="110px" height="32px" borderRadius="6px" style={{ margin: '8px 0' }} />
      <SkeletonBox width="130px" height="10px" />
    </div>
  )
}

export function SkeletonChart({ height = 280 }) {
  return (
    <div className={styles.skeletonCard} style={{ minHeight: height }}>
      <div className={styles.skeletonHeader}>
        <SkeletonBox width="140px" height="16px" />
        <SkeletonBox width="80px" height="24px" borderRadius="100px" />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: height - 80, paddingTop: '20px' }}>
        {[40, 65, 30, 85, 55, 70, 90, 45, 60, 75].map((h, i) => (
          <SkeletonBox key={i} width="100%" height={`${h}%`} borderRadius="4px" />
        ))}
      </div>
    </div>
  )
}

export function SkeletonControl() {
  return (
    <div className={styles.skeletonCard}>
      <SkeletonBox width="160px" height="18px" style={{ marginBottom: '16px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SkeletonBox width="100%" height="40px" borderRadius="10px" />
        <SkeletonBox width="100%" height="40px" borderRadius="10px" />
        <SkeletonBox width="100%" height="40px" borderRadius="10px" />
      </div>
    </div>
  )
}

export function SkeletonAI() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonHeader}>
        <SkeletonBox width="180px" height="18px" />
        <SkeletonBox width="90px" height="28px" borderRadius="8px" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <SkeletonBox width="100%" height="50px" borderRadius="10px" />
        <SkeletonBox width="90%" height="16px" />
        <SkeletonBox width="95%" height="16px" />
        <SkeletonBox width="80%" height="16px" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className={styles.skeletonCard}>
      <SkeletonBox width="200px" height="18px" style={{ marginBottom: '16px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <SkeletonBox width="25%" height="20px" />
            <SkeletonBox width="20%" height="20px" />
            <SkeletonBox width="30%" height="20px" />
            <SkeletonBox width="15%" height="20px" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SkeletonLoader({ type = 'card', ...props }) {
  switch (type) {
    case 'metric':
      return <SkeletonMetric {...props} />
    case 'chart':
      return <SkeletonChart {...props} />
    case 'control':
      return <SkeletonControl {...props} />
    case 'ai':
      return <SkeletonAI {...props} />
    case 'table':
      return <SkeletonTable {...props} />
    default:
      return <SkeletonMetric {...props} />
  }
}
