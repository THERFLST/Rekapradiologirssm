const STORAGE_KEY = 'rekap-radiologi-v1';
const LOCK_KEY = 'rekap-radiologi-locks-v1';
const HISTORY_KEY = 'rekap-radiologi-history-v1';
const CURRENT_USER_KEY = 'rekap-radiologi-current-user';

const USERS = {
  admin: { username: 'admin', password: 'admin123', role: 'admin', name: 'Admin RS' },
  petugas: { username: 'petugas', password: 'petugas123', role: 'petugas', name: 'Petugas Radiologi' }
};

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const ORIGINS = [{key:'umum',label:'Umum'},{key:'spesialis',label:'Poli Spesialis'},{key:'ruangan',label:'Ruangan'},{key:'luarRs',label:'Luar RS'}];
const PAYERS = [{key:'bpjs',label:'BPJS'},{key:'umum',label:'Umum'},{key:'asuransi',label:'Asuransi'},{key:'naker',label:'Naker (keterangan)'}];
const EXAMS = [
  {key:'thoraxPa',label:'Thorax PA',group:'Non Kontras'},{key:'thoraxPaLat',label:'Thorax PA & Lat',group:'Non Kontras'},
  {key:'extremitas',label:'Extremitas',group:'Non Kontras'},{key:'extremitasBilateral',label:'Extremitas Bilateral',group:'Non Kontras'},
  {key:'columnaVertebralis',label:'Columna Vertebralis',group:'Non Kontras'},{key:'columnaVert4Posisi',label:'Columna Vert 4 Posisi',group:'Non Kontras'},
  {key:'cranium',label:'Cranium',group:'Non Kontras'},{key:'sinus',label:'Sinus',group:'Non Kontras'},
  {key:'bnoAbdomen',label:'BNO/Abdomen',group:'Non Kontras'},{key:'abdomen3Posisi',label:'Abdomen 3 Posisi',group:'Non Kontras'},
  {key:'pelvis',label:'Pelvis',group:'Non Kontras'},{key:'pelvis2Posisi',label:'Pelvis 2 Posisi',group:'Non Kontras'},
  {key:'omdOesophagografi',label:'OMD/Oesophagografi',group:'Kontras'},{key:'md',label:'MD',group:'Kontras'},
  {key:'arthrografi',label:'Arthrografi',group:'Kontras'},{key:'cholecystografi',label:'Cholecystografi',group:'Kontras'},
  {key:'urethrocystografi',label:'Urethrocystografi',group:'Kontras'},{key:'hsg',label:'HSG',group:'Kontras'},
  {key:'colonInloop',label:'Colon Inloop (B. Enema)',group:'Kontras'},{key:'bnoIvp',label:'BNO-IVP',group:'Kontras'},
  {key:'rpg',label:'RPG',group:'Kontras'},{key:'corAnalisa',label:'COR Analisa',group:'Kontras'},
  {key:'appendicogram',label:'Appendicogram',group:'Kontras'}
];

const state = {
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  date: formatDate(new Date()),
  data: loadData(),
  locks: loadLocks(),
  history: loadHistory(),
  currentUser: loadCurrentUser()
};

function loadData() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
function loadLocks() { try { return JSON.parse(localStorage.getItem(LOCK_KEY) || '{}'); } catch { return {}; } }
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function loadCurrentUser() { try { return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null'); } catch { return null; } }

function persistData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data)); }
function persistLocks() { localStorage.setItem(LOCK_KEY, JSON.stringify(state.locks)); }
function persistHistory() { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 25))); }
function persistCurrentUser() { if (state.currentUser) localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(state.currentUser)); else localStorage.removeItem(CURRENT_USER_KEY); }

function monthKey() { return `${state.year}-${String(state.month + 1).padStart(2, '0')}`; }
function dateKey(dateObj) { return formatDate(dateObj); }
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function formatDisplayDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function daysInMonth() { return new Date(state.year, state.month + 1, 0).getDate(); }
function emptyDay() { const r = { source: {}, payer: {}, exams: {} }; for (const exam of EXAMS) r.exams[exam.key] = { pasien: '', ekspose: '' }; return r; }
function getDayRecord(dateStr = state.date) { if (!state.data[dateStr]) state.data[dateStr] = emptyDay(); return state.data[dateStr]; }
function num(v) { if (v === '' || v === null || v === undefined) return 0; const n = Number(v); return Number.isFinite(n) ? n : 0; }
function fmt(v) { return Number(v || 0).toLocaleString('id-ID'); }
function percent(value, total) { if (!total) return '0,0%'; return `${((value / total) * 100).toFixed(1).toString().replace('.', ',')}%`; }
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }

function isCurrentMonthLocked() { return !!(state.locks[monthKey()] && state.locks[monthKey()].locked); }
function canEditCurrentMonth() {
  if (!state.currentUser) return false;
  if (state.currentUser.role === 'admin') return true;
  return !isCurrentMonthLocked();
}
function isAdmin() { return state.currentUser && state.currentUser.role === 'admin'; }

function addHistory(action, detail) {
  if (!state.currentUser) return;
  state.history.unshift({
    by: state.currentUser.username,
    role: state.currentUser.role,
    action,
    detail,
    timestamp: new Date().toISOString()
  });
  state.history = state.history.slice(0, 20);
  persistHistory();
  renderHistory();
}

function renderHistory() {
  const list = state.history;
  if (!list.length) {
    document.getElementById('historyList').innerHTML = '<div class="history-empty">Belum ada riwayat perubahan.</div>';
    return;
  }

  document.getElementById('historyList').innerHTML = list.map(item => {
    const date = new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
    return `
      <div class="history-item">
        <small>${date} • ${item.by} (${item.role})</small>
        <strong>${item.action}</strong>
        <div>${item.detail}</div>
      </div>
    `;
  }).join('');
}

function renderLoginState() {
  const loggedIn = !!state.currentUser;
  document.getElementById('loginOverlay').classList.toggle('hidden', loggedIn);
  document.getElementById('mainApp').classList.toggle('hidden', !loggedIn);

  if (loggedIn) {
    document.getElementById('currentUserName').textContent = state.currentUser.name;
    document.getElementById('currentUserRole').textContent = state.currentUser.role;
    document.getElementById('monthLockStatus').textContent = isCurrentMonthLocked() ? 'Terkunci' : 'Terbuka';
  } else {
    document.getElementById('currentUserName').textContent = '-';
    document.getElementById('currentUserRole').textContent = '-';
    document.getElementById('monthLockStatus').textContent = 'Belum login';
  }

  updateLockButtons();
}

function updateLockButtons() {
  const canEdit = canEditCurrentMonth();
  document.getElementById('saveBtn').disabled = !canEdit;
  document.getElementById('saveBtn').style.opacity = canEdit ? '1' : '0.5';

  document.getElementById('lockBtn').style.display = isAdmin() ? 'inline-flex' : 'none';
  document.getElementById('unlockBtn').style.display = isAdmin() ? 'inline-flex' : 'none';

  const lockState = state.locks[monthKey()] && state.locks[monthKey()].locked ? 'Terkunci' : 'Terbuka';
  document.getElementById('monthLockStatus').textContent = lockState;
}

function signIn(username, password) {
  const user = Object.values(USERS).find(u => u.username === username && u.password === password);
  if (!user) return false;
  state.currentUser = user;
  persistCurrentUser();
  renderLoginState();
  renderAll();
  addHistory('Login', `User ${user.name} masuk ke sistem.`);
  return true;
}

function logout() {
  state.currentUser = null;
  persistCurrentUser();
  renderLoginState();
}

function bindEvents() {
  document.getElementById('loginForm').addEventListener('submit', event => {
    event.preventDefault();
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();
    if (!signIn(username, password)) {
      showToast('Username atau password salah.');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);

  document.getElementById('monthSelect').addEventListener('change', () => {
    state.month = Number(document.getElementById('monthSelect').value);
    state.date = `${state.year}-${String(state.month + 1).padStart(2, '0')}-01`;
    renderAll();
  });

  document.getElementById('yearSelect').addEventListener('change', () => {
    state.year = Number(document.getElementById('yearSelect').value);
    state.date = `${state.year}-${String(state.month + 1).padStart(2, '0')}-01`;
    renderAll();
  });

  document.getElementById('dateSelect').addEventListener('change', () => {
    if (!document.getElementById('dateSelect').value) return;
    state.date = document.getElementById('dateSelect').value;
    const d = new Date(`${state.date}T12:00:00`);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    renderAll();
  });

  document.getElementById('prevDay').addEventListener('click', () => {
    const d = new Date(`${state.date}T12:00:00`);
    d.setDate(d.getDate() - 1);
    state.date = formatDate(d);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    renderAll();
  });

  document.getElementById('nextDay').addEventListener('click', () => {
    const d = new Date(`${state.date}T12:00:00`);
    d.setDate(d.getDate() + 1);
    state.date = formatDate(d);
    state.year = d.getFullYear();
    state.month = d.getMonth();
    renderAll();
  });

  document.getElementById('clearDay').addEventListener('click', () => {
    if (!canEditCurrentMonth()) {
      showToast('Bulan ini terkunci. Hanya admin yang bisa membukanya.');
      return;
    }
    if (!confirm('Kosongkan semua angka untuk tanggal ini?')) return;
    delete state.data[state.date];
    persistData();
    addHistory('Hapus input tanggal', `Tanggal ${state.date} dibersihkan.`);
    renderAll();
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    if (!canEditCurrentMonth()) {
      showToast('Bulan ini terkunci. Tidak bisa mengubah data.');
      return;
    }
    persistData();
    addHistory('Simpan bulan', `Menyimpan data untuk ${MONTHS[state.month]} ${state.year}.`);
    showToast('Data berhasil disimpan.');
  });

  document.getElementById('lockBtn').addEventListener('click', () => {
    if (!isAdmin()) {
      showToast('Hanya admin yang bisa mengunci bulan.');
      return;
    }
    state.locks[monthKey()] = { locked: true, by: state.currentUser.username, at: new Date().toISOString() };
    persistLocks();
    addHistory('Kunci bulan', `Bulan ${MONTHS[state.month]} ${state.year} dikunci.`);
    renderAll();
    showToast('Bulan berhasil dikunci.');
  });

  document.getElementById('unlockBtn').addEventListener('click', () => {
    if (!isAdmin()) {
      showToast('Hanya admin yang bisa membuka kunci bulan.');
      return;
    }
    delete state.locks[monthKey()];
    persistLocks();
    addHistory('Buka kunci bulan', `Bulan ${MONTHS[state.month]} ${state.year} dibuka.`);
    renderAll();
    showToast('Kunci bulan dibuka.');
  });

  document.getElementById('excelBtn').addEventListener('click', exportExcelMonthlyReport);
  document.getElementById('pdfBtn').addEventListener('click', exportPdfMonthlyReport);
}

function renderPeriodControls() {
  const monthSelect = document.getElementById('monthSelect');
  monthSelect.innerHTML = MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  monthSelect.value = String(state.month);

  const yearSelect = document.getElementById('yearSelect');
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  yearSelect.value = String(state.year);
}

function renderFormFields() {
  const record = getDayRecord();
  document.getElementById('originFields').innerHTML = ORIGINS.map(item => {
    return `
      <label class="number-field">
        <span>${item.label}</span>
        <input type="number" min="0" step="1" inputmode="numeric" data-group="source" data-key="${item.key}" value="${record.source[item.key] ?? ''}" ${!canEditCurrentMonth() ? 'disabled' : ''} />
      </label>
    `;
  }).join('');

  document.getElementById('payerFields').innerHTML = PAYERS.map(item => {
    return `
      <label class="number-field">
        <span>${item.label}</span>
        <input type="number" min="0" step="1" inputmode="numeric" data-group="payer" data-key="${item.key}" value="${record.payer[item.key] ?? ''}" ${!canEditCurrentMonth() ? 'disabled' : ''} />
      </label>
    `;
  }).join('');

  const groups = ['Non Kontras', 'Kontras'];
  document.getElementById('examFields').innerHTML = groups.map(group => {
    const list = EXAMS.filter(exam => exam.group === group).map(exam => {
      return `
        <div class="exam-row">
          <div class="exam-name">${exam.label}</div>
          <label class="exam-number">
            <span>Pasien</span>
            <input type="number" min="0" step="1" inputmode="numeric" data-exam="${exam.key}" data-kind="pasien" value="${record.exams[exam.key]?.pasien ?? ''}" ${!canEditCurrentMonth() ? 'disabled' : ''} />
          </label>
          <label class="exam-number">
            <span>Ekspose</span>
            <input type="number" min="0" step="1" inputmode="numeric" data-exam="${exam.key}" data-kind="ekspose" value="${record.exams[exam.key]?.ekspose ?? ''}" ${!canEditCurrentMonth() ? 'disabled' : ''} />
          </label>
        </div>
      `;
    }).join('');

    return `<div class="exam-group"><h4>${group}</h4><div class="exam-grid">${list}</div></div>`;
  }).join('');

  bindInputs();
}

function bindInputs() {
  document.querySelectorAll('input[data-group]').forEach(input => {
    input.addEventListener('input', event => {
      if (!canEditCurrentMonth()) {
        showToast('Bulan ini terkunci. Tidak bisa mengubah data.');
        return;
      }
      const group = event.target.dataset.group;
      const key = event.target.dataset.key;
      const value = event.target.value === '' ? '' : Number(event.target.value);
      const record = getDayRecord();
      record[group][key] = value;
      persistData();
      addHistory('Edit harian', `Tanggal ${state.date} • ${group} • ${key}`);
      renderAll();
    });
  });

  document.querySelectorAll('input[data-exam]').forEach(input => {
    input.addEventListener('input', event => {
      if (!canEditCurrentMonth()) {
        showToast('Bulan ini terkunci. Tidak bisa mengubah data.');
        return;
      }
      const exam = event.target.dataset.exam;
      const kind = event.target.dataset.kind;
      const value = event.target.value === '' ? '' : Number(event.target.value);
      const record = getDayRecord();
      record.exams[exam] = record.exams[exam] || {};
      record.exams[exam][kind] = value;
      persistData();
      addHistory('Edit pemeriksaan', `Tanggal ${state.date} • ${exam} • ${kind}`);
      renderAll();
    });
  });
}

function getDailyStatus(record) {
  const errors = [];
  const originTotal = ORIGINS.reduce((sum, item) => sum + num(record.source[item.key]), 0);
  const payerTotal = PAYERS.filter(item => item.key !== 'naker').reduce((sum, item) => sum + num(record.payer[item.key]), 0);

  if (originTotal !== payerTotal) {
    errors.push(`Total asal pasien (${originTotal}) tidak sama dengan total penjamin (${payerTotal}).`);
  }

  EXAMS.forEach(exam => {
    const pasien = num(record.exams[exam.key]?.pasien);
    const ekspose = num(record.exams[exam.key]?.ekspose);
    if (ekspose < pasien) {
      errors.push(`Ekspose ${exam.label} (${ekspose}) lebih kecil dari pasien (${pasien}).`);
    }
  });

  return { ok: errors.length === 0, messages: errors };
}

function renderDailyIssues() {
  const issues = [];
  for (let d = 1; d <= daysInMonth(); d++) {
    const key = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const record = state.data[key] || emptyDay();
    const status = getDailyStatus(record);
    if (!status.ok) {
      issues.push({ date: d, messages: status.messages });
    }
  }

  const box = document.getElementById('dailyIssues');
  if (!issues.length) {
    box.innerHTML = '<p class="muted">Belum ada masalah.</p>';
    document.getElementById('issueCount')?.remove();
    return;
  }

  box.innerHTML = issues.map(issue => `
    <div class="issue-row">
      <span class="issue-badge err">!</span>
      <div>
        <strong>Tanggal ${issue.date}</strong>
        <div>${issue.messages.map(msg => `<div>• ${msg}</div>`).join('')}</div>
      </div>
    </div>
  `).join('');
}

function renderDailyTotals() {
  const record = getDayRecord();
  const totalVisit = ORIGINS.reduce((sum, item) => sum + num(record.source[item.key]), 0);
  const totalExam = EXAMS.reduce((sum, item) => sum + num(record.exams[item.key]?.pasien), 0);
  const totalExpose = EXAMS.reduce((sum, item) => sum + num(record.exams[item.key]?.ekspose), 0);
  const status = getDailyStatus(record);

  document.getElementById('dayVisits').textContent = fmt(totalVisit);
  document.getElementById('dayExams').textContent = fmt(totalExam);
  document.getElementById('dayExpose').textContent = fmt(totalExpose);
  const statusEl = document.getElementById('dayStatus');
  statusEl.textContent = status.ok ? 'OK' : 'Error';
  statusEl.classList.toggle('ok-text', status.ok);
  statusEl.classList.toggle('error-text', !status.ok);
}

function renderMonthlySummary() {
  const originTotals = { umum:0, spesialis:0, ruangan:0, luarRs:0 };
  const payerTotals = { bpjs:0, umum:0, asuransi:0, naker:0 };
  const examTotals = {};
  EXAMS.forEach(exam => { examTotals[exam.key] = { pasien:0, ekspose:0 }; });

  let visits = 0;
  let exams = 0;
  let expose = 0;

  for (let d = 1; d <= daysInMonth(); d++) {
    const key = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const record = state.data[key] || emptyDay();
    const dayVisit = ORIGINS.reduce((sum, item) => sum + num(record.source[item.key]), 0);
    const dayExam = EXAMS.reduce((sum, item) => sum + num(record.exams[item.key]?.pasien), 0);
    const dayExpose = EXAMS.reduce((sum, item) => sum + num(record.exams[item.key]?.ekspose), 0);

    visits += dayVisit;
    exams += dayExam;
    expose += dayExpose;

    ORIGINS.forEach(item => { originTotals[item.key] += num(record.source[item.key]); });
    PAYERS.forEach(item => { payerTotals[item.key] += num(record.payer[item.key]); });
    EXAMS.forEach(exam => {
      examTotals[exam.key].pasien += num(record.exams[exam.key]?.pasien);
      examTotals[exam.key].ekspose += num(record.exams[exam.key]?.ekspose);
    });
  }

  document.getElementById('summaryVisits').textContent = fmt(visits);
  document.getElementById('summaryExams').textContent = fmt(exams);
  document.getElementById('summaryExpose').textContent = fmt(expose);

  document.getElementById('originSummary').innerHTML = ORIGINS.map(item => {
    const v = originTotals[item.key];
    return `<div class="summary-line"><span>${item.label}</span><strong>${fmt(v)} <small>${percent(v, visits)}</small></strong></div>`;
  }).join('') + `<div class="summary-line total-line"><span>Total</span><strong>${fmt(visits)}</strong></div>`;

  const payerTotal = PAYERS.filter(item => item.key !== 'naker').reduce((sum, item) => sum + payerTotals[item.key], 0);
  document.getElementById('payerSummary').innerHTML = PAYERS.map(item => {
    const v = payerTotals[item.key];
    const pct = item.key === 'naker' ? 'Keterangan' : percent(v, payerTotal);
    return `<div class="summary-line"><span>${item.label}</span><strong>${fmt(v)} <small>${pct}</small></strong></div>`;
  }).join('') + `<div class="summary-line total-line"><span>Total penjamin</span><strong>${fmt(payerTotal)}</strong></div>`;

  let nonPasien = 0;
  let nonExpose = 0;
  let konPasien = 0;
  let konExpose = 0;

  const rows = EXAMS.map(exam => {
    const p = examTotals[exam.key].pasien;
    const e = examTotals[exam.key].ekspose;
    if (exam.group === 'Non Kontras') {
      nonPasien += p;
      nonExpose += e;
    } else {
      konPasien += p;
      konExpose += e;
    }
    return `<tr><td>${exam.label}</td><td>${fmt(p)}</td><td>${fmt(e)}</td></tr>`;
  }).join('');

  document.getElementById('examSummary').innerHTML = rows + `
    <tr class="subtotal"><td>Subtotal Non Kontras</td><td>${fmt(nonPasien)}</td><td>${fmt(nonExpose)}</td></tr>
    <tr class="subtotal"><td>Subtotal Kontras</td><td>${fmt(konPasien)}</td><td>${fmt(konExpose)}</td></tr>
    <tr class="grand-total"><td>Grand Total</td><td>${fmt(nonPasien + konPasien)}</td><td>${fmt(nonExpose + konExpose)}</td></tr>
  `;
}

function renderDateHeader() {
  const d = new Date(`${state.date}T12:00:00`);
  const caption = formatDisplayDate(state.date);
  document.getElementById('dateCaption').textContent = caption;
  document.getElementById('dateSelect').value = state.date;
}

function renderAll() {
  renderDateHeader();
  renderPeriodControls();
  renderFormFields();
  renderDailyTotals();
  renderDailyIssues();
  renderMonthlySummary();
  renderHistory();
  renderLoginState();
  updateLockButtons();
}

function setDefaultDate() {
  let d = new Date();
  if (state.year && state.month) {
    d = new Date(state.year, state.month, 1);
  }
  state.date = formatDate(d);
}

function exportExcelMonthlyReport() {
  const originTotals = { umum:0, spesialis:0, ruangan:0, luarRs:0 };
  const payerTotals = { bpjs:0, umum:0, asuransi:0, naker:0 };
  const examTotals = {};
  EXAMS.forEach(exam => { examTotals[exam.key] = { pasien:0, ekspose:0 }; });

  for (let d = 1; d <= daysInMonth(); d++) {
    const key = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const record = state.data[key] || emptyDay();
    ORIGINS.forEach(item => { originTotals[item.key] += num(record.source[item.key]); });
    PAYERS.forEach(item => { payerTotals[item.key] += num(record.payer[item.key]); });
    EXAMS.forEach(exam => {
      examTotals[exam.key].pasien += num(record.exams[exam.key]?.pasien);
      examTotals[exam.key].ekspose += num(record.exams[exam.key]?.ekspose);
    });
  }

  const rows = [];
  rows.push(['Rekap Pasien Radiologi']);
  rows.push(['Periode', `${MONTHS[state.month]} ${state.year}`]);
  rows.push([]);
  rows.push(['Asal Pasien', 'Jumlah', 'Persentase']);
  const visitTotal = Object.values(originTotals).reduce((sum, v) => sum + v, 0);
  ORIGINS.forEach(item => rows.push([item.label, originTotals[item.key], percent(originTotals[item.key], visitTotal)]));
  rows.push([]);
  rows.push(['Penjamin', 'Jumlah', 'Persentase']);
  const payerTotal = PAYERS.filter(i => i.key !== 'naker').reduce((sum, item) => sum + payerTotals[item.key], 0);
  PAYERS.forEach(item => rows.push([item.label, payerTotals[item.key], item.key === 'naker' ? 'Keterangan' : percent(payerTotals[item.key], payerTotal)]));
  rows.push([]);
  rows.push(['Jenis Pemeriksaan', 'Pasien', 'Ekspose']);
  let totalPatient = 0;
  let totalExpose = 0;
  EXAMS.forEach(exam => {
    const p = examTotals[exam.key].pasien;
    const e = examTotals[exam.key].ekspose;
    totalPatient += p;
    totalExpose += e;
    rows.push([exam.label, p, e]);
  });
  rows.push(['Grand Total', totalPatient, totalExpose]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Bulanan');
  XLSX.writeFile(wb, `rekap-radiologi-${state.year}-${String(state.month + 1).padStart(2, '0')}.xlsx`);
  showToast('File Excel berhasil diunduh.');
}

function exportPdfMonthlyReport() {
  const data = [];
  for (let d = 1; d <= daysInMonth(); d++) {
    const key = `${state.year}-${String(state.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const record = state.data[key] || emptyDay();
    const visit = ORIGINS.reduce((sum, item) => sum + num(record.source[item.key]), 0);
    const exam = EXAMS.reduce((sum, item) => sum + num(record.exams[item.key]?.pasien), 0);
    const expose = EXAMS.reduce((sum, item) => sum + num(record.exams[item.key]?.ekspose), 0);
    data.push({ date: d, visit, exam, expose });
  }

  const report = document.createElement('div');
  report.id = 'pdfReport';
  report.style.fontFamily = 'Inter, sans-serif';
  report.style.padding = '24px';
  report.style.background = '#fff';
  report.style.color = '#111827';
  report.innerHTML = `
    <h2 style="margin:0 0 12px;">Rekap Pasien Radiologi</h2>
    <p style="margin:0 0 18px;"><strong>Periode:</strong> ${MONTHS[state.month]} ${state.year}</p>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:12px;margin-bottom:20px;">
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;"><div style="color:#6b7280;font-size:12px;">Kunjungan</div><div style="font-weight:700;font-size:22px;margin-top:4px;">${document.getElementById('summaryVisits').textContent}</div></div>
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;"><div style="color:#6b7280;font-size:12px;">Pemeriksaan</div><div style="font-weight:700;font-size:22px;margin-top:4px;">${document.getElementById('summaryExams').textContent}</div></div>
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;"><div style="color:#6b7280;font-size:12px;">Ekspose</div><div style="font-weight:700;font-size:22px;margin-top:4px;">${document.getElementById('summaryExpose').textContent}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:12px;">
      <thead>
        <tr>
          <th style="padding:8px;border:1px solid #e5e7eb;background:#f8fafc;text-align:left;">Tanggal</th>
          <th style="padding:8px;border:1px solid #e5e7eb;background:#f8fafc;text-align:right;">Kunjungan</th>
          <th style="padding:8px;border:1px solid #e5e7eb;background:#f8fafc;text-align:right;">Pemeriksaan</th>
          <th style="padding:8px;border:1px solid #e5e7eb;background:#f8fafc;text-align:right;">Ekspose</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(item => `
          <tr>
            <td style="padding:8px;border:1px solid #e5e7eb;">${item.date}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${fmt(item.visit)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${fmt(item.exam)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${fmt(item.expose)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.body.appendChild(report);
  html2pdf().set({
    margin: 8,
    filename: `rekap-radiologi-${state.year}-${String(state.month + 1).padStart(2, '0')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(report).save().finally(() => { report.remove(); });
  showToast('File PDF sedang diunduh.');
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function init() {
  renderPeriodControls();
  bindEvents();
  setDefaultDate();
  renderAll();
}

init();
