// ============================================================
// CTIE Startup Dashboard
// Made with ❤ ~rhc · EE Lab, KLE-CTIE
// ============================================================

// ⚠ PASTE YOUR GAS WEB APP URL HERE (the /exec URL, no query string)
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwwUelf9S-oeiqWCrn9IrpELBedAX2XU5PJfqorvqzijbVsu5V5DMdbWxIUVhvCiuI/exec';

// State
let DATA = null;
let charts = {};

// ============ ELEMENTS ============
const $ = (id) => document.getElementById(id);

const els = {
  gate: $('login-gate'),
  dashboard: $('dashboard'),
  loading: $('loading'),
  pwInput: $('pw-input'),
  pwSubmit: $('pw-submit'),
  pwError: $('pw-error'),
  refresh: $('refresh-btn'),
  export: $('export-btn'),
  search: $('search'),
  statusFilter: $('status-filter'),
  lastUpdated: $('last-updated'),
};

// ============ LOGIN ============
function attemptLogin() {
  const pw = els.pwInput.value.trim();
  if (!pw) {
    showError('Please enter the password.');
    return;
  }

  els.pwSubmit.disabled = true;
  els.pwSubmit.textContent = 'Verifying…';
  els.pwError.style.display = 'none';

  fetchData(pw)
    .then(data => {
      sessionStorage.setItem('ctie_pw', pw);
      DATA = data;
      els.gate.style.display = 'none';
      els.dashboard.style.display = 'block';
      renderAll();
    })
    .catch(err => {
      showError(err.message || 'Login failed. Check the password and try again.');
      els.pwSubmit.disabled = false;
      els.pwSubmit.textContent = 'Unlock Dashboard →';
    });
}

function showError(msg) {
  els.pwError.textContent = msg;
  els.pwError.style.display = 'block';
}

els.pwSubmit.addEventListener('click', attemptLogin);
els.pwInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') attemptLogin();
});

// Auto-restore session if already authenticated
window.addEventListener('load', () => {
  const cached = sessionStorage.getItem('ctie_pw');
  if (cached) {
    els.pwInput.value = cached;
    attemptLogin();
  }
});

// ============ DATA FETCH ============
async function fetchData(pw) {
  if (GAS_ENDPOINT.indexOf('PASTE') === 0) {
    throw new Error('GAS_ENDPOINT not configured. Edit dashboard.js.');
  }
  const url = `${GAS_ENDPOINT}?page=dashboardData&pw=${encodeURIComponent(pw)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Network error (' + resp.status + ').');
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ============ REFRESH ============
els.refresh.addEventListener('click', async () => {
  const pw = sessionStorage.getItem('ctie_pw');
  if (!pw) return;
  els.loading.style.display = 'flex';
  try {
    DATA = await fetchData(pw);
    renderAll();
  } catch (err) {
    alert('Refresh failed: ' + err.message);
  } finally {
    els.loading.style.display = 'none';
  }
});

// ============ RENDER ============
function renderAll() {
  renderKPIs();
  renderFunnel();
  renderDailyChart();
  renderDomainChart();
  renderStageChart();
  renderTable();
  els.lastUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function renderKPIs() {
  const { total, sent, clicked, submitted } = DATA.counts;
  $('kpi-total').textContent = total;
  $('kpi-sent').textContent = sent;
  $('kpi-clicked').textContent = clicked;
  $('kpi-submitted').textContent = submitted;
  $('kpi-sent-pct').textContent      = pct(sent, total) + ' of total';
  $('kpi-clicked-pct').textContent   = pct(clicked, sent) + ' of sent';
  $('kpi-submitted-pct').textContent = pct(submitted, sent) + ' of sent';
}

function pct(num, denom) {
  if (!denom) return '0%';
  return Math.round((num / denom) * 100) + '%';
}

function renderFunnel() {
  const { total, sent, clicked, submitted } = DATA.counts;
  const max = total || 1;
  const rows = [
    { label: 'Invited',   value: sent,      width: (sent/max)*100 },
    { label: 'Clicked',   value: clicked,   width: (clicked/max)*100 },
    { label: 'Submitted', value: submitted, width: (submitted/max)*100 },
  ];
  $('funnel').innerHTML = rows.map(r => `
    <div class="funnel-row">
      <div class="funnel-label">${r.label}</div>
      <div class="funnel-bar" style="width:${Math.max(r.width, 8)}%;">${r.value}</div>
      <div class="funnel-meta">${pct(r.value, total)}</div>
    </div>
  `).join('');
}

function renderDailyChart() {
  destroyChart('activity');
  const ctx = $('activity-chart').getContext('2d');
  const days = DATA.daily.dates;
  charts.activity = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [
        { label: 'Clicks', data: DATA.daily.clicks, borderColor: '#1a3d8f', backgroundColor: 'rgba(26,61,143,0.1)', tension: 0.3, fill: true },
        { label: 'Submissions', data: DATA.daily.submissions, borderColor: '#C8960C', backgroundColor: 'rgba(200,150,12,0.1)', tension: 0.3, fill: true },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
        x: { ticks: { font: { size: 10 } } }
      }
    }
  });
}

function renderDomainChart() {
  destroyChart('domain');
  const ctx = $('domain-chart').getContext('2d');
  const entries = Object.entries(DATA.domains).sort((a, b) => b[1] - a[1]);
  charts.domain = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: '#0C2D6B',
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

function renderStageChart() {
  destroyChart('stage');
  const ctx = $('stage-chart').getContext('2d');
  const entries = Object.entries(DATA.stages);
  charts.stage = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{
        data: entries.map(e => e[1]),
        backgroundColor: ['#0C2D6B', '#1a3d8f', '#C8960C', '#e0ad24'],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12 } } },
    }
  });
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

// ============ TABLE ============
function renderTable() {
  const search = els.search.value.toLowerCase().trim();
  const filter = els.statusFilter.value;

  const rows = DATA.startups.filter(s => {
    if (search) {
      const hay = (s.startup + ' ' + s.founder + ' ' + s.email).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (filter === 'submitted' && !s.submitted) return false;
    if (filter === 'clicked'   && (s.submitted || s.clicks === 0)) return false;
    if (filter === 'sent'      && (s.clicks > 0 || !s.sent || s.submitted)) return false;
    if (filter === 'pending'   && s.sent) return false;
    return true;
  });

  $('status-tbody').innerHTML = rows.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(s.startup)}</strong></td>
      <td>${escapeHtml(s.founder)}</td>
      <td style="color:var(--muted);font-size:12px;">${escapeHtml(s.email)}</td>
      <td>${s.sent ? '<span class="pill pill-info">Sent</span>' : '<span class="pill pill-muted">—</span>'}</td>
      <td>${s.clicks > 0 ? `<span class="pill pill-warn">${s.clicks}</span>` : '<span class="pill pill-muted">0</span>'}</td>
      <td>${s.submitted ? '<span class="pill pill-success">✓</span>' : '<span class="pill pill-muted">—</span>'}</td>
    </tr>
  `).join('');

  $('table-meta').textContent = `Showing ${rows.length} of ${DATA.startups.length} startups`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

els.search.addEventListener('input', renderTable);
els.statusFilter.addEventListener('change', renderTable);

// ============ EXPORT CSV ============
els.export.addEventListener('click', () => {
  if (!DATA) return;
  const headers = ['Startup', 'Founder', 'Email', 'Sent', 'Clicks', 'Submitted', 'Submitted At'];
  const rows = DATA.startups.map(s => [
    s.startup, s.founder, s.email,
    s.sent ? 'Yes' : 'No',
    s.clicks,
    s.submitted ? 'Yes' : 'No',
    s.submittedAt || ''
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ctie-startup-status-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
