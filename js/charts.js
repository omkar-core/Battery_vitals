let mainChart = null, barChart = null;

const App = { trends: { soc: [], power: [], voltage: [], current: [], temp: [], resistance: [] } };

function getCommonOptions() {
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: '#8892b0', font: { size: 11 }, boxWidth: 12 } } },
    scales: {
      x: { ticks: { color: '#4A5A78', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#4A5A78', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
    }
  };
}

function toggleChartExpand(btn) {
  const card = btn.closest('.chart-card');
  if (!card) return;
  card.classList.toggle('expanded');
  btn.textContent = card.classList.contains('expanded') ? '⛶' : '⛶';
}

function initCharts() {
  const ctx1 = document.getElementById('mainChart')?.getContext('2d');
  const ctx2 = document.getElementById('barChart')?.getContext('2d');
  if (!ctx1 || !ctx2) return;
  const chartSkeleton = document.getElementById('chartSkeleton');
  const barSkeleton = document.getElementById('barSkeleton');
  const dsCfg = (label, color) => ({ label, data: [], borderColor: color, borderWidth: 2, pointRadius: 0, fill: false, tension: 0.3 });
  mainChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: [], datasets: [
        dsCfg('BHI', '#00C896'), dsCfg('Gas', '#FF6B35'), dsCfg('VOC', '#7C3AED'),
        dsCfg('Temp', '#FF2D55'), dsCfg('Humidity', '#00BFFF'), dsCfg('Voltage', '#FFD60A'), dsCfg('Current', '#FF8C00'),
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#8899B4', font: { size: 11 }, boxWidth: 12 } } },
      scales: {
        x: { ticks: { color: '#4A5A78', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { min: 0, max: 100, ticks: { color: '#4A5A78', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
  barChart = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Gas', 'VOC', 'Temp', 'Humid', 'Volt', 'Curr'],
      datasets: [{ label: 'Current', data: [0, 0, 0, 0, 0, 0], backgroundColor: ['#FF6B35', '#7C3AED', '#FF2D55', '#00BFFF', '#FFD60A', '#FF8C00'], borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { color: '#4A5A78', font: { size: 11 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: '#4A5A78' }, grid: { color: 'rgba(255,255,255,0.04)' } } }
    }
  });
  // Hide skeleton loaders once charts are created
  if (chartSkeleton) chartSkeleton.style.display = 'none';
  if (barSkeleton) barSkeleton.style.display = 'none';
  initEfficiencyChart();
  initCycleChart();
  initVIScatterChart();
  initTempResChart();
  initSafetyTimeline();
}

function updateCharts() {
  if (!mainChart || !barChart) return;
  const wp = state.chartWindow === 1 ? 30 : state.chartWindow === 5 ? 150 : state.chartWindow === 15 ? 450 : 1800;
  const data = state.history.slice(-Math.min(wp, state.history.length));
  const labels = data.map(d => {
    const t = new Date(d.time);
    return t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0') + ':' + t.getSeconds().toString().padStart(2, '0');
  });
  mainChart.data.labels = labels;
  mainChart.data.datasets[0].data = data.map(d => d.bhi);
  mainChart.data.datasets[1].data = data.map(d => Math.min(100, (d.gas / 5000) * 100));
  mainChart.data.datasets[2].data = data.map(d => Math.min(100, (d.voc / 300) * 100));
  mainChart.data.datasets[3].data = data.map(d => Math.min(100, Math.max(0, ((d.temp - 20) / 60) * 100)));
  mainChart.data.datasets[4].data = data.map(d => d.humid);
  mainChart.data.datasets[5].data = data.map(d => Math.min(100, Math.max(0, ((d.volt - 10) / 5) * 100)));
  mainChart.data.datasets[6].data = data.map(d => Math.min(100, (Math.abs(d.curr) / 5) * 100));
  mainChart.update('none');
  if (data.length > 0) {
    const last = data[data.length - 1];
    barChart.data.datasets[0].data = [last.gas, last.voc, last.temp, last.humid, last.volt, Math.abs(last.curr)];
    barChart.update('none');
  }

  App.trends.soc = data.map(d => d.bhi);
  App.trends.power = data.map(d => d.power);
  App.trends.voltage = data.map(d => d.volt);
  App.trends.current = data.map(d => d.curr);
  App.trends.temp = data.map(d => d.temp);
  App.trends.resistance = data.map(() => state.lastData?.battery?.resistance ?? 0);

  const trendLabels = data.map((d, i) => i % 10 === 0 ? `${data.length - i}s` : '');
  updateEfficiencyChart(trendLabels);
  updateCycleChart(trendLabels);
  updateVIScatterChart();
  updateTempResChart();
  updateSafetyTimeline(trendLabels);
}

function setChartWindow(min, btn) {
  state.chartWindow = min;
  document.querySelectorAll('.chart-time-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updateCharts();
}

function togglePause() {
  state.chartPaused = !state.chartPaused;
  document.getElementById('chartPauseBtn').textContent = state.chartPaused ? 'Resume' : 'Pause';
}

function clearCharts() {
  state.history = [];
  updateCharts();
  showToast('Charts cleared', 'info');
}

function exportCSV() {
  if (state.history.length === 0) { showToast('No data to export', 'error'); return; }
  let csv = 'Time,BHI,Gas,VOC,Temp,Humidity,Voltage,Current,Power\n';
  state.history.forEach(d => {
    csv += new Date(d.time).toLocaleString() + ',' + d.bhi + ',' + d.gas + ',' + d.voc + ',' + d.temp + ',' + d.humid + ',' + d.volt + ',' + d.curr + ',' + d.power + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'battery_vital_data.csv'; a.click(); URL.revokeObjectURL(a.href);
  showToast('CSV exported', 'success');
}

// ===== ADDITIONAL CHARTS =====

// --- Efficiency Chart ---
let efficiencyChartInstance = null;
let efficiencyMode = 'soc';

function initEfficiencyChart() {
  const ctx = document.getElementById('efficiencyChart');
  if (!ctx) return;
  efficiencyChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'SOC', data: [], borderColor: '#00BFFF', backgroundColor: 'rgba(0,191,255,0.1)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }] },
    options: {
      ...getCommonOptions(),
      scales: {
        x: { ...getCommonOptions().scales.x },
        y: { ...getCommonOptions().scales.y, min: 0, max: 100, title: { display: true, text: 'SOC %', color: '#8892b0' } }
      }
    }
  });
}

function updateEfficiencyChart(labels) {
  if (!efficiencyChartInstance) return;
  if (efficiencyMode === 'soc') {
    efficiencyChartInstance.data.labels = labels;
    efficiencyChartInstance.data.datasets = [{ label: 'SOC', data: [...App.trends.soc].slice(-200), borderColor: '#00BFFF', backgroundColor: 'rgba(0,191,255,0.1)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }];
    efficiencyChartInstance.options.scales.y.max = 100;
    delete efficiencyChartInstance.options.scales.y1;
  } else if (efficiencyMode === 'eff') {
    efficiencyChartInstance.data.labels = labels;
    efficiencyChartInstance.data.datasets = [{ label: 'Efficiency', data: [...App.trends.power].slice(-200), borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.1)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }];
    efficiencyChartInstance.options.scales.y.max = Math.max(...App.trends.power, 100) * 1.1;
    delete efficiencyChartInstance.options.scales.y1;
  } else {
    efficiencyChartInstance.data.labels = labels;
    efficiencyChartInstance.data.datasets = [
      { label: 'SOC', data: [...App.trends.soc].slice(-200), borderColor: '#00BFFF', backgroundColor: 'rgba(0,191,255,0.05)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2, yAxisID: 'y' },
      { label: 'Power (W)', data: [...App.trends.power].slice(-200), borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.05)', fill: false, tension: 0.4, pointRadius: 0, borderWidth: 2, yAxisID: 'y1' }
    ];
    efficiencyChartInstance.options.scales.y1 = { position: 'right', grid: { drawOnChartArea: false, color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8892b0', font: { size: 10 } } };
  }
  efficiencyChartInstance.update('none');
}

// --- Cycle Count Chart ---
let cycleChartInstance = null;

function initCycleChart() {
  const ctx = document.getElementById('cycleChart');
  if (!ctx) return;
  cycleChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Cycles', data: [], backgroundColor: 'rgba(191,90,242,0.6)', borderRadius: 4, barPercentage: 0.7 }] },
    options: { ...getCommonOptions(), scales: { x: getCommonOptions().scales.x, y: { ...getCommonOptions().scales.y, beginAtZero: true } } }
  });
}

function updateCycleChart(labels) {
  if (!cycleChartInstance) return;
  const cycleData = App.trends.soc.map(v => Math.max(0, Math.floor(v / 10)));
  cycleChartInstance.data.labels = labels.slice(-30);
  cycleChartInstance.data.datasets[0].data = cycleData.slice(-30);
  cycleChartInstance.update('none');
}

// --- V-I Scatter ---
let viScatterInstance = null;

function initVIScatterChart() {
  const ctx = document.getElementById('viScatterChart');
  if (!ctx) return;
  viScatterInstance = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [{ label: 'V-I Points', data: [], backgroundColor: 'rgba(255,45,85,0.4)', pointRadius: 3 }] },
    options: {
      ...getCommonOptions(),
      scales: {
        x: { ...getCommonOptions().scales.x, title: { display: true, text: 'Voltage (V)', color: '#8892b0' } },
        y: { ...getCommonOptions().scales.y, title: { display: true, text: 'Current (A)', color: '#8892b0' } }
      }
    }
  });
}

function updateVIScatterChart() {
  if (!viScatterInstance) return;
  const pts = App.trends.voltage.map((v, i) => ({ x: v, y: App.trends.current[i] || 0 }));
  viScatterInstance.data.datasets[0].data = pts.slice(-200);
  viScatterInstance.update('none');
}

// --- Temp vs Resistance Scatter ---
let tempResInstance = null;

function initTempResChart() {
  const ctx = document.getElementById('tempResChart');
  if (!ctx) return;
  tempResInstance = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [{ label: 'T-R Points', data: [], backgroundColor: 'rgba(255,214,10,0.4)', pointRadius: 3 }] },
    options: {
      ...getCommonOptions(),
      scales: {
        x: { ...getCommonOptions().scales.x, title: { display: true, text: 'Temperature (°C)', color: '#8892b0' } },
        y: { ...getCommonOptions().scales.y, title: { display: true, text: 'Resistance (mΩ)', color: '#8892b0' }, min: 0 }
      }
    }
  });
}

function updateTempResChart() {
  if (!tempResInstance) return;
  const pts = App.trends.temp.map((t, i) => ({ x: t, y: (App.trends.resistance[i] || 0) * 1000 }));
  tempResInstance.data.datasets[0].data = pts.slice(-200);
  tempResInstance.update('none');
}

// --- Safety Timeline ---
let safetyTimelineInstance = null;

function initSafetyTimeline() {
  const ctx = document.getElementById('safetyTimeline');
  if (!ctx) return;
  safetyTimelineInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Events', data: [], backgroundColor: 'rgba(255,45,85,0.5)', borderRadius: 2 }] },
    options: {
      ...getCommonOptions(),
      indexAxis: 'x',
      scales: { x: getCommonOptions().scales.x, y: { ...getCommonOptions().scales.y, beginAtZero: true, title: { display: true, text: 'Event Count', color: '#8892b0' } } }
    }
  });
}

function updateSafetyTimeline(labels) {
  if (!safetyTimelineInstance) return;
  const events = App.trends.soc.map(v => v > 50 ? 1 : 0);
  safetyTimelineInstance.data.labels = labels.slice(-60);
  safetyTimelineInstance.data.datasets[0].data = events.slice(-60);
  safetyTimelineInstance.update('none');
}

// --- Efficiency Chart Source Toggle ---
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('chart-btn') && e.target.dataset.source) {
    const parent = e.target.closest('.chart-controls');
    if (parent) parent.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    efficiencyMode = e.target.dataset.source;
    updateEfficiencyChart(state.history.slice(-200).map((d, i) => i % 10 === 0 ? `${state.history.length - i}s` : ''));
  }
});
