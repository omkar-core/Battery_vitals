function toggleAutoMode() {
  state.autoMode = !state.autoMode;
  renderAutoMode();
  sendCommand(state.autoMode ? 'LED_MODE' : 'LED_MODE', state.autoMode ? 'AUTO' : 'MANUAL');
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
  }).catch(() => showToast('Command failed', 'error'));
}

async function sendCommand(command, value) {
  const reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try {
    const resp = await fetch(CFG.apiBase + '/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
