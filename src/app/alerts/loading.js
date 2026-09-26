export default function AlertsLoading() {
  return (
    <div style={{
      maxWidth: 1400,
      margin: '0 auto',
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ height: 40, width: 220, borderRadius: 8, background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          height: 80,
          borderRadius: 12,
          background: 'var(--bg-surface-raised)',
          border: '1px solid var(--border-subtle)',
          animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
