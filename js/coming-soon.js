// js/coming-soon.js — Upcoming features roadmap with development progress
const ComingSoon = {
  features: [
    { name: 'Mobile & Desktop Push Notifications', desc: 'Real-time battery alerts pushed to your device the moment a hazard is detected.', progress: 85 },
    { name: 'Multi-Battery Fleet View', desc: 'Monitor multiple ESP32 units side by side from a single dashboard.', progress: 60 },
    { name: 'Predictive Maintenance Reports', desc: 'Auto-generated weekly health reports with actionable maintenance recommendations.', progress: 40 },
    { name: 'Historical Trend Export (PDF)', desc: 'One-click PDF export of charts and history for records and reporting.', progress: 25 },
    { name: 'Voice-Activated Controls', desc: 'Use voice commands to toggle outputs and run diagnostics hands-free.', progress: 10 },
    { name: 'Geofencing & Location Alerts', desc: 'Alerts triggered when the monitored battery moves outside a safe area.', progress: 5 }
  ],
  render() {
    const list = document.getElementById('comingSoonList');
    if (!list) return;
    list.innerHTML = this.features.map((f, i) => {
      const active = f.progress > 0;
      return `<div style="display:flex;gap:14px;align-items:flex-start;padding:12px 14px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05)">
        <div style="flex-shrink:0;width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;${active ? 'background:var(--blue);color:#fff' : 'background:rgba(255,255,255,0.05);color:var(--text-muted)'}">${active ? '\u2713' : '\u23F3'}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:600;color:${active ? 'var(--text-primary)' : 'var(--text-muted)'}">${f.name}</span>
            <span class="status-pill ${active ? 'yellow' : ''}" style="font-size:9px;padding:2px 8px">${active ? 'In Development' : 'Planned'}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${f.desc}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
            <div style="flex:1;height:5px;border-radius:99px;background:rgba(255,255,255,0.06);overflow:hidden">
              <div style="height:100%;width:${f.progress}%;border-radius:99px;background:${active ? 'var(--emerald)' : 'rgba(255,255,255,0.15)'}"></div>
            </div>
            <span style="font-size:10px;font-family:var(--mono);color:var(--text-muted)">${f.progress}%</span>
          </div>
        </div>
      </div>`;
    }).join('');
  },
  init() {
    this.render();
  }
};
