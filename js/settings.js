function loadSettings() {
  try {
    const s = localStorage.getItem('bv_settings');
    if (s) {
      const o = JSON.parse(s);
      if (o.apiBase) CFG.apiBase = o.apiBase;
      if (o.pollInterval) CFG.pollInterval = o.pollInterval;
      if (o.tempUnit) state.tempUnit = o.tempUnit;
      if (o.soundEnabled !== undefined) state.soundEnabled = o.soundEnabled;
      if (o.autoMode !== undefined) state.autoMode = o.autoMode;
    }
    const el = (id) => document.getElementById(id);
    if (el('setApiUrl')) el('setApiUrl').value = CFG.apiBase;
    if (el('setPollRate')) { el('setPollRate').value = CFG.pollInterval / 1000; el('pollRateVal').textContent = (CFG.pollInterval / 1000) + 's'; }
    const tu = document.querySelector('input[name="tempUnit"][value="' + state.tempUnit + '"]');
    if (tu) tu.checked = true;
    if (el('setSound')) el('setSound').checked = state.soundEnabled;
  } catch (e) {}
}

function saveAllSettings() {
  CFG.apiBase = document.getElementById('setApiUrl')?.value || '/api';
  CFG.pollInterval = parseInt(document.getElementById('setPollRate')?.value || '3') * 1000;
  state.tempUnit = document.querySelector('input[name="tempUnit"]:checked')?.value || 'C';
  state.soundEnabled = document.getElementById('setSound')?.checked ?? true;
  const settings = { apiBase: CFG.apiBase, pollInterval: CFG.pollInterval, tempUnit: state.tempUnit, soundEnabled: state.soundEnabled, autoMode: state.autoMode };
  localStorage.setItem('bv_settings', JSON.stringify(settings));
  if (state.fetchTimer) { clearInterval(state.fetchTimer); startFetchLoop(); }
  showToast('Settings saved', 'success');
}

function saveTempUnit() {
  state.tempUnit = document.querySelector('input[name="tempUnit"]:checked')?.value || 'C';
  if (state.lastData) processTelemetry(state.lastData);
}

function onProfileChange() {
  const type = document.getElementById('setBattType').value;
  const voltMap = { LEAD_ACID: 12.6, LIPO: 11.1, LI_ION: 11.1, LIFEPO4: 12.8 };
  document.getElementById('setNomVolt').value = voltMap[type] || 12.6;
}

function resetDashDefaults() {
  localStorage.removeItem('bv_settings');
  localStorage.removeItem('bv_alerts');
  location.reload();
}

function confirmFactoryReset() {
  document.getElementById('modalContent').innerHTML = '<h3 style="color:var(--red)">Factory Reset</h3><p>This will erase all device settings, calibration data, and profiles. The device will reboot with factory defaults.</p><p><strong>This action cannot be undone.</strong></p><div class="modal-actions"><button class="clay-btn" onclick="closeModal()">Cancel</button><button class="clay-btn clay-btn-danger" onclick="executeFactoryReset()">Confirm Factory Reset</button></div>';
  document.getElementById('modalOverlay').classList.add('show');
}

function executeFactoryReset() {
  closeModal();
  sendCommand('FACTORY_RESET').then(() => showToast('Factory reset sent. Device will reboot.', 'info')).catch(() => showToast('Command failed', 'error'));
}
