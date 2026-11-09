(() => {
  'use strict';

  const USG_KEY = 'rekap-radiologi-usg-v1';
  const SERVICE_KEY = 'rekap-radiologi-service-time-v1';
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const ORIGINS = [['umum', 'Umum'], ['spesialis', 'Poli Spesialis'], ['ruangan', 'Ruangan'], ['luarRs', 'Luar RS']];
  const PAYERS = [['bpjs', 'BPJS'], ['umum', 'Umum'], ['asuransi', 'Asuransi'], ['naker', 'Naker (keterangan)']];
  const USG_TYPES = [
    ['abdomen', 'USG Abdomen'],
    ['obstetri', 'USG Obstetri'],
    ['ginjal', 'USG Ginjal/Traktus Urinarius'],
    ['tiroid', 'USG Tiroid'],
    ['mammae', 'USG Mammae'],
    ['scrotum', 'USG Scrotum'],
    ['muskuloskeletal', 'USG Muskuloskeletal'],
    ['lainnya', 'USG Lainnya']
  ];
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = () => {
    const date = new Date();
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const dateObj = (key) => new Date(`${key}T12:00:00`);
  const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const fmt = (n) => Number(n || 0).toLocaleString('id-ID');
  const monthLabel = (key) => {
    const [year, month] = key.split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  };
  const read = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.error(`Gagal membaca ${key}`, error);
      return {};
    }
  };

  const usgState = { date: todayKey(), report: { mode: 'bulanan', ref: todayKey().slice(0, 7) } };

  function blankUsgRecord() {
    return { source: {}, payer: {}, exams: {} };
  }

  // Keep the earlier USG counts when loading them into the expanded daily-record format.
  function getUsgRecord(date) {
    const record = read(USG_KEY)[date];
    if (!record || typeof record !== 'object') return blankUsgRecord();
    if (record.source || record.payer || record.exams) {
      return { source: record.source || {}, payer: record.payer || {}, exams: record.exams || {} };
    }
    const migrated = blankUsgRecord();
    USG_TYPES.forEach(([type]) => {
      if (record[type] !== undefined && record[type] !== '') {
        migrated.exams[type] = { patients: Number(record[type]) || 0 };
      }
    });
    return migrated;
  }

  function writeUsgRecord(date, record) {
    const allRecords = read(USG_KEY);
    const hasValues = Object.values(record.source).some((v) => v !== '' && v != null)
      || Object.values(record.payer).some((v) => v !== '' && v != null)
      || Object.values(record.exams).some((exam) => exam && exam.patients !== '' && exam.patients != null);
    if (hasValues) allRecords[date] = record;
    else delete allRecords[date];
    localStorage.setItem(USG_KEY, JSON.stringify(allRecords));
  }

  function renderUsgForm() {
    const record = getUsgRecord(usgState.date);
    $('usgDate').value = usgState.date;
    $('usgCaption').textContent = `${DAYS[dateObj(usgState.date).getDay()]}, ${dateObj(usgState.date).getDate()} ${MONTHS[dateObj(usgState.date).getMonth()]} ${dateObj(usgState.date).getFullYear()}`;
    $('usgOrigins').innerHTML = ORIGINS.map(([key, label]) => `<label>${label}<input type="number" min="0" step="1" inputmode="numeric" data-usg-group="source" data-usg-key="${key}" value="${record.source[key] ?? ''}"></label>`).join('');
    $('usgPayers').innerHTML = PAYERS.map(([key, label]) => `<label>${label}<input type="number" min="0" step="1" inputmode="numeric" data-usg-group="payer" data-usg-key="${key}" value="${record.payer[key] ?? ''}" ${key === 'naker' ? 'aria-label="Naker, keterangan saja"' : ''}></label>`).join('');
    $('usgExamFields').innerHTML = USG_TYPES.map(([key, label]) => `<div class="exam-row"><strong>${label}</strong><label>Jumlah pemeriksaan<input type="number" min="0" step="1" inputmode="numeric" data-usg-exam="${key}" value="${record.exams[key]?.patients ?? ''}"></label></div>`).join('');
    document.querySelectorAll('#usgOrigins input,#usgPayers input,#usgExamFields input').forEach((input) => input.addEventListener('input', onUsgInput));
    updateUsgSummary();
  }

  function usgTotals(record) {
    const visits = ORIGINS.reduce((sum, [key]) => sum + (Number(record.source[key]) || 0), 0);
    const examinations = USG_TYPES.reduce((sum, [key]) => sum + (Number(record.exams[key]?.patients) || 0), 0);
    return { visits, examinations };
  }

  function usgErrors(record) {
    const errors = [];
    const visits = usgTotals(record).visits;
    const payerTotal = PAYERS.filter(([key]) => key !== 'naker').reduce((sum, [key]) => sum + (Number(record.payer[key]) || 0), 0);
    const anyValue = [...Object.values(record.source), ...Object.values(record.payer), ...USG_TYPES.map(([key]) => record.exams[key]?.patients)].some((value) => value !== '' && value != null);
    if (anyValue && visits !== payerTotal) errors.push('Total asal pasien harus sama dengan BPJS + Umum + Asuransi.');
    return errors;
  }

  function updateUsgSummary() {
    const record = getUsgRecord(usgState.date);
    const totals = usgTotals(record);
    const errors = usgErrors(record);
    $('usgDayVisits').textContent = fmt(totals.visits);
    $('usgDayExams').textContent = fmt(totals.examinations);
    $('usgDayStatus').textContent = errors.length ? 'Perlu dicek' : 'OK';
    $('usgDayStatus').className = errors.length ? 'bad' : 'good';
    $('usgErrors').innerHTML = errors.length ? `<ul>${errors.map((error) => `<li>${error}</li>`).join('')}</ul>` : 'Data harian valid.';
  }

  function onUsgInput(event) {
    const input = event.target;
    const raw = input.value.trim();
    if (raw && (!Number.isInteger(Number(raw)) || Number(raw) < 0)) {
      input.setCustomValidity('Masukkan bilangan bulat nol atau lebih.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    const record = getUsgRecord(usgState.date);
    const value = raw === '' ? '' : Number(raw);
    if (input.dataset.usgGroup) record[input.dataset.usgGroup][input.dataset.usgKey] = value;
    else {
      const key = input.dataset.usgExam;
      record.exams[key] = { ...(record.exams[key] || {}), patients: value };
    }
    writeUsgRecord(usgState.date, record);
    $('usgSaved').textContent = 'Tersimpan otomatis di browser ini.';
    updateUsgSummary();
    renderUsgReport();
  }

  function setUsgDate(date) {
    if (!date) return;
    usgState.date = date;
    renderUsgForm();
  }

  function shiftUsgDate(amount) {
    const date = dateObj(usgState.date);
    date.setDate(date.getDate() + amount);
    setUsgDate(keyOf(date));
  }

  function periodKeys(mode, ref) {
    if (mode === 'harian') return { keys: [ref], label: ref };
    if (mode === 'mingguan') {
      const date = dateObj(ref);
      date.setDate(date.getDate() - (date.getDay() + 6) % 7);
      const keys = [];
      for (let i = 0; i < 7; i += 1) {
        keys.push(keyOf(date));
        date.setDate(date.getDate() + 1);
      }
      return { keys, label: `${keys[0]} – ${keys[6]}` };
    }
    const [year, month] = ref.slice(0, 7).split('-').map(Number);
    const days = new Date(year, month, 0).getDate();
    return { keys: Array.from({ length: days }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`), label: monthLabel(ref.slice(0, 7)) };
  }

  function aggregateUsg(keys) {
    const origins = Object.fromEntries(ORIGINS.map(([key]) => [key, 0]));
    const payers = Object.fromEntries(PAYERS.map(([key]) => [key, 0]));
    const exams = Object.fromEntries(USG_TYPES.map(([key]) => [key, 0]));
    let visits = 0;
    let examinationTotal = 0;
    const days = [];
    keys.forEach((date) => {
      const record = getUsgRecord(date);
      const totals = usgTotals(record);
      visits += totals.visits;
      examinationTotal += totals.examinations;
      ORIGINS.forEach(([key]) => { origins[key] += Number(record.source[key]) || 0; });
      PAYERS.forEach(([key]) => { payers[key] += Number(record.payer[key]) || 0; });
      USG_TYPES.forEach(([key]) => { exams[key] += Number(record.exams[key]?.patients) || 0; });
      days.push({ date, ...totals });
    });
    return { origins, payers, exams, visits, examinationTotal, days };
  }

  function renderUsgReport() {
    const control = $('usgReportControls');
    if (!control) return;
    const monthly = usgState.report.mode === 'bulanan';
    const dateType = monthly ? 'month' : 'date';
    const inputLabel = monthly ? 'Bulan' : usgState.report.mode === 'mingguan' ? 'Tanggal dalam minggu' : 'Tanggal';
    control.innerHTML = `<div class="seg">${['harian', 'mingguan', 'bulanan'].map((mode) => `<button type="button" class="${mode === usgState.report.mode ? 'on' : ''}" data-usg-mode="${mode}">${mode[0].toUpperCase()}${mode.slice(1)}</button>`).join('')}</div><label>${inputLabel}<input type="${dateType}" value="${usgState.report.ref}"></label>`;
    control.querySelectorAll('[data-usg-mode]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.usgMode;
      if (mode === 'bulanan') usgState.report.ref = usgState.report.ref.slice(0, 7);
      else if (usgState.report.ref.length === 7) usgState.report.ref += '-01';
      usgState.report.mode = mode;
      renderUsgReport();
    }));
    control.querySelector('input').addEventListener('change', (event) => {
      if (!event.target.value) return;
      usgState.report.ref = event.target.value.length === 7 && usgState.report.mode !== 'bulanan' ? `${event.target.value}-01` : event.target.value;
      renderUsgReport();
    });

    const period = periodKeys(usgState.report.mode, usgState.report.ref);
    const totals = aggregateUsg(period.keys);
    $('usgReportOutput').innerHTML = `
      <section class="cards"><article><span>Kunjungan</span><strong>${fmt(totals.visits)}</strong></article><article><span>Pemeriksaan USG</span><strong>${fmt(totals.examinationTotal)}</strong></article></section>
      <section class="panel"><div class="summary-grid"><article><h3>Asal pasien</h3>${ORIGINS.map(([key, label]) => `<div class="summary-line"><span>${label}</span><strong>${fmt(totals.origins[key])}</strong></div>`).join('')}</article><article><h3>Penjamin</h3>${PAYERS.filter(([key]) => key !== 'naker').map(([key, label]) => `<div class="summary-line"><span>${label}</span><strong>${fmt(totals.payers[key])}</strong></div>`).join('')}<p class="hint">Naker dicatat sebagai keterangan dan tidak masuk total.</p></article></div></section>
      <section class="panel"><div class="section-title"><h3>Jenis pemeriksaan USG</h3></div><div class="scroll"><table><thead><tr><th>Jenis pemeriksaan</th><th>Jumlah</th></tr></thead><tbody>${USG_TYPES.map(([key, label]) => `<tr><td>${label}</td><td>${fmt(totals.exams[key])}</td></tr>`).join('')}<tr class="subtotal"><th>Total pemeriksaan</th><th>${fmt(totals.examinationTotal)}</th></tr></tbody></table></div></section>
      ${period.keys.length > 1 ? `<section class="panel"><div class="section-title"><h3>Per hari · ${period.label}</h3></div><div class="scroll"><table><thead><tr><th>Tanggal</th><th>Hari</th><th>Kunjungan</th><th>Pemeriksaan</th></tr></thead><tbody>${totals.days.map((row) => `<tr><td>${row.date}</td><td>${DAYS[dateObj(row.date).getDay()]}</td><td>${fmt(row.visits)}</td><td>${fmt(row.examinations)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
  }

  function exportUsgExcel() {
    if (!window.XLSX) {
      alert('Excel belum termuat. Periksa koneksi internet.');
      return;
    }
    const period = periodKeys(usgState.report.mode, usgState.report.ref);
    const rows = [['Tanggal', 'Hari', 'Kunjungan', 'Pemeriksaan USG', ...USG_TYPES.map(([, label]) => label)]];
    period.keys.forEach((date) => {
      const record = getUsgRecord(date);
      const totals = usgTotals(record);
      rows.push([date, DAYS[dateObj(date).getDay()], totals.visits, totals.examinations, ...USG_TYPES.map(([key]) => Number(record.exams[key]?.patients) || 0)]);
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Rekap USG');
    XLSX.writeFile(workbook, `rekap-usg-${usgState.report.mode}-${period.keys[0]}.xlsx`);
  }

  function renderUsgModule() {
    $('v-usg').innerHTML = `
      <div class="section-title"><div><p class="eyebrow">Rekap USG</p><h2>Isi Data Harian</h2><p id="usgCaption" class="muted"></p></div>
        <div class="date-nav"><button id="usgPrev" type="button" aria-label="Hari sebelumnya">‹</button><label>Tanggal<input id="usgDate" type="date"></label><button id="usgNext" type="button" aria-label="Hari berikutnya">›</button></div></div>
      <div class="form-grid"><section><h3>Asal pasien</h3><div id="usgOrigins" class="fields"></div></section><section><h3>Penjamin</h3><p class="hint">Naker hanya keterangan, tidak dihitung dalam total penjamin.</p><div id="usgPayers" class="fields"></div></section></div>
      <section class="exam-section"><h3>Jenis pemeriksaan USG</h3><div id="usgExamFields" class="exam-grid"></div></section>
      <div class="daily-summary"><span>Kunjungan <b id="usgDayVisits">-</b></span><span>Pemeriksaan <b id="usgDayExams">-</b></span><span>Status <b id="usgDayStatus">OK</b></span></div>
      <div id="usgErrors" class="errors" aria-live="polite"></div>
      <div class="footer-row"><span id="usgSaved" class="hint">Tersimpan otomatis di browser.</span><span></span></div>
      <section class="panel"><div class="section-title"><div><p class="eyebrow">Rekap USG</p><h2>Lihat Rekapan</h2></div></div><div id="usgReportControls" class="ctl"></div><div id="usgReportOutput"></div><div class="footer-row"><span class="hint">Data USG disimpan terpisah dari rekap konvensional.</span><button id="usgExport" class="secondary" type="button">Unduh Excel</button></div></section>`;
    $('usgDate').value = usgState.date;
    $('usgPrev').addEventListener('click', () => shiftUsgDate(-1));
    $('usgNext').addEventListener('click', () => shiftUsgDate(1));
    $('usgDate').addEventListener('change', (event) => setUsgDate(event.target.value));
    $('usgExport').addEventListener('click', exportUsgExcel);
    renderUsgForm();
    renderUsgReport();
  }

  function renderServiceReports() {
    const entries = Object.values(read(SERVICE_KEY)).flat().filter((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(entry.minutes));
    const monthly = new Map();
    entries.forEach((entry) => {
      const key = entry.date.slice(0, 7);
      const row = monthly.get(key) || { thoraxTotal: 0, thoraxCount: 0, allTotal: 0, allCount: 0 };
      row.allTotal += entry.minutes;
      row.allCount += 1;
      if (entry.type === 'thorax') {
        row.thoraxTotal += entry.minutes;
        row.thoraxCount += 1;
      }
      monthly.set(key, row);
    });
    const rows = [...monthly.entries()].sort(([a], [b]) => b.localeCompare(a));
    $('serviceMonthly').innerHTML = rows.length ? `<table><thead><tr><th>Bulan</th><th>Jumlah Thorax</th><th>Rata-rata Thorax</th><th>Jumlah semua pemeriksaan</th><th>Rata-rata keseluruhan</th></tr></thead><tbody>${rows.map(([key, row]) => `<tr><th>${monthLabel(key)}</th><td>${fmt(row.thoraxCount)}</td><td>${formatDuration(row.thoraxCount ? row.thoraxTotal / row.thoraxCount : 0)}</td><td>${fmt(row.allCount)}</td><td>${formatDuration(row.allCount ? row.allTotal / row.allCount : 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada catatan waktu pelayanan.</p>';
    const recent = entries.sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 30);
    $('serviceRecent').innerHTML = recent.length ? `<table><thead><tr><th>Tanggal</th><th>Kelompok</th><th>Mulai</th><th>Selesai</th><th>Durasi</th></tr></thead><tbody>${recent.map((entry) => `<tr><td>${entry.date}</td><td>${entry.type === 'thorax' ? 'Thorax' : 'Pemeriksaan lainnya'}</td><td>${entry.start}</td><td>${entry.end}</td><td>${formatDuration(entry.minutes)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada catatan waktu pelayanan.</p>';
  }

  function formatDuration(minutes) {
    const rounded = Math.round(minutes);
    return `${Math.floor(rounded / 60)} jam ${String(rounded % 60).padStart(2, '0')} menit`;
  }

  function saveServiceTime() {
    const date = $('serviceDate').value;
    const type = $('serviceType').value;
    const start = $('serviceStart').value;
    const end = $('serviceEnd').value;
    if (!date || !start || !end) {
      $('serviceStatus').textContent = 'Lengkapi tanggal, waktu mulai, dan waktu selesai.';
      return;
    }
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const startAt = startHour * 60 + startMinute;
    let endAt = endHour * 60 + endMinute;
    if (endAt < startAt) endAt += 24 * 60;
    const minutes = endAt - startAt;
    if (minutes <= 0 || minutes > 24 * 60) {
      $('serviceStatus').textContent = 'Pastikan waktu selesai berbeda dan durasinya tidak lebih dari 24 jam.';
      return;
    }
    const records = read(SERVICE_KEY);
    records[date] = Array.isArray(records[date]) ? records[date] : [];
    records[date].push({ type, start, end, minutes, createdAt: new Date().toISOString() });
    localStorage.setItem(SERVICE_KEY, JSON.stringify(records));
    $('serviceStatus').textContent = `Waktu pelayanan tercatat: ${formatDuration(minutes)}.`;
    $('serviceStart').value = '';
    $('serviceEnd').value = '';
    renderServiceReports();
  }

  function setModule(module) {
    const menu = $('mainMenu');
    menu.hidden = true;
    $('mainMenuToggle').setAttribute('aria-expanded', 'false');
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.remove('on');
      view.hidden = view.id === 'v-usg' || view.id === 'v-waktu';
    });
    const conventionalNav = document.querySelector('.conventional-nav');
    conventionalNav.hidden = module !== 'konvensional';
    document.body.dataset.activeModule = module;

    if (module === 'konvensional') {
      const activeView = document.querySelector('.conventional-nav button.on') || document.querySelector('.conventional-nav [data-view="isi"]');
      activeView.click();
      return;
    }
    const section = $(`v-${module}`);
    if (!section) return;
    section.hidden = false;
    section.classList.add('on');
    history.replaceState(null, '', `#${module}`);
    window.scrollTo({ top: 0 });
    if (module === 'usg') {
      renderUsgForm();
      renderUsgReport();
    } else {
      renderServiceReports();
    }
  }

  function init() {
    renderUsgModule();
    $('serviceDate').value = todayKey();
    renderServiceReports();
    $('mainMenuToggle').addEventListener('click', () => {
      const menu = $('mainMenu');
      menu.hidden = !menu.hidden;
      $('mainMenuToggle').setAttribute('aria-expanded', String(!menu.hidden));
    });
    $('mainMenu').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-module]');
      if (button) setModule(button.dataset.module);
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.main-menu-wrap')) {
        $('mainMenu').hidden = true;
        $('mainMenuToggle').setAttribute('aria-expanded', 'false');
      }
    });
    $('saveService').addEventListener('click', saveServiceTime);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
