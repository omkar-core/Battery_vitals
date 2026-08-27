// ===== SYSTEM CONNECTIONS STATUS =====
const STATUS_POLL = 10000; // check every 10s
let statusTimer = null;
let lastStatus = null;

function setStatusCard(cardId, pillId, descId, state, desc) {
  const card = document.getElementById(cardId);
  const pill = document.getElementById(pillId);
  const descEl = document.getElementById(descId);
  if (card) card.className = 'conn-status-card ' + state.cls;
  if (pill) { pill.className = 'status-pill ' + state.cls; pill.textContent = state.label; }
  if (descEl) descEl.textContent = desc;
}

const STATUS_CLASS = {
  ok:      { cls: 'green',  label: 'Active' },
  warn:    { cls: 'yellow', label: 'Stale'  },
  error:   { cls: 'red',    label: 'Offline' },
  checking:{ cls: 'green',  label: 'Checking' }
};

async function fetchStatus() {
  try {
    const resp = await fetch(CFG.apiBase + '/status', { signal: AbortSignal.timeout(7000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    applyStatus(data);
  } catch (e) {
    setStatusCard('statusMongoCard', 'statusMongoPill', 'statusMongoDesc', STATUS_CLASS.error, 'Cannot reach server');
    setStatusCard('statusGeminiCard', 'statusGeminiPill', 'statusGeminiDesc', STATUS_CLASS.error, 'Cannot reach server');
    setStatusCard('statusEsp32Card',  'statusEsp32Pill',  'statusEsp32Desc',  STATUS_CLASS.error, 'Cannot reach server');
  }
}

function friendlyAge(sec) {
  if (sec == null) return 'never';
  if (sec < 60) return sec + 's ago';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'm ago';
}

function applyStatus(data) {
  // ---- MongoDB ----
  let mongoState, mongoDesc;
  if (data.mongodb.connected) {
    mongoState = STATUS_CLASS.ok;
    mongoDesc = 'Connected to database';
  } else if (data.mongodb.configured) {
    mongoState = STATUS_CLASS.error;
    mongoDesc = 'Connection failed — check MONGODB_URI in Vercel';
  } else {
    mongoState = STATUS_CLASS.error;
    mongoDesc = 'MONGODB_URI not configured on Vercel';
  }
  setStatusCard('statusMongoCard', 'statusMongoPill', 'statusMongoDesc', mongoState, mongoDesc);

  // ---- Gemini AI ----
  let geminiState, geminiDesc;
  if (data.gemini.active) {
    geminiState = STATUS_CLASS.ok;
    geminiDesc = 'API key active ✓';
  } else {
    geminiState = STATUS_CLASS.error;
    geminiDesc = 'GEMINI_API_KEY not set on Vercel';
  }
  setStatusCard('statusGeminiCard', 'statusGeminiPill', 'statusGeminiDesc', geminiState, geminiDesc);

  // ---- ESP32 ----
  let espState, espDesc;
  if (data.esp32.connected) {
    espState = STATUS_CLASS.ok;
    espDesc = 'Device online — ' + friendlyAge(data.esp32.ageSeconds);
  } else if (data.esp32.hasData) {
    espState = STATUS_CLASS.warn;
    espDesc = 'Last seen ' + friendlyAge(data.esp32.ageSeconds) + ' (stale)';
  } else {
    espState = STATUS_CLASS.error;
    espDesc = 'No data received yet — is ESP32 powered?';
  }
  setStatusCard('statusEsp32Card', 'statusEsp32Pill', 'statusEsp32Desc', espState, espDesc);

  notifyStatusChange(data, mongoState, espState);
}

// Show friendly popups only when a connection state actually changes
function notifyStatusChange(data, mongoState, espState) {
  if (!lastStatus) { lastStatus = { d: data.mongodb.connected, e: data.esp32.connected, g: data.gemini.active }; return; }

  const prev = lastStatus;
  const statusMap = { db: 'MongoDB database', esp: 'ESP32 device', gemini: 'Gemini AI' };

  if (prev.d !== data.mongodb.connected) {
    showToast(data.mongodb.connected
      ? '✓ MongoDB database connected successfully'
      : '⚠ MongoDB database not connected — sensor data cannot be saved',
      data.mongodb.connected ? 'success' : 'error', 4000);
  }
  if (prev.e !== data.esp32.connected) {
    if (data.esp32.connected) {
      showToast('✓ ESP32 device is now connected — live data flowing', 'success', 4000);
    } else if (data.esp32.hasData) {
      showToast('⚠ ESP32 device not sending data (last seen ' + friendlyAge(data.esp32.ageSeconds) + ')', 'warning', 4000);
    } else {
      showToast('⚠ ESP32 not connected — waiting for first data packet', 'warning', 4000);
    }
  }
  if (prev.g && !data.gemini.active) {
    showToast('⚠ Gemini AI key missing — AI analysis may fail', 'warning', 4000);
  } else if (!prev.g && data.gemini.active) {
    showToast('✓ Gemini AI is active and ready', 'success', 4000);
  }

  lastStatus = { d: data.mongodb.connected, e: data.esp32.connected, g: data.gemini.active };
}

function startStatusLoop() {
  fetchStatus();
  if (statusTimer) clearInterval(statusTimer);
  statusTimer = setInterval(fetchStatus, STATUS_POLL);
}

function refreshStatus() {
  fetchStatus();
  showToast('Checking connections...', 'info', 1500);
}
