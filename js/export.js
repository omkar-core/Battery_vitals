// js/export.js — Export, print, share utilities
const ExportUtil = {
  // Export full dashboard state as JSON
  dashboardJSON() {
    const d = state.lastData || {};
    const data = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      telemetry: d,
      settings: JSON.parse(localStorage.getItem('bv_settings') || '{}'),
      alerts: state.alertLog || []
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battery_vitals_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Full data exported as JSON', 'success');
  },

  // Export current readings as CSV
  dashboardCSV() {
    const d = state.lastData;
    if (!d) return showToast('No data to export', 'info');
    const rows = [
      ['Metric', 'Value', 'Unit'],
      ['Voltage', d.battery?.voltage ?? d.voltage ?? '', 'V'],
      ['Current', d.battery?.current ?? d.current ?? '', 'A'],
      ['Power', d.battery?.power ?? d.power ?? '', 'W'],
      ['SOC', d.battery?.soc ?? d.soc ?? '', '%'],
      ['SOH', d.battery?.soh ?? d.soh ?? '', '%'],
      ['Temperature', d.environment?.temperature ?? d.temperature ?? '', '°C'],
      ['Humidity', d.environment?.humidity ?? d.humidity ?? '', '%'],
      ['BHI', d.risk?.bhi ?? d.bhi ?? '', ''],
      ['Safety', d.battery?.safety ?? d.safety ?? '', ''],
      ['Gas Index MQ2', d.gas?.index_mq2 ?? '', ''],
      ['Gas Index MQ135', d.gas?.index_mq135 ?? '', ''],
      ['Resistance', d.battery?.resistance ?? d.resistance ?? '', 'mΩ'],
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
    showToast('Current readings exported as CSV', 'success');
  },

  // Print-optimized view
  printView() {
    const d = state.lastData;
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
        <tr><td>Voltage</td><td>${d?.battery?.voltage ?? d?.voltage ?? '--'}</td><td>V</td></tr>
        <tr><td>Current</td><td>${d?.battery?.current ?? d?.current ?? '--'}</td><td>A</td></tr>
        <tr><td>Power</td><td>${d?.battery?.power ?? d?.power ?? '--'}</td><td>W</td></tr>
        <tr><td>SOC</td><td>${d?.battery?.soc ?? d?.soc ?? '--'}</td><td>%</td></tr>
        <tr><td>SOH</td><td>${d?.battery?.soh ?? d?.soh ?? '--'}</td><td>%</td></tr>
        <tr><td>Temperature</td><td>${d?.environment?.temperature ?? d?.temperature ?? '--'}</td><td>°C</td></tr>
        <tr><td>Humidity</td><td>${d?.environment?.humidity ?? d?.humidity ?? '--'}</td><td>%</td></tr>
        <tr><td>BHI Score</td><td>${d?.risk?.bhi ?? d?.bhi ?? '--'}</td><td></td></tr>
        <tr><td>Safety State</td><td>${d?.battery?.safety ?? d?.safety ?? '--'}</td><td></td></tr>
        <tr><td>Gas (MQ-2)</td><td>${d?.gas?.index_mq2 ?? '--'}</td><td></td></tr>
        <tr><td>Gas (MQ-135)</td><td>${d?.gas?.index_mq135 ?? '--'}</td><td></td></tr>
        <tr><td>Internal Resistance</td><td>${d?.battery?.resistance ?? d?.resistance ?? '--'}</td><td>mΩ</td></tr>
        <tr><td>Firmware</td><td>${d?.firmware ?? '--'}</td><td></td></tr>
        <tr><td>MAC</td><td>${d?.mac ?? '--'}</td><td></td></tr>
      </table>
      <div class="footer">Battery Vital v2.0 — This is an external monitoring system, not a certified BMS.</div>
    </body></html>`);
    w.document.close();
    w.print();
  },

};

function exportDashboardJSON() { ExportUtil.dashboardJSON(); }
function exportDashboardCSV() { ExportUtil.dashboardCSV(); }
function printDashboard() { ExportUtil.printView(); }
function shareDashboard() {
  const d = state.lastData;
  const text = `Battery Vital Snapshot\nV: ${d?.battery?.voltage ?? d?.voltage ?? '--'}V | I: ${d?.battery?.current ?? d?.current ?? '--'}A | SOC: ${d?.battery?.soc ?? d?.soc ?? '--'}% | BHI: ${d?.risk?.bhi ?? d?.bhi ?? '--'} | Safety: ${d?.battery?.safety ?? d?.safety ?? '--'}`;
  if (navigator.share) {
    navigator.share({ title: 'Battery Vital', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Snapshot copied to clipboard', 'success'));
  }
}
