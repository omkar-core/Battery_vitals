// js/diagnostics.js — Self-test, connectivity, raw log
const Diagnostics = {
  rawLog: [],
  maxRawLog: 500,

  pushRawLog() {
    const d = state.lastData;
    if (!d) return;
    const entry = {
      ts: new Date().toISOString(),
      voltage: d.battery?.voltage ?? d.voltage ?? null,
      current: d.battery?.current ?? d.current ?? null,
      power: d.battery?.power ?? d.power ?? null,
      soc: d.battery?.soc ?? d.soc ?? null,
      bhi: d.risk?.bhi ?? d.bhi ?? null,
      temperature: d.environment?.temperature ?? d.temperature ?? null
    };
    this.rawLog.push(entry);
    if (this.rawLog.length > this.maxRawLog) this.rawLog.shift();
  },

  updateConnectivity() {
    const d = state.lastData;
    this.pushRawLog();
    this.renderRawLog();
    if (!d) return;
    
    const rssi = d.network?.rssi ?? d.wifi?.rssi ?? d.rssi ?? null;
    if (rssi != null) {
      setText('diagRssi', rssi + ' dBm');
      const el = document.getElementById('diagRssi');
      if (el) el.style.color = rssi > -50 ? 'var(--green)' : rssi > -70 ? 'var(--yellow)' : 'var(--red)';
    }
    
    setText('diagPktLoss', (d.dataLoss ?? d.network?.packetLoss ?? 0) + '%');
    setText('diagUptime', d.uptime || '--');
    
    setText('diagLastTlm', new Date().toLocaleTimeString());
    
    // Update self-test status based on sensor status
    this.updateSelfTest(d);
  },

  renderRawLog() {
    const preview = document.getElementById('rawLogPreview');
    if (!preview) return;
    if (!this.rawLog.length) {
      preview.textContent = 'Waiting for telemetry data...';
      return;
    }
    const last = this.rawLog.slice(-12).reverse();
    preview.innerHTML = last.map(r =>
      '<div style="display:flex;gap:8px;align-items:center">' +
      '<span style="color:var(--text-muted);white-space:nowrap">' + r.ts.slice(11, 19) + '</span>' +
      '<span style="color:var(--cyan)">' + (r.voltage ?? '-') + 'V</span>' +
      '<span style="color:var(--yellow)">' + (r.current ?? '-') + 'A</span>' +
      '<span style="color:var(--purple)">' + (r.bhi ?? '-') + ' BHI</span>' +
      '<span style="color:var(--text-muted)">SOC ' + (r.soc ?? '-') + '%</span>' +
      '</div>'
    ).join('');
  },

  updateSelfTest(d) {
    const items = document.querySelectorAll('.self-test-item');
    const normalize = (s) => (s || '').toString().toLowerCase();
    const gasSt = normalize(d.gas?.status_mq2);
    const vocSt = normalize(d.gas?.status_mq135);
    const sensorStatuses = [
      d.sensorStatus?.voltage ?? (d.battery?.voltageSt || 'ok'),
      d.sensorStatus?.temperature ?? (d.environment?.tempSt || 'ok'),
      (gasSt === 'normal' || gasSt === 'elevated' || gasSt === 'ok') ? 'ok' : (d.sensorStatus?.gas ?? 'ok'),
      (vocSt === 'normal' || vocSt === 'elevated' || vocSt === 'ok') ? 'ok' : (d.sensorStatus?.voc ?? 'ok'),
      d.sensorStatus?.bhi ?? (d.risk?.bhiSt || 'ok'),
      'ok' // ESP32 core
    ];
    
    items.forEach((item, i) => {
      if (!item) return;
      const status = (sensorStatuses[i] || 'ok').toString().toLowerCase();
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
  showToast('Running self-test...', 'info');
  sendCommand('selftest').catch(() => {});
  setTimeout(() => {
    Diagnostics.updateConnectivity();
    showToast('Self-test complete', 'success');
  }, 2000);
}

function downloadRawLog(format) {
  if (Diagnostics.rawLog.length === 0) return showToast('No raw log data available', 'info');
  
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
  showToast(`Raw log exported as ${format.toUpperCase()}`, 'success');
}

function copyRawLog() {
  if (Diagnostics.rawLog.length === 0) return showToast('No raw log data', 'info');
  const text = JSON.stringify(Diagnostics.rawLog, null, 2);
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard', 'success')).catch(() => showToast('Failed to copy', 'error'));
}
