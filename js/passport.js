// js/passport.js — Battery Passport functionality
const Passport = {
  init() {
    this.loadData();
    this.initDegradationChart();
  },

  loadData() {
    const d = App.telemetry;
    if (!d) return;
    
    setText('passportBattId', 'Battery #' + (d.mac?.slice(-4) || '001'));
    setText('passportProfile', (d.battery?.profile || 'Li-ion') + ' | ' + (d.battery?.chemistry || 'NMC') + ' | 12V 7.2Ah');
    setText('passportCycles', (d.battery?.cycles ?? d.sim?.cycleCount ?? '--'));
    setText('passportEnergy', (d.energy ?? d.battery?.energyWh ?? '--') + ' Wh');
    
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
    const cycles = d.battery?.cycles ?? d.sim?.cycleCount ?? 0;
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
    const soh = App.telemetry?.battery?.soh ?? App.telemetry?.soh ?? 100;
    const cycles = App.telemetry?.battery?.cycles ?? 200;
    
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
  UI.toast('Health certificate export — feature available in production build', 'info');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
