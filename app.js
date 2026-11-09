(() => {
  'use strict';

  const STORAGE_KEYS = {
    data: 'rekap-radiologi-data-v1',
    locks: 'rekap-radiologi-locks-v1',
    session: 'rekap-radiologi-session-v1'
  };
  const ACCOUNTS = {
    admin: { password: 'admin123', role: 'Admin' },
    petugas: { password: 'petugas123', role: 'Petugas' }
  };
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const ORIGINS = [
    { key: 'umum', label: 'Umum' }, { key: 'spesialis', label: 'Poli Spesialis' },
    { key: 'ruangan', label: 'Ruangan' }, { key: 'luarRs', label: 'Luar RS' }
  ];
  const PAYERS = [
    { key: 'bpjs', label: 'BPJS' }, { key: 'umum', label: 'Umum' },
    { key: 'asuransi', label: 'Asuransi' }, { key: 'naker', label: 'Naker (keterangan)' }
  ];
  const EXAMS = [
    { key: 'thoraxPa', label: 'Thorax PA', group: 'Non Kontras' },
    { key: 'thoraxPaLat', label: 'Thorax PA & Lat', group: 'Non Kontras' },
    { key: 'extremitas', label: 'Extremitas', group: 'Non Kontras' },
    { key: 'extremitasBilateral', label: 'Extremitas Bilateral', group: 'Non Kontras' },
    { key: 'columnaVertebralis', label: 'Columna Vertebralis', group: 'Non Kontras' },
    { key: 'columnaVert4Posisi', label: 'Columna Vert 4 Posisi', group: 'Non Kontras' },
    { key: 'cranium', label: 'Cranium', group: 'Non Kontras' },
    { key: 'sinus', label: 'Sinus', group: 'Non Kontras' },
    { key: 'bnoAbdomen', label: 'BNO/Abdomen', group: 'Non Kontras' },
    { key: 'abdomen3Posisi', label: 'Abdomen 3 Posisi', group: 'Non Kontras' },
    { key: 'pelvis', label: 'Pelvis', group: 'Non Kontras' },
    { key: 'pelvis2Posisi', label: 'Pelvis 2 Posisi', group: 'Non Kontras' },
    { key: 'omdOesophagografi', label: 'OMD/Oesophagografi', group: 'Kontras' },
    { key: 'md', label: 'MD', group: 'Kontras' },
    { key: 'arthrografi', label: 'Arthrografi', group: 'Kontras' },
    { key: 'cholecystografi', label: 'Cholecystografi', group: 'Kontras' },
    { key: 'urethrocystografi', label: 'Urethrocystografi', group: 'Kontras' },
    { key: 'hsg', label: 'HSG', group: 'Kontras' },
    { key: 'colonInloop', label: 'Colon Inloop (B. Enema)', group: 'Kontras' },
    { key: 'bnoIvp', label: 'BNO-IVP', group: 'Kontras' },
    { key: 'rpg', label: 'RPG', group: 'Kontras' },
    { key: 'corAnalisa', label: 'COR Analisa', group: 'Kontras' },
    { key: 'appendicogram', label: 'Appendicogram', group: 'Kontras' }
  ];

  const $ = (id) => document.getElementById(id);
  const now = new Date();
  const state = {
    year: now.getFullYear(),
    month: now.getMonth(),
    date: dateKey(now),
    data: readJSON(STORAGE_KEYS.data, {}),
    locks: readJSON(STORAGE_KEYS.locks, {}),
    user: readSession(),
    toastTimer: null,
    currentView: 'form'
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : fallback;
      return parsed ?? fallback;
    } catch (error) {
      console.warn(`Tidak bisa baca ${key}`, error);
      return fallback;
    }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { console.warn(`Tidak bisa simpan ${key}`, error); return false; }
  }
  function readSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.session) || 'null');
      if (!saved || !saved.username || !ACCOUNTS[saved.username]) return null;
      return { username: saved.username, role: ACCOUNTS[saved.username].role };
    } catch (error) { return null; }
  }
  function persistSession(user) {
    if (!user) { sessionStorage.removeItem(STORAGE_KEYS.session); return; }
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ username: user.username, role: user.role }));
  }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
  function monthKey() { return `${state.year}-${String(state.month + 1).padStart(2, '0')}`; }
  function dayKey(day) { return `${monthKey()}-${String(day).padStart(2, '0')}`; }
  function daysInMonth() { return new Date(state.year, state.month + 1, 0).getDate(); }
  function isAdmin() { return state.user?.username === 'admin'; }
  function monthLocked() { return Boolean(state.locks[monthKey()]?.locked); }
  function mayEdit() { return Boolean(state.user) && (isAdmin() || !monthLocked()); }
  function n(value) {
    if (value === '' || value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function fmt(value) { return value === 0 ? '-' : Number(value).toLocaleString('id-ID'); }
  function percent(value, total) { return total ? `${(value * 100 / total).toFixed(1).replace('.', ',')}%` : '0,0%'; }
  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => node.classList.remove('visible'), 2600);
  }
  function emptyRecord() {
    const record = { source: {}, payer: {}, exams: {} };
    EXAMS.forEach((exam) => { record.exams[exam.key] = { patients: '', exposures: '' }; });
    return record;
  }
  function getRecord(key = state.date) {
    if (!state.data[key]) state.data[key] = emptyRecord();
    const existing = state.data[key];
    const record = { source: { ...(existing.source || {}) }, payer: { ...(existing.payer || {}) }, exams: {} };
    EXAMS.forEach((exam) => {
      record.exams[exam.key] = {
        patients: existing.exams?.[exam.key]?.patients ?? '',
        exposures: existing.exams?.[exam.key]?.exposures ?? ''
      };
    });
    return record;
  }
  function valueList(record) {
    return [
      ...Object.values(record.source),
      ...Object.values(record.payer),
      ...EXAMS.flatMap((exam) => [record.exams[exam.key].patients, record.exams[exam.key].exposures])
    ];
  }
  function validate(record) {
    const errors = [];
    const originTotal = ORIGINS.reduce((sum, item) => sum + n(record.source[item.key]), 0);
    const paidTotal = PAYERS.filter((item) => item.key !== 'naker').reduce((sum, item) => sum + n(record.payer[item.key]), 0);
    if (originTotal !== paidTotal) errors.push(`Total asal pasien (${fmt(originTotal)}) harus sama dengan total penjamin (${fmt(paidTotal)}).`);
    valueList(record).forEach((value) => {
      if (value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0)) errors.push('Semua angka harus bilangan bulat nol atau lebih.');
    });
    EXAMS.forEach((exam) => {
      const patients = n(record.exams[exam.key].patients);
      const exposures = n(record.exams[exam.key].exposures);
      if (exposures < patients) errors.push(`${exam.label}: jumlah ekspose tidak boleh kurang dari jumlah pasien.`);
    });
    return [...new Set(errors)];
  }
  function dayTotals(record) {
    return {
      visits: ORIGINS.reduce((sum, item) => sum + n(record.source[item.key]), 0),
      exams: EXAMS.reduce((sum, exam) => sum + n(record.exams[exam.key]?.patients), 0),
      exposures: EXAMS.reduce((sum, exam) => sum + n(record.exams[exam.key]?.exposures), 0)
    };
  }
  function hasValues(record) {
    return valueList(record).some((value) => value !== '' && value !== null && value !== undefined);
  }
  function renderUserBar() {
    $('currentUserName').textContent = state.user?.username || '-';
    $('currentUserRole').textContent = state.user?.role || '-';
    $('monthLockStatus').textContent = monthLocked() ? 'Terkunci' : 'Terbuka';
    $('lockBtn').disabled = !isAdmin() || monthLocked();
    $('unlockBtn').disabled = !isAdmin() || !monthLocked();
    $('lockBtn').title = isAdmin() ? 'Kunci bulan ini' : 'Hanya admin';
    $('unlockBtn').title = isAdmin() ? 'Buka kunci bulan ini' : 'Hanya admin';
  }
  function renderFields() {
    const record = getRecord();
    $('originFields').innerHTML = ORIGINS.map((item) => inputBox(item.label, 'source', item.key, record.source[item.key] ?? '', `source-${item.key}`)).join('');
    $('payerFields').innerHTML = PAYERS.map((item) => inputBox(item.label, 'payer', item.key, record.payer[item.key] ?? '', `payer-${item.key}`)).join('');
    $('examFields').innerHTML = ['Non Kontras', 'Kontras'].map((group) => {
      const rows = EXAMS.filter((exam) => exam.group === group).map((exam) => {
        const values = record.exams[exam.key];
        return `<div class="exam-row"><div class="exam-name">${exam.label}</div>${examInput(exam, 'patients', values.patients)}${examInput(exam, 'exposures', values.exposures)}</div>`;
      }).join('');
      return `<section class="exam-group"><h4>${group}</h4><div class="exam-grid">${rows}</div></section>`;
    }).join('');
    const disabled = !mayEdit();
    document.querySelectorAll('#dayForm input').forEach((input) => { input.disabled = disabled; });
  }
  function inputBox(label, group, key, value, id) {
    return `<label class="number-field" for="${id}"><span>${label}</span><input id="${id}" type="number" min="0" step="1" inputmode="numeric" value="${value === '' ? '' : Number(value)}" data-group="${group}" data-key="${key}" aria-label="${label}" /></label>`;
  }
  function examInput(exam, kind, value) {
    const id = `exam-${exam.key}-${kind}`;
    return `<label class="exam-number" for="${id}"><span>${kind === 'patients' ? 'Pasien' : 'Ekspose'}</span><input id="${id}" type="number" min="0" step="1" inputmode="numeric" value="${value === '' ? '' : Number(value)}" data-exam="${exam.key}" data-kind="${kind}" aria-label="${exam.label} ${kind === 'patients' ? 'Pasien' : 'Ekspose'}" /></label>`;
  }
  function renderDaily() {
    const record = getRecord();
    const totals = dayTotals(record);
    const errors = validate(record);
    $('dayVisits').textContent = fmt(totals.visits);
    $('dayExams').textContent = fmt(totals.exams);
    $('dayExposure').textContent = fmt(totals.exposures);
    $('dayStatus').textContent = errors.length ? 'Perlu dicek' : 'OK';
    $('dayStatus').className = errors.length ? 'error-text' : 'ok-text';
    $('dayErrors').innerHTML = errors.length ? `<ul>${errors.map((error) => `<li>${error}</li>`).join('')}</ul>` : '<p class="muted">Data harian valid.</p>';
  }
  function summaryLine(label, value, total, isTotal = false) {
    return `<div class="summary-line${isTotal ? ' total-line' : ''}"><span>${label}</span><strong>${fmt(value)}<small>${percent(value, total)}</small></strong></div>`;
  }
  function renderMonthly() {
    const origins = Object.fromEntries(ORIGINS.map((item) => [item.key, 0]));
    const payers = Object.fromEntries(PAYERS.map((item) => [item.key, 0]));
    const examTotals = Object.fromEntries(EXAMS.map((exam) => [exam.key, { patients: 0, exposures: 0 }]));
    let visits = 0, examsTotal = 0, exposureTotal = 0;
    for (let day = 1; day <= daysInMonth(); day++) {
      const record = getRecord(dayKey(day));
      const totals = dayTotals(record);
      visits += totals.visits; examsTotal += totals.exams; exposureTotal += totals.exposures;
      ORIGINS.forEach((item) => { origins[item.key] += n(record.source[item.key]); });
      PAYERS.forEach((item) => { payers[item.key] += n(record.payer[item.key]); });
      EXAMS.forEach((exam) => {
        examTotals[exam.key].patients += n(record.exams[exam.key].patients);
        examTotals[exam.key].exposures += n(record.exams[exam.key].exposures);
      });
    }
    $('summaryVisits').textContent = fmt(visits);
    $('summaryExams').textContent = fmt(examsTotal);
    $('summaryExposure').textContent = fmt(exposureTotal);
    $('originSummary').innerHTML = ORIGINS.map((item) => summaryLine(item.label, origins[item.key], visits)).join('') + summaryLine('Total asal pasien', visits, visits, true);
    const countablePayers = PAYERS.filter((item) => item.key !== 'naker').reduce((sum, item) => sum + payers[item.key], 0);
    $('payerSummary').innerHTML = PAYERS.filter((item) => item.key !== 'naker').map((item) => summaryLine(item.label, payers[item.key], countablePayers)).join('') + summaryLine('Total penjamin', countablePayers, countablePayers, true);
    $('nakerNote').textContent = `Naker (keterangan): ${fmt(payers.naker)} · tidak dihitung dalam total penjamin.`;
    let nonPatients = 0, nonExposure = 0, conPatients = 0, conExposure = 0;
    const rows = EXAMS.map((exam) => {
      const sum = examTotals[exam.key];
      if (exam.group === 'Non Kontras') { nonPatients += sum.patients; nonExposure += sum.exposures; }
      else { conPatients += sum.patients; conExposure += sum.exposures; }
      return `<tr><td>${exam.label}</td><td>${fmt(sum.patients)}</td><td>${fmt(sum.exposures)}</td></tr>`;
    }).join('');
    $('examSummary').innerHTML = rows + `<tr class="subtotal"><td>Subtotal Non Kontras</td><td>${fmt(nonPatients)}</td><td>${fmt(nonExposure)}</td></tr><tr class="subtotal"><td>Subtotal Kontras</td><td>${fmt(conPatients)}</td><td>${fmt(conExposure)}</td></tr><tr class="grand-total"><td>Grand total</td><td>${fmt(nonPatients + conPatients)}</td><td>${fmt(nonExposure + conExposure)}</td></tr>`;
  }
  function renderTableIssues() {
    const issues = [];
    const rows = [];
    for (let day = 1; day <= daysInMonth(); day++) {
      const key = dayKey(day);
      const record = getRecord(key);
      const totals = dayTotals(record);
      const errors = validate(record);
      const date = dateFromKey(key);
      const wasFilled = hasValues(record);
      if (wasFilled && errors.length) issues.push({ day, errors });
      const penjaminTotal = PAYERS.filter((item) => item.key !== 'naker').reduce((sum, item) => sum + n(record.payer[item.key]), 0);
      rows.push(`<tr class="${date.getDay() === 0 ? 'sunday-row ' : ''}${wasFilled && errors.length ? 'invalid-row' : ''}" data-date="${key}" tabindex="0"><td>${DAYS[date.getDay()].slice(0, 3)} ${day}${date.getDay() === 0 ? ' <span class="sunday-mark">Minggu</span>' : ''}</td><td>${fmt(totals.visits)}</td><td>${fmt(penjaminTotal)}</td><td>${fmt(totals.visits)}</td><td>${fmt(totals.exams)}</td><td>${fmt(totals.exposures)}</td><td><span class="status-pill ${wasFilled && errors.length ? 'status-error' : 'status-ok'}">${wasFilled && errors.length ? 'Perlu dicek' : 'OK'}</span></td></tr>`);
    }
    $('dailyTableBody').innerHTML = rows.join('');
    $('monthlyIssues').innerHTML = issues.length ? issues.map((issue) => `<article class="issue-row"><strong>${issue.day} ${MONTHS[state.month]}</strong><ul>${issue.errors.map((error) => `<li>${error}</li>`).join('')}</ul></article>`).join('') : '<p class="muted">Tidak ada masalah validasi pada tanggal yang sudah diisi.</p>';
  }
  function renderPeriod() {
    $('monthSelect').innerHTML = MONTHS.map((month, index) => `<option value="${index}">${month}</option>`).join('');
    $('monthSelect').value = String(state.month);
    const currentYear = new Date().getFullYear();
    const years = new Set(Array.from({ length: 11 }, (_, i) => currentYear - 5 + i));
    years.add(state.year);
    $('yearSelect').innerHTML = [...years].sort((a, b) => a - b).map((year) => `<option value="${year}">${year}</option>`).join('');
    $('yearSelect').value = String(state.year);
    const date = dateFromKey(state.date);
    $('dateSelect').min = dayKey(1);
    $('dateSelect').max = dayKey(daysInMonth());
    $('dateSelect').value = state.date;
    $('dateCaption').textContent = `${DAYS[date.getDay()]} · ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    $('dateCaption').classList.toggle('sunday', date.getDay() === 0);
    $('tableHeading').textContent = `Data harian · ${MONTHS[state.month]} ${state.year}`;
  }
  function renderApp() {
    if (!state.user) return;
    renderPeriod();
    renderUserBar();
    renderFields();
    renderDaily();
    renderMonthly();
    renderTableIssues();
    const showForm = state.currentView === 'form';
    $('dailyView').classList.toggle('hidden', !showForm);
    $('tableView').classList.toggle('hidden', showForm);
    $('formTab').classList.toggle('active', showForm);
    $('tableTab').classList.toggle('active', !showForm);
  }
  function showApp(user) {
    state.user = user;
    persistSession(user);
    $('loginOverlay').classList.add('hidden');
    $('appShell').classList.remove('hidden');
    renderApp();
  }
  function showLogin() {
    state.user = null;
    persistSession(null);
    $('appShell').classList.add('hidden');
    $('loginOverlay').classList.remove('hidden');
    $('passwordInput').value = '';
    $('usernameInput').focus();
  }
  function handleLogin(event) {
    event.preventDefault();
    const username = $('usernameInput').value.trim().toLowerCase();
    const password = $('passwordInput').value;
    const account = ACCOUNTS[username];
    if (!account || password !== account.password) {
      toast('Username atau password salah.');
      $('passwordInput').value = '';
      $('passwordInput').focus();
      return;
    }
    showApp({ username, role: account.role });
    toast(`Login berhasil, ${account.role}.`);
  }
  function updateMonthFromDate() {
    const date = dateFromKey(state.date);
    state.year = date.getFullYear();
    state.month = date.getMonth();
  }
  function setDate(nextDate) {
    state.date = nextDate;
    updateMonthFromDate();
    renderApp();
  }
  function changeMonthAndDate() {
    state.month = Number($('monthSelect').value);
    const maxDay = daysInMonth();
    state.date = dayKey(Math.min(dateFromKey(state.date).getDate(), maxDay));
    renderApp();
  }
  function toggleLock(locked) {
    if (!isAdmin()) {
      toast('Hanya admin yang dapat mengunci bulan.');
      return;
    }
    state.locks[monthKey()] = { locked, by: state.user.username, at: new Date().toISOString() };
    saveJSON(STORAGE_KEYS.locks, state.locks);
    renderApp();
    toast(locked ? 'Bulan berhasil dikunci.' : 'Kunci bulan dibuka.');
  }
  function handleInput(event) {
    if (!state.user) return;
    const input = event.target;
    if (!(input.matches('[data-group]') || input.matches('[data-exam]'))) return;
    if (!mayEdit()) {
      toast('Bulan terkunci. Hanya admin yang dapat mengubah data.');
      renderFields();
      return;
    }
    const raw = input.value;
    if (raw !== '' && (!Number.isInteger(Number(raw)) || Number(raw) < 0)) {
      input.setCustomValidity('Masukkan bilangan bulat nol atau lebih.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    const record = getRecord();
    const value = raw === '' ? '' : Number(raw);
    if (input.dataset.group) record[input.dataset.group][input.dataset.key] = value;
    else record.exams[input.dataset.exam][input.dataset.kind] = value;
    state.data[state.date] = record;
    saveJSON(STORAGE_KEYS.data, state.data);
    renderDaily();
    renderMonthly();
    renderTableIssues();
  }
  function exportRows() {
    const rows = [
      ['Rekap Pasien Radiologi'],
      ['Periode', `${MONTHS[state.month]} ${state.year}`],
      [],
      ['Tanggal', 'Hari', 'Kunjungan', 'Pemeriksaan', 'Ekspose', ...ORIGINS.map((item) => `Asal: ${item.label}`), ...PAYERS.filter((item) => item.key !== 'naker').map((item) => `Penjamin: ${item.label}`)],
    ];
    for (let day = 1; day <= daysInMonth(); day++) {
      const key = dayKey(day);
      const record = getRecord(key);
      const totals = dayTotals(record);
      const date = dateFromKey(key);
      rows.push([
        day,
        DAYS[date.getDay()],
        totals.visits,
        totals.exams,
        totals.exposures,
        ...ORIGINS.map((item) => n(record.source[item.key])),
        ...PAYERS.filter((item) => item.key !== 'naker').map((item) => n(record.payer[item.key]))
      ]);
    }
    rows.push([]);
    rows.push(['Jenis Pemeriksaan', 'Kelompok', 'Jumlah Pasien', 'Jumlah Ekspose']);
    let nonPatients = 0, nonExposure = 0, conPatients = 0, conExposure = 0;
    EXAMS.forEach((exam) => {
      const patients = EXAMS.reduce((sum, item) => item.key === exam.key ? sum : sum, 0);
      const sum = { patients: 0, exposures: 0 };
      for (let day = 1; day <= daysInMonth(); day++) {
        const record = getRecord(dayKey(day));
        sum.patients += n(record.exams[exam.key].patients);
        sum.exposures += n(record.exams[exam.key].exposures);
      }
      if (exam.group === 'Non Kontras') { nonPatients += sum.patients; nonExposure += sum.exposures; }
      else { conPatients += sum.patients; conExposure += sum.exposures; }
      rows.push([exam.label, exam.group, sum.patients, sum.exposures]);
    });
    rows.push(['Subtotal Non Kontras', '', nonPatients, nonExposure]);
    rows.push(['Subtotal Kontras', '', conPatients, conExposure]);
    rows.push(['Grand Total', '', nonPatients + conPatients, nonExposure + conExposure]);
    return rows;
  }
  function exportExcel() {
    if (!window.XLSX) {
      toast('Fitur Excel belum tersedia.');
      return;
    }
    const rows = exportRows();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rekap Bulanan');
    XLSX.writeFile(workbook, `rekap-radiologi-${monthKey()}.xlsx`);
    toast('File Excel diunduh.');
  }
  function exportPdf() {
    if (!window.html2pdf) {
      toast('Fitur PDF belum tersedia.');
      return;
    }
    const report = document.createElement('div');
    report.style.cssText = 'padding: 24px; background: #fff; color: #172b35; font-family: Arial, sans-serif;';
    report.innerHTML = `<h2>Rekap Pasien Radiologi</h2><p>Periode: ${MONTHS[state.month]} ${state.year}</p><table style="width:100%;border-collapse:collapse;font-size:11px"><tbody>${exportRows().map((row) => `<tr>${row.map((cell) => `<td style="border:1px solid #dfe4ea;padding:6px;">${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    document.body.appendChild(report);
    const original = report.style.position;
    report.style.position = 'fixed';
    report.style.left = '-9999px';
    report.style.top = '0';
    window.html2pdf().set({
      margin: 8,
      filename: `rekap-radiologi-${monthKey()}.pdf`,
      html2canvas: { scale: 1.2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(report).save().then(() => {
      report.remove();
      toast('File PDF diunduh.');
    }).catch(() => {
      report.remove();
      toast('Gagal mengunduh PDF.');
    });
  }
  function bindEvents() {
    $('loginForm').addEventListener('submit', handleLogin);
    $('logoutBtn').addEventListener('click', () => showLogin());
    $('monthSelect').addEventListener('change', changeMonthAndDate);
    $('yearSelect').addEventListener('change', () => {
      state.year = Number($('yearSelect').value);
      const maxDay = daysInMonth();
      state.date = dayKey(Math.min(dateFromKey(state.date).getDate(), maxDay));
      renderApp();
    });
    $('dateSelect').addEventListener('change', (event) => { if (event.target.value) setDate(event.target.value); });
    $('prevDay').addEventListener('click', () => { const date = dateFromKey(state.date); date.setDate(date.getDate() - 1); setDate(dateKey(date)); });
    $('nextDay').addEventListener('click', () => { const date = dateFromKey(state.date); date.setDate(date.getDate() + 1); setDate(dateKey(date)); });
    $('dayForm').addEventListener('input', handleInput);
    $('clearDay').addEventListener('click', () => {
      if (!mayEdit()) { toast('Bulan terkunci. Admin harus membuka kunci terlebih dahulu.'); return; }
      if (!window.confirm(`Kosongkan semua data tanggal ${state.date}?`)) return;
      delete state.data[state.date];
      saveJSON(STORAGE_KEYS.data, state.data);
      renderApp();
      toast('Data tanggal berhasil dikosongkan.');
    });
    $('lockBtn').addEventListener('click', () => toggleLock(true));
    $('unlockBtn').addEventListener('click', () => toggleLock(false));
    $('formTab').addEventListener('click', () => { state.currentView = 'form'; renderApp(); });
    $('tableTab').addEventListener('click', () => { state.currentView = 'table'; renderApp(); });
    $('dailyTableBody').addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-date]');
      if (!row) return;
      state.currentView = 'form';
      setDate(row.dataset.date);
    });
    $('excelBtn').addEventListener('click', exportExcel);
    $('pdfBtn').addEventListener('click', exportPdf);
  }

  bindEvents();
  if (state.user) showApp(state.user); else showLogin();
})();
