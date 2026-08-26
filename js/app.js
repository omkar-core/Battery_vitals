// ===== CONFIG =====
const CFG = {
  apiBase: '/api',
  pollInterval: 3000,
  maxHistory: 300,
  version: '1.1',
  useMongoDB: true, // Set to false for demo/offline mode
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
  isDemo: false,
  chartPaused: false,
  chartWindow: 1,
  updatedAgo: 0,
  uptimeSec: 0,
  totalRequests: 0,
  errors: 0,
  lastSafety: '',
  fetchTimer: null,
  demoTimer: null,
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

// ===== INIT =====
function init() {
  loadSettings();
  loadAlertLog();
  applyRoute();
  startTimers();
  renderAutoMode();
  startFetchLoop();
}

document.addEventListener('DOMContentLoaded', init);
