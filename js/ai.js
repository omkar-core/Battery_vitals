// ===== GEMINI AI ANALYSIS =====

async function analyzeWithGemini() {
  const btn = document.getElementById('aiAnalyzeBtn');
  const btnText = document.getElementById('aiBtnText');
  const loading = document.getElementById('aiLoading');
  const empty = document.getElementById('aiEmpty');
  const result = document.getElementById('aiResult');

  // Get form data
  const data = {
    voltage: parseFloat(document.getElementById('aiVoltage').value) || 0,
    current: parseFloat(document.getElementById('aiCurrent').value) || 0,
    temperature: parseFloat(document.getElementById('aiTemp').value) || 0,
    humidity: parseFloat(document.getElementById('aiHumidity').value) || 0,
    gasMq2: parseFloat(document.getElementById('aiGasMq2').value) || 0,
    gasMq135: parseFloat(document.getElementById('aiGasMq135').value) || 0,
    soc: parseFloat(document.getElementById('aiSoc').value) || 0,
    safety: document.getElementById('aiSafety').value || 'SAFE',
    resistance: parseFloat(document.getElementById('aiResistance').value) || 0,
    bhi: parseFloat(document.getElementById('aiBhi').value) || 0,
    power: parseFloat(document.getElementById('aiPower').value) || 0,
    opDirection: document.getElementById('aiDirection').value || 'IDLE',
    batteryId: state?.lastData?.batteryId || 'BAT001'
  };

  // Show loading
  btn.disabled = true;
  btnText.textContent = 'Analyzing...';
  loading.style.display = 'block';
  empty.style.display = 'none';
  result.style.display = 'none';

  try {
    const resp = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30000)
    });

    const res = await resp.json();

    if (res.success && res.prediction) {
      renderAIResult(res.prediction, data);
    } else {
      showToast('AI Error: ' + (res.error || 'Unknown error'), 'error');
      empty.style.display = 'block';
    }
  } catch (e) {
    showToast('Failed to connect to Gemini AI: ' + e.message, 'error');
    empty.style.display = 'block';
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Analyze with Gemini AI';
    loading.style.display = 'none';
  }
}

function renderAIResult(pred, inputData) {
  const el = document.getElementById('aiResult');
  const danger = (pred.danger_level || 'safe').toLowerCase();
  const health = (pred.health || 'unknown').toLowerCase();

  const dangerColors = {
    safe: '#00FF88',
    warning: '#FFD60A',
    danger: '#FF2D55'
  };
  const healthColors = {
    excellent: '#00FF88',
    good: '#00BFFF',
    warning: '#FFD60A',
    critical: '#FF6B35',
    failure: '#FF2D55'
  };

  const dc = dangerColors[danger] || '#8899B4';
  const hc = healthColors[health] || '#8899B4';

  el.style.display = 'block';
  el.innerHTML = `
    <div style="margin-top:16px;border:1px solid ${dc}33;border-radius:var(--radius-lg);overflow:hidden">
      <!-- Header Banner -->
      <div style="background:${dc}10;padding:16px 20px;text-align:center;border-bottom:1px solid ${dc}22">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Gemini AI Analysis</div>
        <div style="font-size:42px;font-weight:800;font-family:var(--mono);color:${dc};line-height:1">BHI: ${pred.bhi ?? '--'}</div>
        <div style="font-size:16px;font-weight:700;color:${dc};text-transform:uppercase;margin-top:4px">
          ${danger === 'danger' ? '&#128680; DANGER' : danger === 'warning' ? '&#9888; WARNING' : '&#9989; SAFE'}
        </div>
      </div>

      <!-- Results Grid -->
      <div style="padding:16px 20px;background:rgba(0,0,0,0.15)">
        <div class="ai-result-grid">
          <div class="ai-result-item">
            <div class="ai-ri-label">Health</div>
            <div class="ai-ri-value" style="color:${hc}">${health.toUpperCase()}</div>
          </div>
          <div class="ai-result-item">
            <div class="ai-ri-label">Thermal Runaway</div>
            <div class="ai-ri-value" style="color:${pred.thermal_runaway_risk ? '#FF2D55' : '#00FF88'}">
              ${pred.thermal_runaway_risk ? '&#9888; YES' : '&#10003; NO'}
            </div>
          </div>
          <div class="ai-result-item">
            <div class="ai-ri-label">Anomaly Detected</div>
            <div class="ai-ri-value" style="color:${pred.anomaly_detected ? '#FF2D55' : '#00FF88'}">
              ${pred.anomaly_detected ? '&#9888; YES' : '&#10003; NO'}
            </div>
          </div>
          <div class="ai-result-item">
            <div class="ai-ri-label">Remaining Life</div>
            <div class="ai-ri-value" style="color:var(--cyan)">${pred.remaining_cycles ?? '--'}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">~${pred.remaining_months ?? '--'} months</div>
          </div>
        </div>

        <!-- Explanation -->
        <div style="margin-top:12px;padding:14px;border-radius:var(--radius-sm);background:rgba(124,58,237,0.06);border-left:3px solid var(--purple)">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">&#129504; AI Explanation</div>
          <div style="font-size:13px;color:var(--text-primary);line-height:1.6">${pred.explanation || 'No explanation provided.'}</div>
        </div>

        <!-- Action -->
        <div style="margin-top:10px;padding:14px;border-radius:var(--radius-sm);background:${dc}08;border:1px solid ${dc}22">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">&#128203; Recommended Action</div>
          <div style="font-size:15px;font-weight:700;color:${dc}">${pred.action || 'No action required.'}</div>
        </div>

        <!-- Input Summary -->
        <div style="margin-top:12px;padding:10px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Analyzed Data</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:11px;font-family:var(--mono);color:var(--text-secondary)">
            <span>V: ${inputData.voltage}V</span>
            <span>A: ${inputData.current}A</span>
            <span>T: ${inputData.temperature}&#176;C</span>
            <span>SOC: ${inputData.soc}%</span>
            <span>Gas: ${inputData.gasMq2}</span>
            <span>BHI: ${inputData.bhi}</span>
          </div>
        </div>

        <!-- Timestamp -->
        <div style="margin-top:10px;font-size:10px;color:var(--text-muted);text-align:right">
          Analyzed at ${new Date().toLocaleTimeString()} via Gemini 2.0 Flash
        </div>
      </div>
    </div>
  `;
}

// ===== PRESET DATA =====
function fillDangerousData() {
  document.getElementById('aiVoltage').value = 11.2;
  document.getElementById('aiCurrent').value = 4.8;
  document.getElementById('aiTemp').value = 62;
  document.getElementById('aiHumidity').value = 78;
  document.getElementById('aiGasMq2').value = 2400;
  document.getElementById('aiGasMq135').value = 250;
  document.getElementById('aiSoc').value = 12;
  document.getElementById('aiSafety').value = 'CRITICAL';
  document.getElementById('aiResistance').value = 180;
  document.getElementById('aiBhi').value = 92;
  document.getElementById('aiPower').value = 53.76;
  document.getElementById('aiDirection').value = 'DISCHARGING';
  showToast('Dangerous data loaded -- click Analyze', 'info');
}

function fillLiveData() {
  if (state && state.lastData) {
    const d = state.lastData;
    if (d.battery?.voltage != null) document.getElementById('aiVoltage').value = d.battery.voltage;
    if (d.battery?.current != null) document.getElementById('aiCurrent').value = d.battery.current;
    if (d.environment?.temperature != null) document.getElementById('aiTemp').value = d.environment.temperature;
    if (d.environment?.humidity != null) document.getElementById('aiHumidity').value = d.environment.humidity;
    if (d.gas?.index_mq2 != null) document.getElementById('aiGasMq2').value = d.gas.index_mq2;
    if (d.gas?.index_mq135 != null) document.getElementById('aiGasMq135').value = d.gas.index_mq135;
    if (d.battery?.soc != null) document.getElementById('aiSoc').value = d.battery.soc;
    if (d.battery?.safety != null) document.getElementById('aiSafety').value = d.battery.safety;
    if (d.battery?.resistance != null) document.getElementById('aiResistance').value = d.battery.resistance;
    if (d.risk?.bhi != null) document.getElementById('aiBhi').value = d.risk.bhi;
    if (d.battery?.power != null) document.getElementById('aiPower').value = d.battery.power;
    if (d.battery?.op != null) document.getElementById('aiDirection').value = d.battery.op;
    showToast('Live data loaded -- click Analyze', 'info');
  } else {
    showToast('No live data available yet', 'error');
  }
}

// ===== LEGACY: n8n webhook result display =====
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
