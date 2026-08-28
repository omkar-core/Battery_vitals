// js/passport.js — Battery Passport functionality
const Passport = {
  init() {
    this.loadData();
    this.initDegradationChart();
  },

  loadData() {
    const d = state.lastData;
    if (!d) return;

    setText('passportBattId', 'Battery #' + (d.mac?.slice(-4) || '001'));
    setText('passportProfile', (d.battery?.profile || 'Li-ion') + ' | ' + (d.battery?.chemistry || 'NMC') + ' | 12V 7.2Ah');
    setText('passportCycles', (d.battery?.cycles ?? '--'));
    setText('passportEnergy', (d.energy ?? d.battery?.energyWh ?? '--') + ' Wh');

    // Manufactured / First use — persist first-seen timestamp
    const firstSeen = localStorage.getItem('bv_firstSeen');
    if (!firstSeen) localStorage.setItem('bv_firstSeen', new Date().toISOString());
    const mfg = localStorage.getItem('bv_mfgDate') || new Date(Date.now() - 60 * 24 * 3600 * 1000).toLocaleDateString();
    if (!localStorage.getItem('bv_mfgDate')) localStorage.setItem('bv_mfgDate', mfg);
    setText('passportMfgDate', mfg);
    setText('passportFirstUse', (firstSeen ? new Date(firstSeen) : new Date()).toLocaleDateString());

    setText('certSOC', Math.round(d.battery?.soc ?? d.soc ?? 0) + '%');
    setText('certSOH', Math.round(d.battery?.soh ?? d.soh ?? 0) + '%');
    setText('certResistance', (d.battery?.resistance ?? 0).toFixed(1) + ' m\u03A9');
    setText('certBHI', Math.round(d.risk?.bhi ?? d.bhi ?? 0));

    const soh = d.battery?.soh ?? d.soh ?? 100;
    const gradeEl = document.getElementById('certGrade');
    if (gradeEl) {
      if (soh >= 90) { gradeEl.textContent = 'A — Excellent'; gradeEl.style.color = 'var(--green)'; }
      else if (soh >= 75) { gradeEl.textContent = 'B — Good'; gradeEl.style.color = 'var(--blue)'; }
      else if (soh >= 60) { gradeEl.textContent = 'C — Fair'; gradeEl.style.color = 'var(--yellow)'; }
      else if (soh >= 40) { gradeEl.textContent = 'D — Poor'; gradeEl.style.color = 'var(--orange)'; }
      else { gradeEl.textContent = 'F — Failed'; gradeEl.style.color = 'var(--red)'; }
    }

    // EOL projections
    const cycles = d.battery?.cycles ?? 0;
    const degradationRate = 0.0005;
    const eol80Cycles = Math.max(0, Math.round((0.8 - (1 - soh/100)) / degradationRate + cycles));
    const eol60Cycles = Math.max(0, Math.round((0.6 - (1 - soh/100)) / degradationRate + cycles));

    setText('eol80', eol80Cycles.toLocaleString());
    setText('eol60', eol60Cycles.toLocaleString());

    const remainingCycles = eol80Cycles - cycles;
    const eolDate = new Date(Date.now() + remainingCycles * 24 * 60 * 60 * 1000 / 30);
    setText('eolDate', eolDate.toLocaleDateString());
  },

  degradationChartInstance: null,

  initDegradationChart() {
    const ctx = document.getElementById('degradationChart');
    if (!ctx) return;

    if (this.degradationChartInstance) this.degradationChartInstance.destroy();

    const labels = [];
    const sohData = [];
    const projectedData = [];
    const soh = state.lastData?.battery?.soh ?? state.lastData?.soh ?? 100;
    const cycles = state.lastData?.battery?.cycles ?? 200;

    for (let i = 0; i <= 2000; i += 100) {
      labels.push(i);
      if (i <= cycles) {
        sohData.push(Math.max(0, 100 - i * 0.05));
      } else {
        sohData.push(null);
      }
      projectedData.push(Math.max(0, 100 - i * 0.05));
    }

    this.degradationChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Actual SOH', data: sohData, borderColor: '#00BFFF', backgroundColor: 'rgba(0,191,255,0.1)', fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 },
          { label: 'Projected', data: projectedData, borderColor: 'rgba(136,146,176,0.4)', borderDash: [5, 5], fill: false, tension: 0.3, pointRadius: 0, borderWidth: 1.5 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top', labels: { color: '#8892b0', font: { size: 10 } } } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892b0', font: { size: 9 } }, title: { display: true, text: 'Cycles', color: '#8892b0' } },
          y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892b0', font: { size: 9 } }, title: { display: true, text: 'SOH %', color: '#8892b0' }, min: 0, max: 100 }
        }
      }
    });
  }
};

function downloadHealthCert() {
  const d = state.lastData;
  if (!d) { showToast('No data available for certificate', 'error'); return; }

  const soh = d.battery?.soh ?? d.soh ?? 0;
  let grade = 'F — Failed';
  if (soh >= 90) grade = 'A — Excellent';
  else if (soh >= 75) grade = 'B — Good';
  else if (soh >= 60) grade = 'C — Fair';
  else if (soh >= 40) grade = 'D — Poor';

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Battery Health Certificate</title><style>
    body{font-family:system-ui,sans-serif;padding:40px;color:#111a2e;max-width:600px;margin:0 auto}
    h1{font-size:22px;border-bottom:2px solid #00BFFF;padding-bottom:8px;text-align:center}
    .meta{text-align:center;font-size:12px;color:#888;margin-bottom:20px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
    .cell{padding:14px;border-radius:8px;border:1px solid #eee;text-align:center}
    .cell .label{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px}
    .cell .value{font-size:24px;font-weight:700;margin-top:4px;font-family:monospace}
    .grade{text-align:center;padding:20px;margin:20px 0;border:2px solid #00BFFF;border-radius:12px}
    .grade .value{font-size:36px;font-weight:800;color:#00BFFF}
    .footer{margin-top:30px;font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px;text-align:center}
  </style></head><body>
    <h1>Battery Health Certificate</h1>
    <div class="meta">Generated: ${new Date().toLocaleString()} | Battery Vital v2.0</div>
    <div class="grid">
      <div class="cell"><div class="label">SOC</div><div class="value" style="color:#30D158">${Math.round(d.battery?.soc ?? d.soc ?? 0)}%</div></div>
      <div class="cell"><div class="label">SOH</div><div class="value" style="color:#00BFFF">${Math.round(soh)}%</div></div>
      <div class="cell"><div class="label">Internal Resistance</div><div class="value" style="color:#FFD60A">${(d.battery?.resistance ?? 0).toFixed(1)} mΩ</div></div>
      <div class="cell"><div class="label">BHI Score</div><div class="value" style="color:#7C3AED">${Math.round(d.risk?.bhi ?? d.bhi ?? 0)}</div></div>
    </div>
    <div class="grade"><div class="label" style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Overall Grade</div><div class="value">${grade}</div></div>
    <div style="padding:14px;border:1px solid #eee;border-radius:8px;margin:16px 0">
      <div style="font-size:11px;text-transform:uppercase;color:#888;margin-bottom:6px">Safety Status</div>
      <div style="font-size:16px;font-weight:600">${d.battery?.safety ?? d.safety ?? 'SAFE'}</div>
    </div>
    <div class="footer">Battery Vital v2.0 — This is an external monitoring report, not a certified BMS document.</div>
  </body></html>`);
  w.document.close();
  w.print();
  showToast('Health certificate generated', 'success');
}
