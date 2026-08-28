export function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '--'
  return Number(value).toFixed(digits)
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
