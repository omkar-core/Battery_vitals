// ===== DATA FETCH =====
async function fetchTelemetry() {
  try {
    const resp = await fetch(CFG.apiBase + '/telemetry?t=' + Date.now(), { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    
    state.serverConnected = true;
    state.totalRequests++;
    
    // Check if we got valid data
    if (data.message === 'No data yet') {
      state.lastDataTs = state.lastDataTs || Date.now();
      return;
    }
    
    state.lastDataTs = Date.now();
    processTelemetry(data);
  } catch (e) {
    state.errors++;
    state.serverConnected = false;
    

  }
}

// ===== SAVE TO MONGODB =====
async function saveToMongoDB(data) {
  if (!CFG.useMongoDB || !state.serverConnected) return;
  try {
    await fetch(CFG.apiBase + '/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.log('MongoDB save failed:', e.message);
  }
}

function startFetchLoop() {
  if (state.fetchTimer) clearInterval(state.fetchTimer);
  fetchTelemetry();
  state.fetchTimer = setInterval(fetchTelemetry, CFG.pollInterval);
}

// ===== PROCESS TELEMETRY =====
function processTelemetry(d) {
  state.lastData = d;

  const bhi = d.risk?.bhi ?? null;
  updateBHIGauge(bhi);

  const safety = d.battery?.safety ?? 'SAFE';
  updateSafetyBadge(safety);

  updateVal('gasVal', d.gas?.index_mq2);
  updateVal('qGas', d.gas?.index_mq2);
  setText('gasStatusText', d.gas?.status_mq2 ?? '--');
  updateGasBar(d.gas?.index_mq2);
  const warmDone = d.gas?.warm ?? false;
  const vocBadge = document.getElementById('vocBadge');
  if (warmDone) { vocBadge.textContent = 'Live'; vocBadge.style.cssText = 'background:rgba(0,232,160,0.1);color:var(--emerald);border:1px solid rgba(0,232,160,0.1)'; }
  else { vocBadge.textContent = 'Warming'; vocBadge.style.cssText = 'background:rgba(255,214,10,0.1);color:var(--yellow);border:1px solid rgba(255,214,10,0.1)'; }
  setText('vocWarm', warmDone ? 'Ready' : 'Heating...');

  updateVal('vocVal', d.gas?.index_mq135);
  updateVal('qVoc', d.gas?.index_mq135);
  updateVocStatus(d.gas?.index_mq135);

  const temp = d.environment?.temperature;
  const humid = d.environment?.humidity;
  if (temp != null) {
    const tv = state.tempUnit === 'F' ? temp * 9 / 5 + 32 : temp;
    updateVal('tempVal', tv);
    updateVal('qTemp', state.tempUnit === 'F' ? tv : temp);
    updateTempStatus(temp);
  }
  if (humid != null) {
    updateVal('humidVal', humid);
    updateVal('qHumid', humid);
    updateHumidStatus(humid);
  }

  const volt = d.battery?.voltage;
  const curr = d.battery?.current;
  const power = d.battery?.power;
  const soc = d.battery?.soc;
  const op = d.battery?.op;
  const ir = d.battery?.resistance;

  updateVal('voltVal', volt);
  updateVal('qVolt', volt);
  updateVal('currVal', curr);
  updateVal('qCurr', curr);
  updateVal('powerVal', power);
  updateVal('irVal', ir);

  if (volt != null && curr != null) {
    setText('powerCalc', '= ' + n(volt) + 'V x ' + n(curr) + 'A');
    const pw = power ?? (volt * curr);
    document.getElementById('qPower').textContent = n(pw) + ' W';
  }

  updateSOC(soc);
  updateDirection(op);

  if (volt != null) updateVoltStatus(volt);
  if (curr != null) updateCurrStatus(curr);
  if (ir != null) updateIRStatus(ir);

  const rssi = d.network?.rssi;
  const ip = d.network?.ip;
  const heap = d.network?.heap;
  const reqs = d.network?.requests;
  setText('rssiDisplay', rssi != null ? rssi + ' dBm' : '--');
  setText('ddRssi', rssi != null ? rssi + ' dBm' : '--');
  setText('sysMiniRssi', rssi ?? '--');
  setText('sysRssi', rssi != null ? rssi + ' dBm' : '--');
  setText('sysMiniIp', ip ?? '--');
  setText('sysIp', ip ?? '--');
  setText('ddIp', ip ?? '--');
  setText('diIp', ip ?? '--');
  if (heap != null) {
    const hkb = (heap / 1024).toFixed(0);
    setText('sysMiniHeap', hkb);
    setText('sysHeap', hkb + ' KB');
    setText('ddHeap', hkb + ' KB');
  }
  setText('sysMiniPackets', reqs ?? state.totalRequests);
  setText('sysRequests', reqs ?? state.totalRequests);
  setText('sysErrors', d.errors ?? state.errors);
  setText('errorCount', d.errors ?? state.errors);
  setText('sysFirmware', d.firmware ?? '--');
  setText('diFw', d.firmware ?? '--');
  setText('diMac', d.mac ?? '--');
  setText('diUptime', d.uptime ?? fmtTime(state.uptimeSec));

  if (d.outputs) {
    const auto = d.outputs.auto;
    if (auto !== undefined && auto !== state.autoMode) {
      state.autoMode = !!auto;
      renderAutoMode();
    }
    ['green', 'yellow', 'red', 'buzzer'].forEach(k => {
      if (d.outputs[k] !== undefined) {
        const on = !!d.outputs[k];
        state.ledStates[k] = on;
        renderLED(k, on);
      }
    });
  }

  updateDots(d);

  const snap = {
    time: new Date().toISOString(), bhi: bhi ?? 0,
    gas: d.gas?.index_mq2 ?? 0, voc: d.gas?.index_mq135 ?? 0,
    temp: d.environment?.temperature ?? 0, humid: d.environment?.humidity ?? 0,
    volt: volt ?? 0, curr: curr ?? 0, power: power ?? 0, soc: soc ?? 0,
  };
  state.history.push(snap);
  if (state.history.length > CFG.maxHistory) state.history.shift();
  if (!state.chartPaused && mainChart) updateCharts();
  updateSparkline();
  if (historyChartInstance) updateHistoryChart();
  // Phase 1 enhancements
  updateSOHGauge(d.battery?.soh ?? d.soh);
  updateSensorConf('confVoltage', d.battery?.voltageSt || d.sensorStatus?.voltage);
  updateSensorConf('confTemp', d.environment?.tempSt || d.sensorStatus?.temperature);
  updateSensorConf('confGas', d.gas?.status_mq2 || d.sensorStatus?.gas);
  updateSensorConf('confVoc', d.gas?.status_mq135 || d.sensorStatus?.voc);
  updateSensorConf('confBhi', d.risk?.bhiSt || d.sensorStatus?.bhi);
  updateRiskLine(d);
  updateDeepDischarge(d);
  updateWarmup(d);
  updateProfileChips(d);
  updateDataLoss(d);

  checkSafetyChange(safety, bhi, d);

  updateCostSustainability(d);

  if (typeof Diagnostics !== 'undefined' && typeof Diagnostics.pushRawLog === 'function') {
    Diagnostics.pushRawLog();
  }

  // Live re-render of page-specific views when their page is active
  const currentPage = window.location.hash.replace('#', '');
  if (currentPage === 'diagnostics' && typeof Diagnostics !== 'undefined' && typeof Diagnostics.updateConnectivity === 'function') {
    Diagnostics.updateConnectivity();
  }
  if (currentPage === 'passport' && typeof Passport !== 'undefined' && typeof Passport.loadData === 'function') {
    Passport.loadData();
    if (typeof Passport.initDegradationChart === 'function') Passport.initDegradationChart();
  }
  if (currentPage === 'history' && historyChartInstance) { updateHistoryStats(); updateHistoryChart(); }

  if (d.events && Array.isArray(d.events)) {
    d.events.forEach(ev => {
      if (!state.alertLog.find(a => a.id === ev.id)) {
        state.alertLog.unshift(ev);
      }
    });
    if (state.alertLog.length > 200) state.alertLog = state.alertLog.slice(0, 200);
    renderAlerts();
    saveAlertLog();
  }
}

// ===== BHI GAUGE =====
function updateBHIGauge(score) {
  const s = Math.min(100, Math.max(0, score ?? 0));
  const circ = 2 * Math.PI * 88;
  const offset = circ - (s / 100) * circ;
  const arc = document.getElementById('bhiArc');
  arc.setAttribute('stroke-dashoffset', offset);
  let sc = '#00FF88';
  if (s > 75) sc = '#FF2D55';
  else if (s > 55) sc = '#FF6B35';
  else if (s > 30) sc = '#FFD60A';
  arc.setAttribute('stroke', sc);
  document.getElementById('bhiScore').textContent = score != null ? Math.round(s) : '--';
}

function updateSafetyBadge(safety) {
  const badge = document.getElementById('safetyBadge');
  const txt = document.getElementById('safetyText');
  const s = (safety || 'SAFE').toUpperCase();
  badge.textContent = s;
  let cls = 'safe', col = 'var(--green)';
  if (s === 'EMERGENCY' || s === 'CRITICAL') { cls = 'critical'; col = 'var(--red)'; }
  else if (s === 'WARNING') { cls = 'warning'; col = 'var(--orange)'; }
  else if (s === 'CAUTION') { cls = 'caution'; col = 'var(--yellow)'; }
  badge.className = 'safety-badge ' + cls;
  txt.textContent = s.charAt(0) + s.slice(1).toLowerCase();
  txt.style.color = col;
}

// ===== STATUS HELPERS =====
function updateGasBar(v) {
  if (v == null) return;
  const pct = Math.min(100, (v / 5000) * 100);
  const bar = document.getElementById('gasBar');
  bar.style.width = pct + '%';
  let c = 'green', st = 'Normal', sc = 'green';
  if (v > 4000) { c = 'red'; st = 'Critical'; sc = 'red'; }
  else if (v > 2000) { c = 'red'; st = 'High'; sc = 'red'; }
  else if (v > 1000) { c = 'orange'; st = 'Moderate'; sc = 'orange'; }
  else if (v > 500) { c = 'yellow'; st = 'Low Detection'; sc = 'yellow'; }
  bar.className = 'progress-fill ' + c;
  const pill = document.getElementById('gasStatus');
  pill.className = 'status-pill ' + sc; pill.textContent = st;
}

function updateVocStatus(v) {
  if (v == null) return;
  let s = 'Normal', c = 'green';
  if (v > 400) { s = 'Critical'; c = 'red'; }
  else if (v > 200) { s = 'High'; c = 'orange'; }
  else if (v > 100) { s = 'Elevated'; c = 'yellow'; }
  const p = document.getElementById('vocStatus');
  if (p) { p.className = 'status-pill ' + c; p.textContent = s; }
}

function updateTempStatus(t) {
  let s = 'Normal', c = 'green';
  if (t > 50) { s = 'Dangerous'; c = 'red'; }
  else if (t > 40) { s = 'Elevated'; c = 'orange'; }
  else if (t > 35) { s = 'Warm'; c = 'yellow'; }
  const p = document.getElementById('tempStatus');
  p.className = 'status-pill ' + c; p.textContent = s;
}

function updateHumidStatus(h) {
  let s = 'Optimal', c = 'green';
  if (h > 85) { s = 'High Moisture'; c = 'red'; }
  else if (h > 75) { s = 'Elevated'; c = 'yellow'; }
  else if (h < 30) { s = 'Low / Dry'; c = 'yellow'; }
  const p = document.getElementById('humidStatus');
  p.className = 'status-pill ' + c; p.textContent = s;
}

function updateVoltStatus(v) {
  let s = 'Normal', c = 'green';
  const nom = parseFloat(document.getElementById('setNomVolt')?.value) || 12.6;
  if (v > nom * 1.1) { s = 'High'; c = 'orange'; }
  else if (v < nom * 0.85) { s = 'Low'; c = 'red'; }
  const p = document.getElementById('voltStatus');
  p.className = 'status-pill ' + c; p.textContent = s;
}

function updateCurrStatus(c) {
  let s = 'Normal', cl = 'green';
  if (Math.abs(c) > 4) { s = 'Over-current'; cl = 'red'; }
  else if (Math.abs(c) > 3) { s = 'High'; cl = 'orange'; }
  const p = document.getElementById('currStatus');
  p.className = 'status-pill ' + cl; p.textContent = s;
}

function updateIRStatus(ir) {
  let s = 'Good', c = 'green';
  if (ir > 40) { s = 'Critical'; c = 'red'; }
  else if (ir > 30) { s = 'Poor'; c = 'orange'; }
  else if (ir > 20) { s = 'Degrading'; c = 'yellow'; }
  const p = document.getElementById('irStatus');
  p.className = 'status-pill ' + c; p.textContent = s;
}

function updateSOC(soc) {
  const fill = document.getElementById('heroFill');
  const pct = document.getElementById('heroPct');
  if (soc == null) { if (pct) pct.textContent = '--%'; return; }
  const v = Math.min(100, Math.max(0, soc));
  const cls = v > 60 ? 'green' : v > 30 ? 'yellow' : v > 15 ? 'orange' : 'red';
  const col = v > 60 ? 'var(--emerald)' : v > 30 ? 'var(--yellow)' : v > 15 ? 'var(--orange)' : 'var(--red)';
  if (fill) { fill.style.width = v + '%'; fill.className = 'batt-fill ' + cls; }
  if (pct) { pct.textContent = Math.round(v) + '%'; pct.style.color = col; }
}

function updateDirection(op) {
  const el = document.getElementById('qDirection');
  const el2 = document.getElementById('opDirection');
  if (!el) return;
  const o = (op || 'IDLE').toUpperCase();
  el.textContent = o.charAt(0) + o.slice(1).toLowerCase();
  if (el2) el2.textContent = o.charAt(0) + o.slice(1).toLowerCase();
  el.className = 'pf-status ' + (o === 'CHARGING' ? 'charging' : o === 'DISCHARGING' ? 'discharging' : 'idle');
}

function updateDots(d) {
  const setDot = (id, val, warnThresh, critThresh) => {
    const el = document.getElementById(id);
    if (!el || val == null) return;
    let c = 'green';
    if (Math.abs(val) > critThresh) c = 'red';
    else if (Math.abs(val) > warnThresh) c = 'orange';
    el.className = 'dot ' + c;
  };
  setDot('dotGas', d.gas?.index_mq2, 1000, 2000);
  setDot('dotVoc', d.gas?.index_mq135, 100, 200);
  setDot('dotTemp', d.environment?.temperature, 35, 45);
  setDot('dotHumid', d.environment?.humidity, 75, 85);
  setDot('dotVolt', d.battery?.voltage, 14, 15);
  setDot('dotCurr', d.battery?.current, 3, 4);
}

// ===== SPARKLINE =====
function updateSparkline() {
  const c = document.getElementById('bhiSparkline');
  if (!c || state.history.length < 2) return;
  const ctx = c.getContext('2d');
  c.width = c.parentElement?.clientWidth || 120; c.height = 32;
  ctx.clearRect(0, 0, c.width, c.height);
  const d = state.history.slice(-20).map(x => x.bhi);
  const mn = Math.min(...d), mx = Math.max(...d), r = mn === mx ? 1 : mx - mn;
  ctx.beginPath();
  ctx.strokeStyle = document.getElementById('bhiArc')?.getAttribute('stroke') || '#00FF88';
  ctx.lineWidth = 2;
  d.forEach((v, i) => {
    const x = i / (d.length - 1) * c.width;
    const y = c.height - 4 - ((v - mn) / r) * (c.height - 8);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ===== SOH GAUGE =====
function updateSOHGauge(score) {
  const s = Math.min(100, Math.max(0, score ?? 0));
  const circ = 2 * Math.PI * 88;
  const offset = circ - (s / 100) * circ;
  const arc = document.getElementById('sohArc');
  if (!arc) return;
  arc.setAttribute('stroke-dashoffset', offset);
  let sc = '#00BFFF';
  if (s < 50) sc = '#FF2D55';
  else if (s < 70) sc = '#FF6B35';
  else if (s < 85) sc = '#FFD60A';
  arc.setAttribute('stroke', sc);
  document.getElementById('sohScore').textContent = score != null ? Math.round(s) : '--';
}

// ===== SENSOR CONFIDENCE CHIPS =====
function updateSensorConf(chipId, status) {
  const chip = document.getElementById(chipId);
  if (!chip) return;
  const dot = chip.querySelector('.conf-dot');
  if (!dot) return;
  const s = (status || 'ok').toLowerCase();
  dot.className = 'conf-dot ' + (s === 'ok' ? 'ok' : s === 'warm' ? 'warm' : s === 'nc' || s === 'none' ? 'nc' : s === 'stuck' ? 'stuck' : 'err');
}

// ===== DOMINANT RISK LINE =====
function updateRiskLine(d) {
  const risk = d.risk || {};
  const dominant = risk.dominant || risk.riskFactor || '';
  const el = document.getElementById('riskDominant');
  const icon = document.querySelector('.risk-line .risk-icon');
  if (!el) return;
  
  const bhi = risk.bhi ?? 0;
  if (dominant) {
    el.textContent = dominant;
  } else if (bhi > 75) {
    el.textContent = 'Critical hazard detected — immediate action required';
  } else if (bhi > 55) {
    el.textContent = 'Warning: elevated risk — monitor closely';
  } else if (bhi > 30) {
    el.textContent = 'Caution: minor anomalies detected';
  } else {
    el.textContent = 'All systems nominal — no active risk factors';
  }
  
  if (icon) {
    const c = bhi > 75 ? 'var(--red)' : bhi > 55 ? 'var(--orange)' : bhi > 30 ? 'var(--yellow)' : 'var(--green)';
    icon.style.color = c;
  }
}

// ===== DEEP DISCHARGE BANNER =====
function updateDeepDischarge(d) {
  const ddLock = d.battery?.ddLock || d.ddLock || false;
  const el = document.getElementById('deepDischargeBanner');
  if (el) el.style.display = ddLock ? 'flex' : 'none';
}

// ===== WARMUP BANNER =====
function updateWarmup(d) {
  const warm = d.gas?.warm !== false;
  const wRem = d.gas?.wRem ?? 0;
  const el = document.getElementById('warmupBanner');
  const fill = document.getElementById('warmupFill');
  const time = document.getElementById('warmupTime');
  if (!el) return;
  
  if (!warm && wRem > 0) {
    el.style.display = 'flex';
    const totalWarmup = 180;
    const pct = Math.max(0, Math.min(100, ((totalWarmup - wRem) / totalWarmup) * 100));
    if (fill) fill.style.width = pct + '%';
    if (time) time.textContent = wRem + 's';
  } else {
    el.style.display = 'none';
  }
}

// ===== PROFILE & MODE CHIPS =====
function updateProfileChips(d) {
  const profile = d.battery?.profile || d.profile || '--';
  const op = d.battery?.op || 'IDLE';
  const phase = d.battery?.phase || 'none';
  const energy = d.energy ?? d.battery?.energyWh ?? null;
  
  const profileEl = document.getElementById('batteryProfile');
  const opEl = document.getElementById('operatingMode');
  const phaseEl = document.getElementById('batteryPhase');
  const energyEl = document.getElementById('energyTotal');
  
  if (profileEl) profileEl.textContent = profile.replace('_', ' ');
  if (opEl) opEl.textContent = op.charAt(0) + op.slice(1).toLowerCase();
  if (phaseEl) phaseEl.textContent = phase !== 'none' ? phase.replace('_', ' ') : '--';
  if (energyEl) energyEl.textContent = energy != null ? energy.toFixed(1) + ' Wh' : '-- Wh';
}

// ===== DATA LOSS & API LATENCY =====
function updateDataLoss(d) {
  setText('sysDataLoss', d.dataLoss ?? 0);
  setText('sysApiLatency', d.apiLatency != null ? d.apiLatency + ' ms' : '-- ms');
}

// ===== COST & SUSTAINABILITY =====
const COST_PER_KWH = 0.12; // $/kWh — adjust as needed
const CO2_FACTOR = 0.5; // kg CO2 per kWh

function updateCostSustainability(d) {
  if (!d) return;
  const wh = d.energy ?? d.battery?.energyWh ?? 0;
  const cost = (wh / 1000) * COST_PER_KWH;
  const co2 = (wh / 1000) * CO2_FACTOR * 1000; // grams
  setText('costTotal', '$' + cost.toFixed(2));
  setText('energySession', wh.toFixed(1) + ' Wh');
  setText('co2Total', co2.toFixed(0) + ' g');
}
