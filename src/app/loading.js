export default function DashboardLoading() {
  return (
    <div style={{
      maxWidth: 1400,
      margin: '0 auto',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{
        height: 48,
        borderRadius: 12,
        background: 'var(--bg-surface-raised)',
        border: '1px solid var(--border-subtle)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            height: 160,
            borderRadius: 12,
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
          }} />
        ))}
      </div>
      <div style={{
        height: 300,
        borderRadius: 12,
        background: 'var(--bg-surface-raised)',
        border: '1px solid var(--border-subtle)',
        animation: 'pulse 1.5s ease-in-out 0.6s infinite',
      }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
