let mainChart = null, barChart = null;

function initCharts() {
  const ctx1 = document.getElementById('mainChart')?.getContext('2d');
  const ctx2 = document.getElementById('barChart')?.getContext('2d');
  if (!ctx1 || !ctx2) return;
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
