// ===== TOAST =====
function showToast(msg, type, dur) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + (type || 'success');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, dur || 3000);
}

// ===== MODAL =====
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

// ===== HELPERS =====
function n(v, d = 2) { return v != null && typeof v === 'number' ? v.toFixed(d) : '--'; }

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v ?? '--';
}

function updateVal(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  if (v == null) el.textContent = '--';
  else if (typeof v === 'number') el.textContent = v % 1 !== 0 ? v.toFixed(1) : v;
  else el.textContent = v;
}

function fmtTime(s) {
  return String(Math.floor(s / 3600)).padStart(2, '0') + ':' +
    String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' +
    String(s % 60).padStart(2, '0');
}
