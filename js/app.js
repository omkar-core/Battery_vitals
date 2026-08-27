// ===== CONFIG =====
const CFG = {
  apiBase: '/api',
  pollInterval: 3000,
  maxHistory: 300,
  version: '2.0',
  useMongoDB: true,
};

// ===== STATE =====
let state = {
  connState: 'connecting',
  lastDataTs: 0,
  lastData: null,
  history: [],
  alertLog: [],
  autoMode: true,
  ledStates: { green: false, yellow: false, red: false, buzzer: false },
  tempUnit: 'C',
  soundEnabled: true,
  chartPaused: false,
  chartWindow: 1,
  updatedAgo: 0,
  uptimeSec: 0,
  totalRequests: 0,
  errors: 0,
  lastSafety: '',
  lastBhi: undefined,
  fetchTimer: null,
  serverConnected: false,
};

// ===== TIMERS =====
function startTimers() {
  setInterval(() => {
    state.uptimeSec++;
    const up = fmtTime(state.uptimeSec);
    setText('uptimeDisplay', up);
    setText('ddUptime', up);
  }, 1000);
  setInterval(() => {
    if (state.lastDataTs > 0) {
      state.updatedAgo = Math.floor((Date.now() - state.lastDataTs) / 1000);
      const txt = state.updatedAgo + 's ago';
      setText('updatedDisplay', txt);
      setText('ddUpdated', txt);
      setText('bhiTimestamp', txt);
    }
    updateConnState();
  }, 1000);
}

// ===== CONNECTION STATE MACHINE =====
function updateConnState() {
  const now = Date.now();
  const age = state.lastDataTs > 0 ? (now - state.lastDataTs) / 1000 : Infinity;
  let newState;
  if (state.lastDataTs === 0) newState = 'connecting';
  else if (age < 30) newState = 'live';
  else if (age < 120) newState = 'stale';
  else newState = 'offline';

  if (newState !== state.connState) {
    state.connState = newState;
    const badge = document.getElementById('connBadge');
    const text = document.getElementById('connText');
    badge.className = 'conn-badge ' + newState;
    const labels = { connecting: 'CONNECTING', live: 'LIVE', stale: 'STALE', offline: 'OFFLINE' };
    text.textContent = labels[newState];
    const sysBadge = document.getElementById('sysMiniBadge');
    if (newState === 'live') { sysBadge.className = 'card-badge live'; sysBadge.textContent = 'Online'; }
    else if (newState === 'stale') { sysBadge.className = 'card-badge warm'; sysBadge.textContent = 'Stale'; }
    else { sysBadge.className = 'card-badge'; sysBadge.textContent = 'Offline'; sysBadge.style.cssText = 'background:rgba(255,45,85,0.1);color:var(--red);border:1px solid rgba(255,45,85,0.1)'; }
  }
}

// ===== MOBILE =====
function toggleMobileMenu() {
  const dd = document.getElementById('headerDropdown');
  dd.classList.toggle('show');
}

document.addEventListener('click', (e) => {
  const dd = document.getElementById('headerDropdown');
  const hb = document.getElementById('hamburgerBtn');
  if (dd && !dd.contains(e.target) && !hb.contains(e.target)) dd.classList.remove('show');
});

// No auth — app is fully open, no login/register/logout needed


// ===== GLOBAL ERROR HANDLER =====
window.addEventListener('error', (e) => {
  console.error('Uncaught error:', e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const shortcuts = { d: 'dashboard', t: 'trends', c: 'controls', a: 'ai', l: 'alerts', s: 'settings' };
  if (shortcuts[e.key.toLowerCase()]) {
    e.preventDefault();
    navigateTo(shortcuts[e.key.toLowerCase()]);
  }
});

// ===== INIT =====
function init() {
  // Hide loading screen
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    setTimeout(() => loadingScreen.classList.add('hidden'), 600);
  }

  loadTheme();
  loadSettings();
  loadAlertLog();
  applyRoute();
  startTimers();
  renderAutoMode();
  startFetchLoop();
}

document.addEventListener('DOMContentLoaded', init);

// ===== THEME =====
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? null : 'light';
  if (next) {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('bvTheme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('bvTheme', 'dark');
  }
  document.querySelector('.theme-toggle-btn').textContent = next ? '\u2600' : '\u263E';
}

function loadTheme() {
  const saved = localStorage.getItem('bvTheme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.querySelector('.theme-toggle-btn');
    if (btn) btn.textContent = '\u2600';
  }
}
