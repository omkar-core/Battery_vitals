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

// ===== SKELETON LOADERS =====
function showSkeletons() {
  document.querySelectorAll('.skeleton-overlay').forEach(el => { el.style.display = 'flex'; });
}
function hideSkeletons() {
  document.querySelectorAll('.skeleton-overlay').forEach(el => { el.style.display = 'none'; });
}

// ===== MODAL CLOSE ON OVERLAY CLICK =====
document.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// ===== MODAL CLOSE ON ESCAPE =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ===== ANIMATED NUMBER COUNTER =====
function animateNumber(el, target, duration = 600) {
  if (!el) return;
  const start = parseFloat(el.textContent) || 0;
  const diff = target - start;
  if (Math.abs(diff) < 0.1) { el.textContent = typeof target === 'number' && target % 1 !== 0 ? target.toFixed(1) : Math.round(target); return; }
  
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + diff * eased;
    el.textContent = typeof target === 'number' && target % 1 !== 0 ? current.toFixed(1) : Math.round(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
