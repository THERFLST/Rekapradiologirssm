(() => {
  'use strict';

  const KEYS = {
    data: 'rekap-radiologi-v1',
    locks: 'rekap-radiologi-locks-v1',
    history: 'rekap-radiologi-history-v1',
    session: 'rekapRadiologiDemoUser'
  };
  const ACCOUNTS = {
    admin: { password: 'admin123', role: 'Admin' },
    petugas: { password: 'petugas123', role: 'Petugas' }
  };
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const ORIGINS = [
    { key: 'umum', label: 'Umum' }, { key: 'spesialis', label: 'Poli Spesialis' },
    { key: 'ruangan', label: 'Ruangan' }, { key: 'luarRs', label: 'Luar RS' }
  ];
  const PAYERS = [
    { key: 'bpjs', label: 'BPJS' }, { key: 'umum', label: 'Umum' },
    { key: 'asuransi', label: 'Asuransi' }, { key: 'naker', label: 'Naker (keterangan)' }
  ];
  const EXAMS = [
    {key:'thoraxPa',label:'Thorax PA',group:'Non Kontras'}, {key:'thoraxPaLat',label:'Thorax PA & Lat',group:'Non Kontras'},
    {key:'extremitas',label:'Extremitas',group:'Non Kontras'}, {key:'extremitasBilateral',label:'Extremitas Bilateral',group:'Non Kontras'},
    {key:'columnaVertebralis',label:'Columna Vertebralis',group:'Non Kontras'}, {key:'columnaVert4Posisi',label:'Columna Vert 4 Posisi',group:'Non Kontras'},
    {key:'cranium',label:'Cranium',group:'Non Kontras'}, {key:'sinus',label:'Sinus',group:'Non Kontras'},
    {key:'bnoAbdomen',label:'BNO/Abdomen',group:'Non Kontras'}, {key:'abdomen3Posisi',label:'Abdomen 3 Posisi',group:'Non Kontras'},
    {key:'pelvis',label:'Pelvis',group:'Non Kontras'}, {key:'pelvis2Posisi',label:'Pelvis 2 Posisi',group:'Non Kontras'},
    {key:'omdOesophagografi',label:'OMD/Oesophagografi',group:'Kontras'}, {key:'md',label:'MD',group:'Kontras'},
    {key:'arthrografi',label:'Arthrografi',group:'Kontras'}, {key:'cholecystografi',label:'Cholecystografi',group:'Kontras'},
    {key:'urethrocystografi',label:'Urethrocystografi',group:'Kontras'}, {key:'hsg',label:'HSG',group:'Kontras'},
    {key:'colonInloop',label:'Colon Inloop (B. Enema)',group:'Kontras'}, {key:'bnoIvp',label:'BNO-IVP',group:'Kontras'},
    {key:'rpg',label:'RPG',group:'Kontras'}, {key:'corAnalisa',label:'COR Analisa',group:'Kontras'},
    {key:'appendicogram',label:'Appendicogram',group:'Kontras'}
  ];
  const $ = (id) => document.getElementById(id);
  const today = new Date();
  const state = {
    year: today.getFullYear(), month: today.getMonth(), date: toDateKey(today),
    data: readStorage(KEYS.data, {}), locks: readStorage(KEYS.locks, {}),
    history: readStorage(KEYS.history, []), user: readSession()
  };
  let toastTimer;

  function readStorage(key, fallback) {
    try { const parsed = JSON.parse(localStorage.getItem(key) || 'null'); return parsed ?? fallback; }
    catch (error) { console.warn(`Tidak dapat membaca ${key}`, error); return fallback; }
  }
  function readSession() {
    try {
      const user = JSON.parse(sessionStorage.getItem(KEYS.session) || 'null');
      return user && ACCOUNTS[user.username]?.role === user.role ? user : null;
    } catch (error) { console.warn('Sesi login tidak tersedia', error); return null; }
  }
  function toDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
  function daysInMonth() { return new Date(state.year, state.month + 1, 0).getDate(); }
  function periodKey() { return `${state.year}-${String(state.month+1).padStart(2,'0')}`; }
  function dayKey(day) { return `${periodKey()}-${String(day).padStart(2,'0')}`; }
  function emptyRecord() {
    const record = { source: {}, payer: {}, exams: {} };
    EXAMS.forEach((exam) => { record.exams[exam.key] = { pasien: '', ekspose: '' }; });
    return record;
  }
  function getRecord(date = state.date) {
    if (!state.data[date]) state.data[date] = emptyRecord();
    const record = state.data[date];
    record.source ||= {}; record.payer ||= {}; record.exams ||= {};
    EXAMS.forEach((exam) => { record.exams[exam.key] ||= { pasien: '', ekspose: '' }; });
    return record;
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { notify('Penyimpanan browser penuh/tidak tersedia. Unduh backup atau kosongkan ruang.'); return false; }
  }
  function number(value) { if (value === '' || value === null || value === undefined) return 0; const result = Number(value); return Number.isFinite(result) ? result : 0; }
  function displayNumber(value) { return value === 0 ? '-' : Number(value).toLocaleString('id-ID'); }
  function percentage(value, total) { return total ? `${(value * 100 / total).toFixed(1).replace('.', ',')}%` : '0,0%'; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function isAdmin() { return state.user?.username === 'admin'; }
  function monthLocked() { return Boolean(state.locks[periodKey()]?.locked); }
  function mayEdit() { return Boolean(state.user) && (isAdmin() || !monthLocked()); }

  function notify(text) {
    let toast = document.querySelector('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 3000);
  }
  function addHistory(action, detail) {
    if (!state.user) return;
    state.history.unshift({ action, detail, by: state.user.username, role: state.user.role, timestamp: new Date().toISOString() });
    state.history = state.history.slice(0, 40);
    store(KEYS.history, state.history);
    renderHistory();
  }
  function renderHistory() {
    const target = $('historyList');
    if (!target) return;
    if (!state.history.length) { target.innerHTML = '<div class="history-empty">Belum ada riwayat perubahan.</div>'; return; }
    target.innerHTML = state.history.slice(0, 20).map((item) => {
      const when = new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
      return `<div class="history-item"><small>${escapeHtml(when)} · ${escapeHtml(item.by || 'user')} (${escapeHtml(item.role || '')})</small><strong>${escapeHtml(item.action || 'Perubahan')}</strong><div>${escapeHtml(item.detail || '')}</div></div>`;
    }).join('');
  }

  function setLoginMessage(text) {
    let node = $('loginMessage');
    if (!node) {
      node = document.createElement('p'); node.id = 'loginMessage'; node.setAttribute('role', 'alert');
      node.style.cssText = 'min-height:1.4em;margin:8px 0;color:#b42318;font-size:13px;font-weight:600;';
      const form = $('loginForm'); const button = form?.querySelector('[type="submit"]');
      if (form) form.insertBefore(node, button || null);
    }
    node.textContent = text;
  }
  function showApp(user) {
    state.user = user;
    try { sessionStorage.setItem(KEYS.session, JSON.stringify(user)); } catch (error) { console.warn('Sesi tidak dapat disimpan', error); }
    $('loginOverlay').classList.add('hidden');
    $('mainApp').classList.remove('hidden');
    $('currentUserName').textContent = user.username;
    $('currentUserRole').textContent = user.role;
    setLoginMessage('');
    try { renderApp(); }
    catch (error) { console.error('Gagal menampilkan rekap', error); notify('Login berhasil, tetapi ada masalah saat memuat rekap. Muat ulang halaman.'); }
  }
  function showLogin() {
    state.user = null;
    try { sessionStorage.removeItem(KEYS.session); } catch (error) { console.warn(error); }
    $('mainApp').classList.add('hidden');
    $('loginOverlay').classList.remove('hidden');
    $('passwordInput').value = '';
    $('usernameInput').focus();
  }
  function bindLogin() {
    $('loginForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const username = $('usernameInput').value.trim().toLowerCase();
      const password = $('passwordInput').value;
      const account = ACCOUNTS[username];
      if (!account || password !== account.password) {
        setLoginMessage('Username atau password salah. Coba admin / admin123 atau petugas / petugas123.');
        $('passwordInput').value = '';
        $('passwordInput').focus();
        return;
      }
      const firstLogin = !state.user || state.user.username !== username;
      showApp({ username, role: account.role });
      if (firstLogin) addHistory('Login', `Masuk sebagai ${account.role}.`);
    });
    $('logoutBtn')?.addEventListener('click', showLogin);
  }

  function renderPeriodControls() {
    $('monthSelect').innerHTML = MONTHS.map((month, index) => `<option value="${index}">${month}</option>`).join('');
    $('monthSelect').value = String(state.month);
    const currentYear = new Date().getFullYear();
    const years = new Set(Array.from({ length: 11 }, (_, i) => currentYear - 5 + i));
    years.add(state.year);
    $('yearSelect').innerHTML = [...years].sort((a,b) => a-b).map((year) => `<option value="${year}">${year}</option>`).join('');
    $('yearSelect').value = String(state.year);
  }
  function renderInputFields() {
    const record = getRecord();
    const disabled = mayEdit() ? '' : 'disabled';
    $('originFields').innerHTML = ORIGINS.map((item) => `<label class="number-field"><span>${item.label}</span><input type="number" min="0" step="1" inputmode="numeric" data-group="source" data-key="${item.key}" aria-label="${item.label}" value="${record.source[item.key] ?? ''}" ${disabled}></label>`).join('');
    $('payerFields').innerHTML = PAYERS.map((item) => `<label class="number-field"><span>${item.label}</span><input type="number" min="0" step="1" inputmode="numeric" data-group="payer" data-key="${item.key}" aria-label="${item.label}" value="${record.payer[item.key] ?? ''}" ${disabled}></label>`).join('');
    $('examFields').innerHTML = ['Non Kontras','Kontras'].map((group) => {
      const rows = EXAMS.filter((exam) => exam.group === group).map((exam) => `<div class="exam-row"><div class="exam-name">${escapeHtml(exam.label)}</div><label class="exam-number"><span>Pasien</span><input type="number" min="0" step="1" inputmode="numeric" data-exam="${exam.key}" data-kind="pasien" aria-label="${escapeHtml(exam.label)} jumlah pasien" value="${record.exams[exam.key]?.pasien ?? ''}" ${disabled}></label><label class="exam-number"><span>Ekspose</span><input type="number" min="0" step="1" inputmode="numeric" data-exam="${exam.key}" data-kind="ekspose" aria-label="${escapeHtml(exam.label)} ekspose" value="${record.exams[exam.key]?.ekspose ?? ''}" ${disabled}></label></div>`).join('');
      return `<div class="exam-group"><h4>${group}</h4><div class="exam-grid">${rows}</div></div>`;
    }).join('');
    document.querySelectorAll('#dayForm input[data-group], #dayForm input[data-exam]').forEach((input) => {
      input.addEventListener('input', handleDataInput);
      input.addEventListener('change', () => addHistory('Ubah data', `${state.date} · ${input.getAttribute('aria-label') || input.dataset.key || input.dataset.exam}`));
    });
  }
  function handleDataInput(event) {
    if (!mayEdit()) { notify('Bulan terkunci. Data tidak dapat diubah.'); renderInputFields(); return; }
    const input = event.currentTarget;
    const raw = input.value;
    if (raw !== '' && (!Number.isInteger(Number(raw)) || Number(raw) < 0)) { input.setCustomValidity('Masukkan bilangan bulat nol atau lebih.'); input.reportValidity(); return; }
    input.setCustomValidity('');
    const record = getRecord();
    const value = raw === '' ? '' : Number(raw);
    if (input.dataset.group) record[input.dataset.group][input.dataset.key] = value;
    else record.exams[input.dataset.exam][input.dataset.kind] = value;
    store(KEYS.data, state.data);
    updateDailyTotals(); renderDailyChecks(); renderMonthlySummary();
  }

  function totals(record) {
    return {
      visits: ORIGINS.reduce((sum, item) => sum + number(record.source[item.key]), 0),
      exams: EXAMS.reduce((sum, exam) => sum + number(record.exams[exam.key]?.pasien), 0),
      expose: EXAMS.reduce((sum, exam) => sum + number(record.exams[exam.key]?.ekspose), 0)
    };
  }
  function validate(record) {
    const errors = [];
    const originTotal = ORIGINS.reduce((sum, item) => sum + number(record.source[item.key]), 0);
    const payerTotal = PAYERS.filter((item) => item.key !== 'naker').reduce((sum, item) => sum + number(record.payer[item.key]), 0);
    if (originTotal !== payerTotal) errors.push(`Asal pasien ${originTotal} tidak sama dengan penjamin ${payerTotal}.`);
    for (const exam of EXAMS) {
      const patient = Number(record.exams[exam.key]?.pasien || 0);
      const exposure = Number(record.exams[exam.key]?.ekspose || 0);
      if (patient < 0 || exposure < 0 || !Number.isInteger(patient) || !Number.isInteger(exposure)) errors.push(`${exam.label}: nilai harus bilangan bulat 0 atau lebih.`);
      else if (exposure < patient) errors.push(`${exam.label}: ekspose (${exposure}) lebih kecil dari pasien (${patient}).`);
    }
    [...Object.values(record.source), ...Object.values(record.payer)].forEach((value) => {
      if (value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0)) errors.push('Asal atau penjamin memiliki nilai tidak valid.');
    });
    return errors;
  }
  function updateDailyTotals() {
    const record = getRecord(); const result = totals(record); const errors = validate(record);
    $('dayVisits').textContent = result.visits ? result.visits.toLocaleString('id-ID') : '-';
    $('dayExams').textContent = result.exams ? result.exams.toLocaleString('id-ID') : '-';
    $('dayExpose').textContent = result.expose ? result.expose.toLocaleString('id-ID') : '-';
    $('dayStatus').textContent = errors.length ? 'Perlu dicek' : 'OK';
    $('dayStatus').classList.toggle('ok-text', !errors.length);
    $('dayStatus').classList.toggle('error-text', Boolean(errors.length));
  }
  function renderDailyChecks() {
    const issues = [];
    for (let day = 1; day <= daysInMonth(); day++) {
      const record = state.data[dayKey(day)] || emptyRecord(); const errors = validate(record);
      if (errors.length) issues.push({ day, errors });
    }
    const box = $('dailyIssues');
    if (!issues.length) { box.innerHTML = '<p class="muted">Tidak ada masalah validasi pada bulan ini.</p>'; return; }
    box.innerHTML = issues.map((issue) => `<div class="issue-row"><span class="issue-badge err">!</span><div><strong>Tanggal ${issue.day} ${MONTHS[state.month]}</strong><div>${issue.errors.map(escapeHtml).map((error) => `<div>• ${error}</div>`).join('')}</div></div></div>`).join('');
  }
  function renderMonthlySummary() {
    const origins = Object.fromEntries(ORIGINS.map((item) => [item.key, 0]));
    const payers = Object.fromEntries(PAYERS.map((item) => [item.key, 0]));
    const exams = Object.fromEntries(EXAMS.map((exam) => [exam.key, { pasien: 0, ekspose: 0 }]));
    let visits = 0, examCount = 0, exposureCount = 0;
    for (let day = 1; day <= daysInMonth(); day++) {
      const record = state.data[dayKey(day)] || emptyRecord(); const daily = totals(record);
      visits += daily.visits; examCount += daily.exams; exposureCount += daily.expose;
      ORIGINS.forEach((item) => { origins[item.key] += number(record.source[item.key]); });
      PAYERS.forEach((item) => { payers[item.key] += number(record.payer[item.key]); });
      EXAMS.forEach((exam) => { exams[exam.key].pasien += number(record.exams[exam.key]?.pasien); exams[exam.key].ekspose += number(record.exams[exam.key]?.ekspose); });
    }
    $('summaryVisits').textContent = visits.toLocaleString('id-ID');
    $('summaryExams').textContent = examCount.toLocaleString('id-ID');
    $('summaryExpose').textContent = exposureCount.toLocaleString('id-ID');
    $('originSummary').innerHTML = ORIGINS.map((item) => `<div class="summary-line"><span>${item.label}</span><strong>${displayNumber(origins[item.key])} <small>${percentage(origins[item.key], visits)}</small></strong></div>`).join('') + `<div class="summary-line total-line"><span>Total</span><strong>${displayNumber(visits)}</strong></div>`;
    const payerTotal = PAYERS.filter((item) => item.key !== 'naker').reduce((sum, item) => sum + payers[item.key], 0);
    $('payerSummary').innerHTML = PAYERS.map((item) => `<div class="summary-line"><span>${item.label}</span><strong>${displayNumber(payers[item.key])} <small>${item.key === 'naker' ? 'Keterangan' : percentage(payers[item.key], payerTotal)}</small></strong></div>`).join('') + `<div class="summary-line total-line"><span>Total penjamin</span><strong>${displayNumber(payerTotal)}</strong></div>`;
    let nonPatients = 0, nonExposure = 0, contrastPatients = 0, contrastExposure = 0;
    const rows = EXAMS.map((exam) => {
      const patient = exams[exam.key].pasien, exposure = exams[exam.key].ekspose;
      if (exam.group === 'Non Kontras') { nonPatients += patient; nonExposure += exposure; }
      else { contrastPatients += patient; contrastExposure += exposure; }
      return `<tr><td>${escapeHtml(exam.label)}</td><td>${displayNumber(patient)}</td><td>${displayNumber(exposure)}</td></tr>`;
    }).join('');
    $('examSummary').innerHTML = rows + `<tr class="subtotal"><td>Subtotal Non Kontras</td><td>${displayNumber(nonPatients)}</td><td>${displayNumber(nonExposure)}</td></tr><tr class="subtotal"><td>Subtotal Kontras</td><td>${displayNumber(contrastPatients)}</td><td>${displayNumber(contrastExposure)}</td></tr><tr class="grand-total"><td>Grand Total</td><td>${displayNumber(nonPatients+contrastPatients)}</td><td>${displayNumber(nonExposure+contrastExposure)}</td></tr>`;
  }
  function updatePeriodAndDate() {
    $('monthSelect').addEventListener('change', () => { state.month = Number($('monthSelect').value); state.date = dayKey(1); renderApp(); });
    $('yearSelect').addEventListener('change', () => { state.year = Number($('yearSelect').value); state.date = dayKey(1); renderApp(); });
    $('dateSelect').addEventListener('change', () => {
      if (!$('dateSelect').value) return;
      state.date = $('dateSelect').value; const date = dateFromKey(state.date); state.year = date.getFullYear(); state.month = date.getMonth(); renderApp();
    });
    $('prevDay').addEventListener('click', () => shiftDate(-1));
    $('nextDay').addEventListener('click', () => shiftDate(1));
    $('clearDay').addEventListener('click', () => {
      if (!mayEdit()) { notify('Bulan terkunci. Admin perlu membuka kunci terlebih dahulu.'); return; }
      if (!window.confirm(`Kosongkan data tanggal ${state.date}?`)) return;
      delete state.data[state.date]; store(KEYS.data, state.data); addHistory('Kosongkan tanggal', state.date); renderApp();
    });
    $('saveBtn').addEventListener('click', () => {
      if (!mayEdit()) { notify('Bulan terkunci. Data tidak dapat diubah.'); return; }
      store(KEYS.data, state.data); addHistory('Simpan data bulan', `${MONTHS[state.month]} ${state.year}`); notify('Data bulan berhasil disimpan.');
    });
    $('lockBtn').addEventListener('click', () => {
      if (!isAdmin()) return;
      state.locks[periodKey()] = { locked: true, by: state.user.username, at: new Date().toISOString() };
      store(KEYS.locks, state.locks); addHistory('Kunci bulan', `${MONTHS[state.month]} ${state.year}`); renderApp(); notify('Bulan berhasil dikunci.');
    });
    $('unlockBtn').addEventListener('click', () => {
      if (!isAdmin()) return;
      delete state.locks[periodKey()]; store(KEYS.locks, state.locks); addHistory('Buka kunci bulan', `${MONTHS[state.month]} ${state.year}`); renderApp(); notify('Kunci bulan dibuka.');
    });
    $('excelBtn').addEventListener('click', exportExcel);
    $('pdfBtn').addEventListener('click', exportPdf);
  }
  function shiftDate(offset) {
    const date = dateFromKey(state.date); date.setDate(date.getDate() + offset);
    state.date = toDateKey(date); state.year = date.getFullYear(); state.month = date.getMonth(); renderApp();
  }
  function renderUserAndLock() {
    $('currentUserName').textContent = state.user?.username || '-';
    $('currentUserRole').textContent = state.user?.role || '-';
    $('monthLockStatus').textContent = monthLocked() ? 'Terkunci' : 'Terbuka';
    $('lockBtn').classList.toggle('hidden', !isAdmin()); $('unlockBtn').classList.toggle('hidden', !isAdmin());
    $('lockBtn').disabled = monthLocked(); $('unlockBtn').disabled = !monthLocked();
    $('saveBtn').disabled = !mayEdit(); $('clearDay').disabled = !mayEdit();
  }
  function renderApp() {
    if (!state.user) return;
    renderPeriodControls();
    $('dateSelect').value = state.date;
    const date = dateFromKey(state.date);
    $('dateCaption').textContent = `${DAYS[date.getDay()]} · ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    $('dateCaption').classList.toggle('sunday', date.getDay() === 0);
    renderInputFields(); updateDailyTotals(); renderDailyChecks(); renderMonthlySummary(); renderHistory(); renderUserAndLock();
  }

  function exportRows() {
    const rows = [['Rekap Pasien Radiologi'], ['Periode', `${MONTHS[state.month]} ${state.year}`], [], ['Tanggal','Hari','Kunjungan','Pemeriksaan','Ekspose',...ORIGINS.map((item)=>`Asal: ${item.label}`),...PAYERS.map((item)=>`Penjamin: ${item.label}`)]];
    let totalVisits = 0, totalExams = 0, totalExposure = 0;
    for (let day = 1; day <= daysInMonth(); day++) {
      const key = dayKey(day), record = state.data[key] || emptyRecord(), sums = totals(record), date = dateFromKey(key);
      totalVisits += sums.visits; totalExams += sums.exams; totalExposure += sums.expose;
      rows.push([day, DAYS[date.getDay()], sums.visits, sums.exams, sums.expose, ...ORIGINS.map((item) => number(record.source[item.key])), ...PAYERS.map((item) => number(record.payer[item.key]))]);
    }
    rows.push(['TOTAL','',totalVisits,totalExams,totalExposure]);
    rows.push([]); rows.push(['Jenis Pemeriksaan','Kelompok','Jumlah Pasien','Jumlah Ekspose']);
    const sumsByExam = Object.fromEntries(EXAMS.map((exam) => [exam.key,{pasien:0,ekspose:0}]));
    for (let day=1;day<=daysInMonth();day++) { const record=state.data[dayKey(day)]||emptyRecord(); EXAMS.forEach((exam)=>{sumsByExam[exam.key].pasien+=number(record.exams[exam.key]?.pasien);sumsByExam[exam.key].ekspose+=number(record.exams[exam.key]?.ekspose);}); }
    let nonP=0,nonE=0,conP=0,conE=0;
    EXAMS.forEach((exam)=>{const t=sumsByExam[exam.key];rows.push([exam.label,exam.group,t.pasien,t.ekspose]);if(exam.group==='Non Kontras'){nonP+=t.pasien;nonE+=t.ekspose}else{conP+=t.pasien;conE+=t.ekspose}});
    rows.push(['Subtotal Non Kontras','',nonP,nonE],['Subtotal Kontras','',conP,conE],['Grand Total','',nonP+conP,nonE+conE]);
    return rows;
  }
  function exportExcel() {
    if (!window.XLSX) { notify('Fitur Excel belum termuat. Periksa koneksi internet lalu muat ulang.'); return; }
    const sheet = XLSX.utils.aoa_to_sheet(exportRows()); sheet['!cols'] = [{wch:24},{wch:14},{wch:15},{wch:15},{wch:15}];
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Rekap Bulanan');
    XLSX.writeFile(book, `rekap-radiologi-${periodKey()}.xlsx`); notify('File Excel diunduh.');
  }
  function exportPdf() {
    if (!window.html2pdf) { notify('Fitur PDF belum termuat. Periksa koneksi internet lalu muat ulang.'); return; }
    const tableRows = exportRows().filter((row) => row.length && row[0] !== 'Rekap Pasien Radiologi' && row[0] !== 'Periode');
    const report = document.createElement('div');
    report.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;padding:24px;background:#fff;color:#172b35;font:12px Arial,sans-serif;';
    report.innerHTML = `<h2>Rekap Pasien Radiologi</h2><p>Periode: ${MONTHS[state.month]} ${state.year}</p><table style="width:100%;border-collapse:collapse">${tableRows.map((row)=>`<tr>${row.map((cell)=>`<td style="border:1px solid #ddd;padding:5px">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>`;
    document.body.appendChild(report);
    window.html2pdf().set({margin:8,filename:`rekap-radiologi-${periodKey()}.pdf`,image:{type:'jpeg',quality:.96},html2canvas:{scale:1.5},jsPDF:{unit:'mm',format:'a4',orientation:'landscape'}}).from(report).save().finally(()=>report.remove());
  }

  function init() {
    if (!$('loginForm') || !$('mainApp')) { console.error('Halaman aplikasi tidak lengkap.'); return; }
    bindLogin();
    updatePeriodAndDate();
    if (state.user) {
      $('loginOverlay').classList.add('hidden'); $('mainApp').classList.remove('hidden'); renderApp();
    } else {
      $('loginOverlay').classList.remove('hidden'); $('mainApp').classList.add('hidden');
    }
  }
  try { init(); }
  catch (error) {
    console.error('Aplikasi gagal dimulai:', error);
    const message = document.createElement('div');
    message.setAttribute('role', 'alert');
    message.style.cssText = 'position:fixed;z-index:9999;left:12px;right:12px;bottom:12px;padding:14px;background:#fff1f0;color:#8f1d16;border:1px solid #f1c7c3;border-radius:10px;font:14px sans-serif';
    message.textContent = 'Aplikasi gagal dimulai. Muat ulang halaman; jika masih terjadi, periksa koneksi atau kirim screenshot error.';
    document.body.appendChild(message);
  }
})();
