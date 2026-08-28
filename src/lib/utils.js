export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '--'
  return Number(value).toFixed(digits)
}

export function formatTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toLocaleTimeString()
}

export function formatDateTime(ts) {
  if (!ts) return '--'
  const d = new Date(ts)
  return d.toLocaleString()
}

export function timeAgo(ts) {
  if (!ts) return '--'
  const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000))
  if (diff < 5) return 'just now'
  if (diff < 60) return diff + 's ago'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

export function safetyColor(safety) {
  const s = (safety || 'SAFE').toUpperCase()
  if (s === 'EMERGENCY' || s === 'CRITICAL') return '#FF2D55'
  if (s === 'WARNING') return '#FF6B35'
  if (s === 'CAUTION') return '#FFD60A'
  return '#00E8A0'
}

export function safetyLabel(safety) {
  const s = (safety || 'SAFE')
  return s.charAt(0) + s.slice(1).toLowerCase()
}

export function bhiStatus(bhi) {
  if (bhi == null) return { label: 'Unknown', color: '#94A3B8' }
  if (bhi > 75) return { label: 'Critical', color: '#FF2D55' }
  if (bhi > 55) return { label: 'Warning', color: '#FF6B35' }
  if (bhi > 30) return { label: 'Caution', color: '#FFD60A' }
  return { label: 'Good', color: '#00E8A0' }
}
