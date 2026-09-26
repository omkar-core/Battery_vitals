export default function ValidationLoading() {
  return (
    <div style={{
      maxWidth: 1200,
      margin: '0 auto',
      padding: '32px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ height: 40, width: 300, borderRadius: 8, background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 60, borderRadius: 12, background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', animation: 'pulse 1.5s ease-in-out 0.1s infinite' }} />
      <div style={{ height: 400, borderRadius: 12, background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', animation: 'pulse 1.5s ease-in-out 0.2s infinite' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            height: 120,
            borderRadius: 12,
            background: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            animation: `pulse 1.5s ease-in-out ${(i + 3) * 0.1}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
