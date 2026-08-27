function checkSafetyChange(safety, bhi, d) {
  const prevSafety = state.lastSafety;
  const prevBhi = state.lastBhi;
  const bhiVal = Math.round(bhi ?? 0);
  let shouldAlert = false;

  // Alert on safety state change
  if (prevSafety && safety !== prevSafety) {
    shouldAlert = true;
  }

  // Alert on BHI crossing critical thresholds
  if (prevBhi !== undefined) {
    if ((prevBhi <= 75 && bhiVal > 75) || (prevBhi > 75 && bhiVal <= 75)) shouldAlert = true;
    if ((prevBhi <= 55 && bhiVal > 55) || (prevBhi > 55 && bhiVal <= 55)) shouldAlert = true;
    if ((prevBhi <= 30 && bhiVal > 30) || (prevBhi > 30 && bhiVal <= 30)) shouldAlert = true;
  }

  if (shouldAlert && prevSafety) {
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      severity: safety,
      bhi: bhiVal,
      message: prevSafety !== safety
        ? 'Safety state changed: ' + prevSafety + ' → ' + safety
        : 'BHI changed: ' + (state.lastBhi ?? '--') + ' → ' + bhiVal,
      gas: d.gas?.index_mq2 ?? 0,
      temp: d.environment?.temperature ?? 0,
      volt: d.battery?.voltage ?? 0,
    };
    state.alertLog.unshift(entry);
    if (state.alertLog.length > 200) state.alertLog.pop();
    saveAlertLog();
    renderAlerts();
    if (!isQuietHours()) updateAlertBell();
    if (state.soundEnabled) playAlert(safety);
  }
  state.lastSafety = safety;
  state.lastBhi = bhiVal;
}

function renderAlerts(filter) {
  const tbody = document.getElementById('alertTableBody');
  const cards = document.getElementById('alertCards');
  if (state.alertLog.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="alert-empty">No alerts recorded. System is monitoring...</td></tr>';
    cards.innerHTML = '<div class="alert-empty">No alerts recorded</div>';
    updateAlertPieChart(state.alertLog);
    return;
  }
  let items = state.alertLog;
  if (filter && filter !== 'all') items = items.filter(e => (e.severity || '').toUpperCase() === filter.toUpperCase());

  tbody.innerHTML = items.map((e, i) => {
    const sev = (e.severity || 'SAFE').toUpperCase();
    const col = sev === 'SAFE' ? 'var(--green)' : sev === 'CAUTION' ? 'var(--yellow)' : sev === 'WARNING' ? 'var(--orange)' : 'var(--red)';
    return '<tr class="alert-row" onclick="showAlertDetail(' + i + ')"><td>' + e.time + '</td><td><span class="sev-dot" style="background:' + col + '"></span>' + sev + '</td><td>' + (e.bhi ?? '--') + '</td><td>' + (e.message || '--') + '</td><td style="font-size:10px;color:var(--text-muted)">Gas:' + (e.gas ?? '--') + ' T:' + (e.temp ?? '--') + ' V:' + (e.volt ?? '--') + '</td></tr>';
  }).join('');

  cards.innerHTML = items.map((e, i) => {
    const sev = (e.severity || 'SAFE').toUpperCase();
    const col = sev === 'SAFE' ? 'var(--green)' : sev === 'CAUTION' ? 'var(--yellow)' : sev === 'WARNING' ? 'var(--orange)' : 'var(--red)';
    return '<div class="alert-card-item" onclick="this.classList.toggle(\'expanded\')"><div class="alert-card-top"><span class="sev-pill" style="background:' + col + '22;color:' + col + ';border:1px solid ' + col + '33">' + sev + '</span><span style="font-size:12px">' + (e.message || '--') + '</span><span class="time">' + e.time + '</span></div><div class="alert-card-detail">BHI: ' + (e.bhi ?? '--') + ' | Gas: ' + (e.gas ?? '--') + ' | Temp: ' + (e.temp ?? '--') + '\u00B0C | Volt: ' + (e.volt ?? '--') + 'V</div></div>';
  }).join('');
  updateAlertPieChart(state.alertLog);
}

function filterAlerts(filter, btn) {
  document.querySelectorAll('.alert-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAlerts(filter);
}

function showAlertDetail(idx) {
  const e = state.alertLog[idx];
  if (!e) return;
  document.getElementById('modalContent').innerHTML = '<h3>Alert Detail</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;font-size:13px">' +
    '<div><span style="color:var(--text-muted)">Time:</span> ' + e.time + '</div>' +
    '<div><span style="color:var(--text-muted)">Severity:</span> ' + e.severity + '</div>' +
    '<div><span style="color:var(--text-muted)">BHI:</span> ' + (e.bhi ?? '--') + '</div>' +
    '<div><span style="color:var(--text-muted)">Gas:</span> ' + (e.gas ?? '--') + '</div>' +
    '<div><span style="color:var(--text-muted)">Temp:</span> ' + (e.temp ?? '--') + '\u00B0C</div>' +
    '<div><span style="color:var(--text-muted)">Voltage:</span> ' + (e.volt ?? '--') + 'V</div>' +
    '<div style="grid-column:span 2"><span style="color:var(--text-muted)">Message:</span> ' + (e.message || '--') + '</div></div>';
  document.getElementById('modalOverlay').classList.add('show');
}

function exportAlertCSV() {
  if (state.alertLog.length === 0) { showToast('No alerts', 'error'); return; }
  let csv = 'Time,Severity,BHI,Message,Gas,Temp,Voltage\n';
  state.alertLog.forEach(e => { csv += e.time + ',' + e.severity + ',' + (e.bhi ?? '') + ',"' + (e.message ?? '') + '",' + (e.gas ?? '') + ',' + (e.temp ?? '') + ',' + (e.volt ?? '') + '\n'; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'battery_vital_alerts.csv'; a.click();
  showToast('Alerts CSV exported', 'success');
}

function clearAlertLog() {
  if (state.alertLog.length === 0 || !confirm('Clear all alert entries?')) return;
  state.alertLog = [];
  saveAlertLog();
  renderAlerts();
  showToast('Alert log cleared', 'info');
}

function saveAlertLog() { try { localStorage.setItem('bv_alerts', JSON.stringify(state.alertLog.slice(0, 200))); } catch (e) {} }
function loadAlertLog() { try { const d = localStorage.getItem('bv_alerts'); if (d) { state.alertLog = JSON.parse(d); renderAlerts(); } } catch (e) {} }

function playAlert(severity) {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine';
    const s = (severity || '').toUpperCase();
    if (s === 'CRITICAL' || s === 'EMERGENCY') { osc.frequency.value = 1000; gain.gain.value = 0.4; osc.start(); osc.stop(ctx.currentTime + 0.5); }
    else if (s === 'WARNING') { osc.frequency.value = 880; gain.gain.value = 0.3; osc.start(); osc.stop(ctx.currentTime + 0.3); }
    else { osc.frequency.value = 440; gain.gain.value = 0.2; osc.start(); osc.stop(ctx.currentTime + 0.15); }
  } catch (e) {}
}

// ===== NOTIFICATION BELL =====
let unreadAlertCount = 0;
let alertPieChartInstance = null;

function updateAlertBell() {
  const badge = document.getElementById('alertBellBadge');
  if (!badge) return;
  unreadAlertCount++;
  badge.textContent = unreadAlertCount > 99 ? '99+' : unreadAlertCount;
  badge.style.display = 'flex';
  badge.style.animation = 'none';
  badge.offsetHeight;
  badge.style.animation = 'bellPulse 0.5s ease';
}

function clearUnreadAlerts() {
  unreadAlertCount = 0;
  const badge = document.getElementById('alertBellBadge');
  if (badge) badge.style.display = 'none';
}

// ===== ALERT PIE CHART =====
function updateAlertPieChart(alerts) {
  const stats = { Caution: 0, Warning: 0, Critical: 0, Dismissed: 0 };
  alerts.forEach(a => {
    const level = (a.level || 'Caution').trim();
    if (stats.hasOwnProperty(level)) stats[level]++;
    else stats.Caution++;
  });
  
  const canvas = document.getElementById('alertPieChart');
  if (!canvas) return;
  
  if (alertPieChartInstance) alertPieChartInstance.destroy();
  
  alertPieChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(stats).filter(k => stats[k] > 0),
      datasets: [{
        data: Object.values(stats).filter(v => v > 0),
        backgroundColor: ['rgba(255,214,10,0.7)', 'rgba(255,107,53,0.7)', 'rgba(255,45,85,0.7)', 'rgba(136,146,176,0.5)'],
        borderWidth: 0
      }]
    },
    options: { responsive: true, maintainAspectRatio: true, cutout: '60%', plugins: { legend: { display: false } } }
  });
  
  const list = document.getElementById('alertStatsList');
  if (list) {
    list.innerHTML = Object.entries(stats).map(([k, v]) => {
      const colors = { Caution: 'var(--yellow)', Warning: 'var(--orange)', Critical: 'var(--red)', Dismissed: 'var(--text-muted)' };
      return '<div style="display:flex;align-items:center;gap:6px;font-size:11px"><span style="width:8px;height:8px;border-radius:50%;background:' + colors[k] + ';flex-shrink:0"></span><span style="color:var(--text-secondary);flex:1">' + k + '</span><span style="font-family:var(--mono);color:var(--text-primary);font-weight:500">' + v + '</span></div>';
    }).join('');
  }
}

// ===== QUIET HOURS =====
function saveQuietHours() {
  const enabled = document.getElementById('quietHoursToggle').checked;
  const from = document.getElementById('quietFrom').value;
  const to = document.getElementById('quietTo').value;
  localStorage.setItem('quietHours', JSON.stringify({ enabled, from, to }));
  document.getElementById('quietHoursRow').style.display = enabled ? 'flex' : 'none';
}

function isQuietHours() {
  const stored = localStorage.getItem('quietHours');
  if (!stored) return false;
  const q = JSON.parse(stored);
  if (!q.enabled) return false;
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const current = h * 60 + m;
  const [fh, fm] = q.from.split(':').map(Number);
  const [th, tm] = q.to.split(':').map(Number);
  const fromMin = fh * 60 + fm;
  const toMin = th * 60 + tm;
  if (fromMin < toMin) return current >= fromMin && current < toMin;
  return current >= fromMin || current < toMin;
}
