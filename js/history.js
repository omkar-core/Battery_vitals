// js/history.js — History page: chart, date range, exports
let historyChartInstance = null;

function initHistoryChart() {
  const ctx = document.getElementById('historyChart');
  if (!ctx) return;

  if (historyChartInstance) historyChartInstance.destroy();

  historyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Voltage', data: [], borderColor: '#FFD60A', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3, yAxisID: 'y' },
        { label: 'Temperature', data: [], borderColor: '#FF2D55', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3, yAxisID: 'y1' },
        { label: 'Current', data: [], borderColor: '#00BFFF', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3, yAxisID: 'y' },
        { label: 'SOC', data: [], borderColor: '#30D158', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.3, yAxisID: 'y' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#8892b0', font: { size: 10 }, boxWidth: 10 } } },
      scales: {
        x: { ticks: { color: '#4A5A78', font: { size: 9 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { position: 'left', ticks: { color: '#FFD60A', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'V / A / %', color: '#8892b0' } },
        y1: { position: 'right', ticks: { color: '#FF2D55', font: { size: 9 } }, grid: { drawOnChartArea: false }, title: { display: true, text: '°C', color: '#8892b0' } }
      }
    }
  });

  updateHistoryStats();
}

function getFilteredData() {
  let data = state.history;
  if (!data || !data.length) return data || [];
  const fromEl = document.getElementById('historyDateFrom');
  const toEl = document.getElementById('historyDateTo');
  const aggEl = document.getElementById('historyAggregation');
  if (fromEl && fromEl.value) {
    const from = new Date(fromEl.value).getTime();
    data = data.filter(d => new Date(d.time).getTime() >= from);
  }
  if (toEl && toEl.value) {
    const to = new Date(toEl.value).getTime();
    data = data.filter(d => new Date(d.time).getTime() <= to);
  }
  const agg = aggEl ? aggEl.value : 'raw';
  if (agg === 'raw' || !data.length) return data;
  const bucketMs = agg === '1min' ? 60000 : agg === '5min' ? 300000 : agg === 'hourly' ? 3600000 : 86400000;
  const buckets = new Map();
  data.forEach(d => {
    const t = new Date(d.time).getTime();
    const key = Math.floor(t / bucketMs) * bucketMs;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(d);
  });
  return Array.from(buckets.values()).map(list => {
    const avg = f => list.reduce((s, d) => s + (d[f] ?? 0), 0) / list.length;
    return {
      time: new Date([...buckets.keys()].find(k => buckets.get(k) === list)).toISOString(),
      volt: avg('volt'), curr: avg('curr'), power: avg('power'), temp: avg('temp'),
      humid: avg('humid'), bhi: Math.round(avg('bhi')), gas: Math.round(avg('gas')), soc: Math.round(avg('soc'))
    };
  });
}

function updateHistoryStats() {
  const data = getFilteredData();
  if (!data.length) {
    setText('histPeakV', '--');
    setText('histAvgT', '--');
    setText('histPeakI', '--');
    setText('histTotalWh', '--');
    document.getElementById('noHistory').style.display = 'block';
    return;
  }
  document.getElementById('noHistory').style.display = 'none';

  const peakV = Math.max(...data.map(d => d.volt));
  const avgT = data.reduce((s, d) => s + d.temp, 0) / data.length;
  const peakI = Math.max(...data.map(d => Math.abs(d.curr)));
  const totalWh = data.reduce((s, d) => s + Math.abs(d.power) / 3600, 0);

  setText('histPeakV', n(peakV) + ' V');
  setText('histAvgT', n(avgT) + ' °C');
  setText('histPeakI', n(peakI) + ' A');
  setText('histTotalWh', n(totalWh) + ' Wh');
}

function updateHistoryChart() {
  if (!historyChartInstance) return;
  const data = getFilteredData();
  if (!data.length) return;

  const labels = data.map(d => {
    const t = new Date(d.time);
    return t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0');
  });

  historyChartInstance.data.labels = labels;
  historyChartInstance.data.datasets[0].data = data.map(d => d.volt);
  historyChartInstance.data.datasets[1].data = data.map(d => d.temp);
  historyChartInstance.data.datasets[2].data = data.map(d => d.curr);
  historyChartInstance.data.datasets[3].data = data.map(d => d.soc || 0);
  historyChartInstance.update('none');
}

function applyDateRange() {
  updateHistoryStats();
  updateHistoryChart();
  renderSessionLog();
  showToast('Date range applied', 'info');
}

function renderSessionLog() {
  const list = document.getElementById('sessionLogList');
  if (!list) return;
  const data = state.history;
  if (!data.length) {
    list.innerHTML = '<div class="empty-state" style="padding:20px"><p>No sessions recorded yet</p></div>';
    return;
  }
  // Detect sessions: gaps > 60s split sessions
  const sessions = [];
  let cur = { start: null, end: null, count: 0 };
  for (let i = 0; i < data.length; i++) {
    const t = new Date(data[i].time).getTime();
    if (!cur.start) { cur.start = t; cur.end = t; cur.count = 1; continue; }
    if (t - cur.end > 60000) { sessions.push(cur); cur = { start: t, end: t, count: 1 }; continue; }
    cur.end = t; cur.count++;
  }
  if (cur.start) sessions.push(cur);
  if (!sessions.length) { list.innerHTML = '<div class="empty-state" style="padding:20px"><p>No sessions recorded yet</p></div>'; return; }
  list.innerHTML = sessions.map(s => {
    const durMin = Math.round((s.end - s.start) / 60000);
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);font-size:12px">' +
      '<span style="color:var(--green)">&#9679;</span>' +
      '<div style="flex:1"><div style="color:var(--text-primary);font-weight:500">' + new Date(s.start).toLocaleString() + ' — ' + new Date(s.end).toLocaleTimeString() + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted)">' + s.count + ' readings over ' + durMin + ' min</div></div>' +
      '</div>';
  }).join('');
}

function exportHistoryCSV() {
  if (state.history.length === 0) { showToast('No history data to export', 'error'); return; }
  let csv = 'Time,BHI,Gas,VOC,Temp,Humidity,Voltage,Current,Power\n';
  state.history.forEach(d => {
    csv += new Date(d.time).toLocaleString() + ',' + d.bhi + ',' + d.gas + ',' + d.voc + ',' + d.temp + ',' + d.humid + ',' + d.volt + ',' + d.curr + ',' + d.power + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'battery_vitals_history_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('History CSV exported', 'success');
}

function exportHistoryJSON() {
  if (state.history.length === 0) { showToast('No history data to export', 'error'); return; }
  const data = {
    exportedAt: new Date().toISOString(),
    version: '2.0',
    readings: state.history,
    settings: JSON.parse(localStorage.getItem('bv_settings') || '{}')
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'battery_vitals_history_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('History JSON exported', 'success');
}

function printHistoryView() {
  if (state.history.length === 0) { showToast('No history data to print', 'error'); return; }
  const w = window.open('', '_blank');
  let rows = state.history.map(d => {
    return `<tr>
      <td>${new Date(d.time).toLocaleString()}</td>
      <td>${n(d.volt)}</td>
      <td>${n(d.curr)}</td>
      <td>${n(d.power)}</td>
      <td>${n(d.temp)}</td>
      <td>${n(d.humid)}</td>
      <td>${d.bhi ?? '--'}</td>
      <td>${d.gas ?? '--'}</td>
    </tr>`;
  }).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>Battery History Report</title><style>
    body{font-family:system-ui,sans-serif;padding:40px;color:#111a2e}
    h1{font-size:20px;border-bottom:2px solid #00BFFF;padding-bottom:8px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    td,th{padding:6px 10px;border:1px solid #ddd;text-align:left;font-size:11px}
    th{background:#f0f4fc;font-weight:600}
    .footer{margin-top:20px;font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px}
  </style></head><body>
    <h1>Battery Vital — History Report</h1>
    <p>Generated: ${new Date().toLocaleString()} | ${state.history.length} readings</p>
    <table>
      <tr><th>Time</th><th>Voltage (V)</th><th>Current (A)</th><th>Power (W)</th><th>Temp (°C)</th><th>Humidity (%)</th><th>BHI</th><th>Gas</th></tr>
      ${rows}
    </table>
    <div class="footer">Battery Vital v2.0 — External monitoring data.</div>
  </body></html>`);
  w.document.close();
  w.print();
}
