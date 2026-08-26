// js/export.js — Export, print, share utilities
const ExportUtil = {
  // Export full dashboard state as JSON
  dashboardJSON() {
    const d = App.telemetry || {};
    const data = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      telemetry: d,
      settings: JSON.parse(localStorage.getItem('bvSettings') || '{}'),
      alerts: App.alerts || []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battery_vitals_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('Full data exported as JSON', 'success');
  },

  // Export current readings as CSV
  dashboardCSV() {
    const d = App.telemetry;
    if (!d) return UI.toast('No data to export', 'info');
    const rows = [
      ['Metric', 'Value', 'Unit'],
      ['Voltage', d.voltage ?? '', 'V'],
      ['Current', d.current ?? '', 'A'],
      ['Power', d.power ?? '', 'W'],
      ['SOC', d.soc ?? '', '%'],
      ['SOH', d.soh ?? d.battery?.soh ?? '', '%'],
      ['Temperature', d.temperature ?? d.environment?.temperature ?? '', '°C'],
      ['Humidity', d.humidity ?? d.environment?.humidity ?? '', '%'],
      ['BHI', d.bhi ?? d.risk?.bhi ?? '', ''],
      ['Safety', d.safety ?? d.battery?.safety ?? '', ''],
      ['Gas Index MQ2', d.gasIndex ?? d.gas?.index_mq2 ?? '', ''],
      ['Gas Index MQ135', d.gas?.index_mq135 ?? '', ''],
      ['Resistance', d.resistance ?? d.battery?.resistance ?? '', 'mΩ'],
      ['Timestamp', new Date().toISOString(), '']
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battery_vitals_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('Current readings exported as CSV', 'success');
  },

  // Print-optimized view
  printView() {
    const d = App.telemetry;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Battery Vitals Report</title><style>
      body{font-family:system-ui,sans-serif;padding:40px;color:#111a2e}
      h1{font-size:24px;border-bottom:2px solid #00BFFF;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      td,th{padding:8px 12px;border:1px solid #ddd;text-align:left;font-size:13px}
      th{background:#f0f4fc;font-weight:600}
      .good{color:#30D158}.warn{color:#FF6B35}.bad{color:#FF2D55}
      .footer{margin-top:30px;font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:8px}
    </style></head><body>
      <h1>Battery Vital — Health Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
      <table>
        <tr><th>Parameter</th><th>Value</th><th>Unit</th></tr>
        <tr><td>Voltage</td><td>${d?.voltage ?? '--'}</td><td>V</td></tr>
        <tr><td>Current</td><td>${d?.current ?? '--'}</td><td>A</td></tr>
        <tr><td>Power</td><td>${d?.power ?? '--'}</td><td>W</td></tr>
        <tr><td>SOC</td><td>${d?.soc ?? '--'}</td><td>%</td></tr>
        <tr><td>SOH</td><td>${d?.soh ?? d?.battery?.soh ?? '--'}</td><td>%</td></tr>
        <tr><td>Temperature</td><td>${d?.temperature ?? d?.environment?.temperature ?? '--'}</td><td>°C</td></tr>
        <tr><td>Humidity</td><td>${d?.humidity ?? d?.environment?.humidity ?? '--'}</td><td>%</td></tr>
        <tr><td>BHI Score</td><td>${d?.bhi ?? d?.risk?.bhi ?? '--'}</td><td></td></tr>
        <tr><td>Safety State</td><td>${d?.safety ?? d?.battery?.safety ?? '--'}</td><td></td></tr>
        <tr><td>Gas (MQ-2)</td><td>${d?.gasIndex ?? d?.gas?.index_mq2 ?? '--'}</td><td></td></tr>
        <tr><td>Gas (MQ-135)</td><td>${d?.gas?.index_mq135 ?? '--'}</td><td></td></tr>
        <tr><td>Internal Resistance</td><td>${d?.resistance ?? d?.battery?.resistance ?? '--'}</td><td>mΩ</td></tr>
        <tr><td>Firmware</td><td>${d?.firmware ?? '--'}</td><td></td></tr>
        <tr><td>MAC</td><td>${d?.mac ?? '--'}</td><td></td></tr>
      </table>
      <div class="footer">Battery Vital v2.0 — This is an external monitoring system, not a certified BMS.</div>
    </body></html>`);
    w.document.close();
    w.print();
  },

  // Chart image export
  chartImage(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${canvasId}_${new Date().toISOString().slice(0,10)}.png`;
    a.click();
    UI.toast('Chart image saved', 'success');
  }
};

function exportDashboardJSON() { ExportUtil.dashboardJSON(); }
function exportDashboardCSV() { ExportUtil.dashboardCSV(); }
function printDashboard() { ExportUtil.printView(); }
function shareDashboard() {
  const d = App.telemetry;
  const text = `Battery Vital Snapshot\nV: ${d?.voltage ?? '--'}V | I: ${d?.current ?? '--'}A | SOC: ${d?.soc ?? '--'}% | BHI: ${d?.bhi ?? d?.risk?.bhi ?? '--'} | Safety: ${d?.safety ?? d?.battery?.safety ?? '--'}`;
  if (navigator.share) {
    navigator.share({ title: 'Battery Vital', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => UI.toast('Snapshot copied to clipboard', 'success'));
  }
}
