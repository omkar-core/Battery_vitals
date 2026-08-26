function showAIResult(data) {
  const el = document.getElementById('aiResult');
  const empty = document.getElementById('aiEmpty');
  if (!el) return;
  empty.style.display = 'none';
  el.style.display = 'block';
  const risk = (data.risk_level || data.risk || 'low').toLowerCase();
  const rl = { low: 'LOW RISK', moderate: 'MODERATE RISK', high: 'HIGH RISK', critical: 'CRITICAL RISK' };
  const pred = data.prediction || data.analysis || '';
  const recs = data.recommendations || data.recommended_actions || [];
  el.innerHTML = '<div class="ai-result"><div class="timestamp">Analysis at ' + new Date().toLocaleTimeString() + '</div>' +
    '<div class="ai-risk-banner ' + risk + '">' + (rl[risk] || risk) + '</div>' +
    (pred ? '<div class="ai-prediction">' + pred + '</div>' : '') +
    (recs.length ? '<div class="ai-recs"><h4 style="font-size:12px;margin-bottom:6px">Recommendations:</h4><ul>' + recs.map(r => '<li>' + r + '</li>').join('') + '</ul></div>' : '') +
    '</div>';
}
