(() => {
  'use strict';

  const STORAGE_KEY = 'rekap-radiologi-data-v1';
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
    year: now.getFullYear(), month: now.getMonth(), date: dateKey(now),
    data: readData(), toastTimer: null
  };

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function dateFromKey(key) { return new Date(`${key}T12:00:00`); }
  function monthKey() { return `${state.year}-${String(state.month + 1).padStart(2, '0')}`; }
  function dayKey(day) { return `${monthKey()}-${String(day).padStart(2, '0')}`; }
  function daysInMonth() { return new Date(state.year, state.month + 1, 0).getDate(); }
  function readData() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.warn('Data lokal tidak dapat dibaca.', error);
      return {};
    }
  }
  function emptyRecord() {
    const record = { source: {}, payer: {}, exams: {} };
    EXAMS.forEach((exam) => { record.exams[exam.key] = { patients: '', exposures: '' }; });
    return record;
  }
  function recordFor(key = state.date) {
    const saved = state.data[key] || {};
    const record = { source: { ...(saved.source || {}) }, payer: { ...(saved.payer || {}) }, exams: {} };
    EXAMS.forEach((exam) => {
      record.exams[exam.key] = { patients: saved.exams?.[exam.key]?.patients ?? '', exposures: saved.exams?.[exam.key]?.exposures ?? '' };
    });
    return record;
  }
  function n(value) {
    if (value === '' || value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function fmt(value) { return value === 0 ? '-' : Number(value).toLocaleString('id-ID'); }
  function percent(value, total) { return total ? `${(value * 100 / total).toFixed(1).replace('.', ',')}%` : '0,0%'; }
  function dayTotals(record) {
    return {
      visits: ORIGINS.reduce((sum, item) => sum + n(record.source[item.key]), 0),
      exams: EXAMS.reduce((sum, exam) => sum + n(record.exams[exam.key]?.patients), 0),
      exposures: EXAMS.reduce((sum, exam) => sum + n(record.exams[exam.key]?.exposures), 0)
    };
  }
  function payerTotal(record) {
    return PAYERS.filter((item) => item.key !== 'naker').reduce((sum, item) => sum + n(record.payer[item.key]), 0);
  }
  function hasValues(record) {
    return [...Object.values(record.source), ...Object.values(record.payer), ...EXAMS.flatMap((exam) => [record.exams[exam.key].patients, record.exams[exam.key].exposures])]
      .some((value) => value !== '' && value !== null && value !== undefined);
  }
  function validate(record) {
    const errors = [];
    const originTotal = ORIGINS.reduce((sum, item) => sum + n(record.source[item.key]), 0);
    const paidTotal = payerTotal(record);
    if (originTotal !== paidTotal) errors.push(`Total asal pasien (${fmt(originTotal)}) harus sama dengan total penjamin (${fmt(paidTotal)}).`);
    [...Object.values(record.source), ...Object.values(record.payer), ...EXAMS.flatMap((exam) => [record.exams[exam.key].patients, record.exams[exam.key].exposures])]
      .forEach((value) => {
        if (value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0)) errors.push('Semua angka harus bilangan bulat nol atau lebih.');
      });
    EXAMS.forEach((exam) => {
      const patients = n(record.exams[exam.key].patients);
      const exposures = n(record.exams[exam.key].exposures);
      if (exposures < patients) errors.push(`${exam.label}: jumlah ekspose tidak boleh kurang dari jumlah pasien.`);
    });
    return [...new Set(errors)];
  }
  function safeStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      $('saveStatus').textContent = 'Tersimpan otomatis di browser ini.';
    } catch (error) {
      console.error('Gagal menyimpan data.', error);
      $('saveStatus').textContent = 'Gagal menyimpan. Periksa ruang penyimpanan browser.';
      toast('Data gagal disimpan di browser.');
    }
  }
  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => node.classList.remove('visible'), 2600);
  }
  function inputMarkup(label, group, key, value, id) {
    return `<label class="number-field" for="${id}"><span>${label}</span><input id="${id}" type="number" min="0" step="1" inputmode="numeric" value="${value === '' ? '' : Number(value)}" data-group="${group}" data-key="${key}" aria-label="${label}"></label>`;
  }
  function renderFields() {
    const record = recordFor();
    $('originFields').innerHTML = ORIGINS.map((item) => inputMarkup(item.label, 'source', item.key, record.source[item.key] ?? '', `source-${item.key}`)).join('');
    $('payerFields').innerHTML = PAYERS.map((item) => inputMarkup(item.label, 'payer', item.key, record.payer[item.key] ?? '', `payer-${item.key}`)).join('');
    $('examFields').innerHTML = ['Non Kontras', 'Kontras'].map((group) => {
      const rows = EXAMS.filter((exam) => exam.group === group).map((exam) => {
        const values = record.exams[exam.key];
        return `<div class="exam-row"><div class="exam-name">${exam.label}</div>${examInput(exam, 'patients', 'Pasien', values.patients)}${examInput(exam, 'exposures', 'Ekspose', values.exposures)}</div>`;
      }).join('');
      return `<section class="exam-group"><h4>${group}</h4><div class="exam-grid">${rows}</div></section>`;
    }).join('');
  }
  function examInput(exam, kind, label, value) {
    const id = `exam-${exam.key}-${kind}`;
    return `<label class="exam-number" for="${id}"><span>${label}</span><input id="${id}" type="number" min="0" step="1" inputmode="numeric" value="${value === '' ? '' : Number(value)}" data-exam="${exam.key}" data-kind="${kind}" aria-label="${exam.label} ${label}"></label>`;
  }
  function setPeriodControls() {
    $('monthSelect').innerHTML = MONTHS.map((name, index) => `<option value="${index}">${name}</option>`).join('');
    $('monthSelect').value = String(state.month);
    const currentYear = new Date().getFullYear();
    const years = new Set(Array.from({ length: 11 }, (_, i) => currentYear - 5 + i));
    years.add(state.year);
    $('yearSelect').innerHTML = [...years].sort((a, b) => a - b).map((year) => `<option value="${year}">${year}</option>`).join('');
    $('yearSelect').value = String(state.year);
    $('dateSelect').min = dayKey(1);
    $('dateSelect').max = dayKey(daysInMonth());
    $('dateSelect').value = state.date;
    const date = dateFromKey(state.date);
    $('dateCaption').textContent = `${DAYS[date.getDay()]} · ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    $('dateCaption').classList.toggle('sunday', date.getDay() === 0);
    $('tableHeading').textContent = `Data harian · ${MONTHS[state.month]} ${state.year}`;
  }
  function renderDaily() {
    const record = recordFor();
    const sums = dayTotals(record);
    const errors = validate(record);
    $('dayVisits').textContent = fmt(sums.visits);
    $('dayExams').textContent = fmt(sums.exams);
    $('dayExposure').textContent = fmt(sums.exposures);
    $('dayStatus').textContent = errors.length ? 'Perlu dicek' : 'OK';
    $('dayStatus').className = errors.length ? 'error-text' : 'ok-text';
    $('dayErrors').innerHTML = errors.length ? `<ul>${errors.map((error) => `<li>${error}</li>`).join('')}</ul>` : '<p class="muted">Data harian valid.</p>';
  }
  function renderMonthly() {
    const origins = Object.fromEntries(ORIGINS.map((item) => [item.key, 0]));
    const payers = Object.fromEntries(PAYERS.map((item) => [item.key, 0]));
    const examSums = Object.fromEntries(EXAMS.map((exam) => [exam.key, { patients: 0, exposures: 0 }]));
    let visits = 0, examsTotal = 0, exposureTotal = 0;
    for (let day = 1; day <= daysInMonth(); day++) {
      const record = recordFor(dayKey(day));
      const totals = dayTotals(record);
      visits += totals.visits; examsTotal += totals.exams; exposureTotal += totals.exposures;
      ORIGINS.forEach((item) => { origins[item.key] += n(record.source[item.key]); });
      PAYERS.forEach((item) => { payers[item.key] += n(record.payer[item.key]); });
      EXAMS.forEach((exam) => {
        examSums[exam.key].patients += n(record.exams[exam.key].patients);
        examSums[exam.key].exposures += n(record.exams[exam.key].exposures);
      });
    }
    $('summaryVisits').textContent = fmt(visits);
    $('summaryExams').textContent = fmt(examsTotal);
    $('summaryExposure').textContent = fmt(exposureTotal);
    $('originSummary').innerHTML = ORIGINS.map((item) => summaryLine(item.label, origins[item.key], visits)).join('') + summaryLine('Total asal pasien', visits, visits, true);
    const countedPayers = payerTotal({ payer: payers });
    $('payerSummary').innerHTML = PAYERS.filter((item) => item.key !== 'naker').map((item) => summaryLine(item.label, payers[item.key], countedPayers)).join('') + summaryLine('Total penjamin', countedPayers, countedPayers, true);
    $('nakerNote').textContent = `Naker (keterangan): ${fmt(payers.naker)} · tidak dihitung dalam total penjamin.`;
    let nonPatients = 0, nonExposure = 0, conPatients = 0, conExposure = 0;
    const rows = EXAMS.map((exam) => {
      const sum = examSums[exam.key];
      if (exam.group === 'Non Kontras') { nonPatients += sum.patients; nonExposure += sum.exposures; }
      else { conPatients += sum.patients; conExposure += sum.exposures; }
      return `<tr><td>${exam.label}</td><td>${fmt(sum.patients)}</td><td>${fmt(sum.exposures)}</td></tr>`;
    }).join('');
    $('examSummary').innerHTML = rows + `<tr class="subtotal"><td>Subtotal Non Kontras</td><td>${fmt(nonPatients)}</td><td>${fmt(nonExposure)}</td></tr><tr class="subtotal"><td>Subtotal Kontras</td><td>${fmt(conPatients)}</td><td>${fmt(conExposure)}</td></tr><tr class="grand-total"><td>Grand total</td><td>${fmt(nonPatients + conPatients)}</td><td>${fmt(nonExposure + conExposure)}</td></tr>`;
  }
  function summaryLine(label, value, total, isTotal = false) {
    return `<div class="summary-line${isTotal ? ' total-line' : ''}"><span>${label}</span><strong>${fmt(value)} <small>${percent(value, total)}</small></strong></div>`;
  }
  function renderTableAndIssues() {
    const issues = [];
    const rows = [];
    for (let day = 1; day <= daysInMonth(); day++) {
      const key = dayKey(day);
      const record = recordFor(key);
      const totals = dayTotals(record);
      const errors = validate(record);
      const date = dateFromKey(key);
      const visited = hasValues(record);
      if (visited && errors.length) issues.push({ day, errors });
      rows.push(`<tr class="${date.getDay() === 0 ? 'sunday-row ' : ''}${errors.length && visited ? 'invalid-row' : ''}" data-date="${key}" tabindex="0" aria-label="Buka data tanggal ${day}"><td>${DAYS[date.getDay()].slice(0, 3)} ${day}${date.getDay() === 0 ? ' <span class="sunday-mark">Minggu</span>' : ''}</td><td>${fmt(totals.visits)}</td><td>${fmt(payerTotal(record))}</td><td>${fmt(totals.visits)}</td><td>${fmt(totals.exams)}</td><td>${fmt(totals.exposures)}</td><td><span class="status-pill ${visited && errors.length ? 'status-error' : 'status-ok'}">${visited && errors.length ? 'Perlu dicek' : 'OK'}</span></td></tr>`);
    }
    $('dailyTableBody').innerHTML = rows.join('');
    $('monthlyIssues').innerHTML = issues.length ? issues.map((issue) => `<article class="issue-row"><strong>${issue.day} ${MONTHS[state.month]}</strong><ul>${issue.errors.map((error) => `<li>${error}</li>`).join('')}</ul></article>`).join('') : '<p class="muted">Tidak ada masalah validasi pada tanggal yang sudah diisi.</p>';
  }
  function render() {
    setPeriodControls();
    renderFields();
    renderDaily();
    renderMonthly();
    renderTableAndIssues();
  }
  function changeDate(key) {
    state.date = key;
    const date = dateFromKey(key);
    state.month = date.getMonth(); state.year = date.getFullYear();
    render();
  }
  function showView(which) {
    const table = which === 'table';
    $('dailyView').classList.toggle('hidden', table);
    $('tableView').classList.toggle('hidden', !table);
    $('formTab').classList.toggle('active', !table);
    $('tableTab').classList.toggle('active', table);
    $('formTab').setAttribute('aria-pressed', String(!table));
    $('tableTab').setAttribute('aria-pressed', String(table));
  }
  function handleInput(event) {
    const input = event.target;
    if (!input.matches('[data-group], [data-exam]')) return;
    const raw = input.value;
    if (raw !== '' && (!Number.isInteger(Number(raw)) || Number(raw) < 0)) {
      input.setCustomValidity('Masukkan bilangan bulat nol atau lebih.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    const record = recordFor();
    const value = raw === '' ? '' : Number(raw);
    if (input.dataset.group) record[input.dataset.group][input.dataset.key] = value;
    else record.exams[input.dataset.exam][input.dataset.kind] = value;
    state.data[state.date] = record;
    safeStore();
    renderDaily(); renderMonthly(); renderTableAndIssues();
  }
  function bindEvents() {
    $('dayForm').addEventListener('input', handleInput);
    $('monthSelect').addEventListener('change', () => {
      state.month = Number($('monthSelect').value);
      state.date = dayKey(Math.min(dateFromKey(state.date).getDate(), daysInMonth()));
      render();
    });
    $('yearSelect').addEventListener('change', () => {
      state.year = Number($('yearSelect').value);
      state.date = dayKey(Math.min(dateFromKey(state.date).getDate(), daysInMonth()));
      render();
    });
    $('dateSelect').addEventListener('change', (event) => { if (event.target.value) changeDate(event.target.value); });
    $('prevDay').addEventListener('click', () => { const date = dateFromKey(state.date); date.setDate(date.getDate() - 1); changeDate(dateKey(date)); });
    $('nextDay').addEventListener('click', () => { const date = dateFromKey(state.date); date.setDate(date.getDate() + 1); changeDate(dateKey(date)); });
    $('clearDay').addEventListener('click', () => {
      if (!hasValues(recordFor())) { toast('Tanggal ini belum memiliki data.'); return; }
      if (!window.confirm(`Kosongkan semua data tanggal ${state.date}?`)) return;
      delete state.data[state.date]; safeStore(); render(); toast('Data tanggal dikosongkan.');
    });
    $('formTab').addEventListener('click', () => showView('form'));
    $('tableTab').addEventListener('click', () => showView('table'));
    $('dailyTableBody').addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-date]');
      if (row) { changeDate(row.dataset.date); showView('form'); }
    });
    $('dailyTableBody').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target.closest('tr[data-date]');
      if (row) { event.preventDefault(); changeDate(row.dataset.date); showView('form'); }
    });
  }
  bindEvents();
  render();
})();
