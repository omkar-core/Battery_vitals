const PAGES = ['dashboard', 'trends', 'controls', 'ai', 'alerts', 'history', 'settings', 'passport', 'diagnostics', 'coming-soon'];
const PAGE_TITLES = { dashboard: 'Dashboard', trends: 'Trends', controls: 'Controls', ai: 'AI Analyst', alerts: 'Alerts', history: 'History', settings: 'Settings', passport: 'Battery Passport', diagnostics: 'Diagnostics', 'coming-soon': 'Coming Soon' };

function navigateTo(page) {
  if (!PAGES.includes(page)) page = 'dashboard';
  window.location.hash = '#' + page;
}

function applyRoute() {
  let hash = window.location.hash.replace('#', '') || 'dashboard';
  if (!PAGES.includes(hash)) hash = 'dashboard';
  PAGES.forEach(p => {
    const sec = document.getElementById('page-' + p);
    if (sec) sec.classList.toggle('active', p === hash);
  });
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === hash));
  document.querySelectorAll('.tab-link').forEach(l => l.classList.toggle('active', l.dataset.page === hash));
  document.getElementById('pageTitle').textContent = PAGE_TITLES[hash] || 'Dashboard';
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('headerDropdown').classList.remove('show');
  if (hash === 'trends' && !mainChart) initCharts();
  if (hash === 'passport' && typeof Passport !== 'undefined') Passport.init();
  if (hash === 'history') { initHistoryChart(); updateHistoryChart(); if (typeof renderSessionLog === 'function') renderSessionLog(); }
  if (hash === 'coming-soon' && typeof ComingSoon !== 'undefined') ComingSoon.init();
  if (hash === 'ai') {
    if (typeof fetchAIHistory === 'function') fetchAIHistory();
    if (typeof autoFillAIFromLive === 'function') autoFillAIFromLive();
  }
  if (hash === 'diagnostics' && typeof Diagnostics !== 'undefined' && typeof Diagnostics.updateConnectivity === 'function') Diagnostics.updateConnectivity();
  if (hash === 'diagnostics' && typeof Diagnostics !== 'undefined' && typeof Diagnostics.renderRawLog === 'function') Diagnostics.renderRawLog();
  if (hash === 'alerts' && typeof restoreQuietHoursUI === 'function') restoreQuietHoursUI();
  if (hash === 'controls' && typeof syncControlStateFromTelemetry === 'function') syncControlStateFromTelemetry();
}

window.addEventListener('hashchange', applyRoute);
