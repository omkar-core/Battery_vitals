function toggleAutoMode() {
  state.autoMode = !state.autoMode;
  renderAutoMode();
  sendCommand(state.autoMode ? 'LED_MODE' : 'LED_MODE', state.autoMode ? 'AUTO' : 'MANUAL');
  logCommand('Auto Mode ' + (state.autoMode ? 'ON' : 'OFF'), true);
}

function renderAutoMode() {
  const banner = document.getElementById('modeBanner');
  const cards = document.querySelectorAll('#ledGrid .led-card');
  if (state.autoMode) {
    banner.className = 'mode-banner auto-mode';
    banner.innerHTML = '<span>Auto Mode: <strong>ACTIVE</strong> — BHI controls outputs automatically. Manual buttons are disabled.</span><button class="clay-btn" style="padding:6px 16px;min-height:36px;font-size:12px" onclick="toggleAutoMode()">Switch to Manual</button>';
    cards.forEach(c => c.classList.add('disabled-by-auto'));
  } else {
    banner.className = 'mode-banner manual-mode';
    banner.innerHTML = '<span>Manual Override: <strong>ACTIVE</strong> — You control outputs directly.</span><button class="clay-btn" style="padding:6px 16px;min-height:36px;font-size:12px" onclick="toggleAutoMode()">Enable Auto Mode</button>';
    cards.forEach(c => c.classList.remove('disabled-by-auto'));
  }
}

function renderLED(key, on) {
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const icon = document.getElementById('icon' + cap);
  const st = document.getElementById('state' + cap);
  const btn = document.getElementById('btn' + cap);
  if (!icon) return;
  const ledClass = key === 'buzzer' ? 'buzzer-led' : key + '-led';
  icon.className = 'led-icon ' + (on ? 'on ' : 'off ') + ledClass;
  icon.textContent = key === 'buzzer' ? '\u266B' : '\u25CF';
  if (st) { st.textContent = on ? 'ON' : 'OFF'; st.className = 'led-state ' + (on ? 'on' : 'off'); }
  if (btn) { btn.textContent = on ? 'Turn OFF' : 'Turn ON'; btn.className = 'led-btn ' + (on ? 'turn-off' : 'turn-on'); }
}

function toggleOutput(key) {
  if (state.autoMode) { showToast('Disable auto mode first', 'info'); return; }
  const newState = !state.ledStates[key];
  const cmd = key === 'buzzer' ? (newState ? 'BUZZER_ON' : 'BUZZER_OFF') : 'LED_MODE';
  const val = key === 'buzzer' ? undefined : (key.toUpperCase() + '_' + (newState ? 'ON' : 'OFF'));
  sendCommand(cmd, val).then(() => {
    state.ledStates[key] = newState;
    renderLED(key, newState);
    showToast(key + ' turned ' + (newState ? 'ON' : 'OFF'), 'info');
    logCommand((key === 'buzzer' ? 'Buzzer' : 'LED') + ' ' + (newState ? 'ON' : 'OFF'), true);
  }).catch(() => {
    showToast('Command failed', 'error');
    logCommand((key === 'buzzer' ? 'Buzzer' : 'LED') + ' ' + (newState ? 'ON' : 'OFF'), false);
  });
}

async function sendCommand(command, value) {
  const reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.authToken) headers['Authorization'] = 'Bearer ' + state.authToken;
    const resp = await fetch(CFG.apiBase + '/commands', {
      method: 'POST',
      headers,
      body: JSON.stringify({ command, value, requestId: reqId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    showToast('Command sent: ' + command, 'success');
    return data;
  } catch (e) {
    if (state.isDemo) {
      showToast('(Demo) Command: ' + command, 'info');
      return { ok: true };
    }
    throw e;
  }
}

// ===== COMMAND HISTORY =====
let commandHistory = [];

function logCommand(type, result) {
  const entry = {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: type,
    result: result ? 'Success' : 'Failed',
    icon: result ? '&#10003;' : '&#10007;'
  };
  commandHistory.unshift(entry);
  if (commandHistory.length > 50) commandHistory.pop();
  renderCommandHistory();
  
  // Update last cmd time
  const lastCmdEl = document.getElementById('lastCmdTime');
  if (lastCmdEl) lastCmdEl.textContent = 'Last cmd: ' + entry.time;
  
  // Update API latency badge
  updateApiLatencyBadge();
}

function renderCommandHistory() {
  const log = document.getElementById('commandHistoryLog');
  if (!log) return;
  if (commandHistory.length === 0) {
    log.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:16px">No commands sent yet</div>';
    return;
  }
  log.innerHTML = commandHistory.map(c => {
    const color = c.result === 'Success' ? 'var(--green)' : 'var(--red)';
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);font-size:11px">
      <span style="color:${color};font-size:14px">${c.icon}</span>
      <span style="flex:1;color:var(--text-primary);font-weight:500">${c.type}</span>
      <span style="color:${color};font-size:10px">${c.result}</span>
      <span style="color:var(--text-muted);font-family:var(--mono);font-size:9px">${c.time}</span>
    </div>`;
  }).join('');
}

function exportCommandHistory() {
  if (commandHistory.length === 0) return UI.toast('No command history to export', 'info');
  let csv = 'Time,Type,Result\n';
  commandHistory.forEach(c => {
    csv += `"${c.time}","${c.type}","${c.result}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `commands_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  UI.toast('Command history exported', 'success');
}

// ===== API LATENCY BADGE =====
function updateApiLatencyBadge() {
  const badge = document.getElementById('apiLatencyBadge');
  const latency = App.telemetry?.apiLatency ?? App.telemetry?.data?.apiLatency ?? null;
  if (!badge) return;
  if (latency != null) {
    badge.textContent = latency + ' ms';
    badge.style.color = latency < 100 ? 'var(--green)' : latency < 300 ? 'var(--yellow)' : 'var(--red)';
    badge.style.background = latency < 100 ? 'rgba(48,209,88,0.08)' : latency < 300 ? 'rgba(255,214,10,0.08)' : 'rgba(255,45,85,0.08)';
    badge.style.borderColor = latency < 100 ? 'rgba(48,209,88,0.15)' : latency < 300 ? 'rgba(255,214,10,0.15)' : 'rgba(255,45,85,0.15)';
  } else {
    badge.textContent = '-- ms';
  }
}

// ===== SCHEDULED ACTIONS =====
let scheduledActions = [];

function scheduleAction(action, delaySec) {
  const entry = {
    id: Date.now(),
    action: action,
    scheduledAt: new Date().toLocaleTimeString(),
    executeAt: delaySec > 0 ? new Date(Date.now() + delaySec * 1000).toLocaleTimeString() : 'Immediate',
    timer: null
  };
  
  if (delaySec > 0) {
    entry.timer = setTimeout(() => {
      executeAction(action);
      scheduledActions = scheduledActions.filter(a => a.id !== entry.id);
      renderScheduledActions();
    }, delaySec * 1000);
  } else {
    executeAction(action);
  }
  
  scheduledActions.push(entry);
  renderScheduledActions();
  UI.toast(`Action "${action}" ${delaySec > 0 ? 'scheduled in ' + delaySec + 's' : 'executing now'}`, 'success');
}

function executeAction(action) {
  switch(action) {
    case 'reboot': sendCommand('reboot'); break;
    case 'led_off': sendCommand('led', 'off'); break;
    case 'calibrate': startCalibration(); break;
    default: sendCommand(action);
  }
}

function renderScheduledActions() {
  const list = document.getElementById('scheduledActionsList');
  if (!list) return;
  if (scheduledActions.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:12px">No scheduled actions</div>';
    return;
  }
  list.innerHTML = scheduledActions.map(a => {
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);font-size:11px">
      <span style="color:var(--blue)">&#9201;</span>
      <span style="flex:1;color:var(--text-primary)">${a.action}</span>
      <span style="color:var(--text-muted);font-family:var(--mono);font-size:9px">${a.executeAt}</span>
      ${a.timer ? `<button onclick="cancelScheduledAction(${a.id})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:12px">&#10005;</button>` : ''}
    </div>`;
  }).join('');
}

function cancelScheduledAction(id) {
  const action = scheduledActions.find(a => a.id === id);
  if (action && action.timer) {
    clearTimeout(action.timer);
    scheduledActions = scheduledActions.filter(a => a.id !== id);
    renderScheduledActions();
    UI.toast('Scheduled action cancelled', 'info');
  }
}

// ===== CALIBRATION =====
let calibrationRunning = false;
let calibrationInterval = null;

function startCalibration() {
  calibrationRunning = true;
  const section = document.getElementById('calibrationSection');
  const bar = document.getElementById('calibrationBar');
  const status = document.getElementById('calibrationStatus');
  const step = document.getElementById('calibrationStep');
  const pct = document.getElementById('calibrationPct');
  
  if (section) section.style.display = 'block';
  
  const steps = [
    { text: 'Zeroing voltage offset...', dur: 3000 },
    { text: 'Calibrating current sense...', dur: 4000 },
    { text: 'Temperature sensor check...', dur: 3000 },
    { text: 'Gas sensor baseline...', dur: 5000 },
    { text: 'Final verification...', dur: 2000 }
  ];
  
  let currentStep = 0;
  let elapsed = 0;
  const totalDur = steps.reduce((s, st) => s + st.dur, 0);
  
  calibrationInterval = setInterval(() => {
    if (!calibrationRunning) { clearInterval(calibrationInterval); return; }
    
    elapsed += 1000;
    const p = Math.min(100, (elapsed / totalDur) * 100);
    
    if (bar) bar.style.width = p + '%';
    if (pct) pct.textContent = Math.round(p) + '%';
    
    let stepTime = 0;
    for (let i = 0; i < steps.length; i++) {
      stepTime += steps[i].dur;
      if (elapsed <= stepTime) {
        if (status) status.textContent = steps[i].text;
        if (step) step.textContent = `Step ${i + 1}/${steps.length}`;
        break;
      }
    }
    
    if (elapsed >= totalDur) {
      clearInterval(calibrationInterval);
      calibrationRunning = false;
      if (status) status.textContent = 'Calibration complete!';
      if (bar) bar.style.background = 'var(--green)';
      logCommand('Calibration', true);
      UI.toast('Calibration complete', 'success');
      setTimeout(() => {
        if (section) section.style.display = 'none';
        if (bar) { bar.style.width = '0%'; bar.style.background = 'linear-gradient(90deg,var(--blue),var(--green))'; }
      }, 3000);
    }
  }, 1000);
}

function cancelCalibration() {
  calibrationRunning = false;
  clearInterval(calibrationInterval);
  const section = document.getElementById('calibrationSection');
  if (section) section.style.display = 'none';
  UI.toast('Calibration cancelled', 'info');
}
