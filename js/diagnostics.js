// js/diagnostics.js — Self-test, connectivity, raw log
const Diagnostics = {
  rawLog: [],
  maxRawLog: 500,

  init() {
    this.updateConnectivity();
  },

  logPacket(data) {
    this.rawLog.push({ ts: new Date().toISOString(), ...data });
    if (this.rawLog.length > this.maxRawLog) this.rawLog.shift();
    
    const preview = document.getElementById('rawLogPreview');
    if (preview) {
      const last = this.rawLog[this.rawLog.length - 1];
      preview.textContent = JSON.stringify(last, null, 2);
      preview.scrollTop = preview.scrollHeight;
    }
  },

  updateConnectivity() {
    const d = App.telemetry;
    if (!d) return;
    
    const rssi = d.wifi?.rssi ?? d.rssi ?? null;
    if (rssi != null) {
      setText('diagRssi', rssi + ' dBm');
      const el = document.getElementById('diagRssi');
      if (el) el.style.color = rssi > -50 ? 'var(--green)' : rssi > -70 ? 'var(--yellow)' : 'var(--red)';
    }
    
    setText('diagPktLoss', (d.dataLoss ?? 0) + '%');
    setText('diagUptime', d.uptime || '--');
    
    setText('diagLastTlm', new Date().toLocaleTimeString());
    
    // Update self-test status based on sensor status
    this.updateSelfTest(d);
  },

  updateSelfTest(d) {
    const items = document.querySelectorAll('.self-test-item');
    const sensorStatuses = [
      d.sensorStatus?.voltage ?? (d.battery?.voltageSt || 'ok'),
      d.sensorStatus?.temperature ?? (d.environment?.tempSt || 'ok'),
      d.sensorStatus?.gas ?? (d.gas?.status_mq2 || 'ok'),
      d.sensorStatus?.voc ?? (d.gas?.status_mq135 || 'ok'),
      d.sensorStatus?.bhi ?? (d.risk?.bhiSt || 'ok'),
      'ok' // ESP32 core
    ];
    
    items.forEach((item, i) => {
      const status = sensorStatuses[i] || 'ok';
      const icon = item.querySelector('.st-icon');
      const statusEl = item.querySelector('.st-status');
      
      if (status === 'ok') {
        if (icon) icon.textContent = '\u2705';
        if (statusEl) { statusEl.textContent = 'PASS'; statusEl.style.color = 'var(--green)'; }
      } else if (status === 'stuck') {
        if (icon) icon.textContent = '\u26A0\uFE0F';
        if (statusEl) { statusEl.textContent = 'STUCK'; statusEl.style.color = 'var(--orange)'; }
      } else if (status === 'nc' || status === 'none') {
        if (icon) icon.textContent = '\u2753';
        if (statusEl) { statusEl.textContent = 'NO DATA'; statusEl.style.color = 'var(--text-muted)'; }
      } else {
        if (icon) icon.textContent = '\u274C';
        if (statusEl) { statusEl.textContent = 'FAIL'; statusEl.style.color = 'var(--red)'; }
      }
    });
  }
};

function runSelfTest() {
  UI.toast('Running self-test...', 'info');
  sendCommand('selftest').catch(() => {});
  setTimeout(() => {
    Diagnostics.updateConnectivity();
    UI.toast('Self-test complete', 'success');
  }, 2000);
}

function downloadRawLog(format) {
  if (Diagnostics.rawLog.length === 0) return UI.toast('No raw log data available', 'info');
  
  let content, ext, type;
  if (format === 'json') {
    content = JSON.stringify(Diagnostics.rawLog, null, 2);
    ext = 'json'; type = 'application/json';
  } else {
    let csv = 'Timestamp,Voltage,Current,Power,SOC,BHI,Temp\n';
    Diagnostics.rawLog.forEach(r => {
      csv += `${r.ts},${r.voltage ?? ''},${r.current ?? ''},${r.power ?? ''},${r.soc ?? ''},${r.bhi ?? ''},${r.temperature ?? ''}\n`;
    });
    content = csv;
    ext = 'csv'; type = 'text/csv';
  }
  
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `raw_telemetry_${new Date().toISOString().slice(0,10)}.${ext}`;
  link.click();
  URL.revokeObjectURL(url);
  UI.toast(`Raw log exported as ${format.toUpperCase()}`, 'success');
}

function copyRawLog() {
  if (Diagnostics.rawLog.length === 0) return UI.toast('No raw log data', 'info');
  const text = JSON.stringify(Diagnostics.rawLog, null, 2);
  navigator.clipboard.writeText(text).then(() => UI.toast('Copied to clipboard', 'success')).catch(() => UI.toast('Failed to copy', 'error'));
}
