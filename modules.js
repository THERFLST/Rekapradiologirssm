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
  const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const todayKey = () => toDateKey(new Date());
  const parseDate = (key) => new Date(`${key}T12:00:00`);
  const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID');
  const monthLabel = (key) => {
    const [year, month] = key.split('-').map(Number);
    return `${MONTHS[(month || 1) - 1] || ''} ${year || ''}`.trim();
  };

  const readStorage = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.error(`Gagal membaca storage ${key}`, error);
      return {};
    }
  };

  function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getUsgRecord(date) {
    const allRecords = readStorage(USG_KEY);
    const record = allRecords[date] || {};
    const source = {};
    const payer = {};
    const exams = {};

    ORIGINS.forEach(([key]) => {
      source[key] = record.source && record.source[key] !== undefined ? record.source[key] : (record[key] !== undefined ? record[key] : '');
    });
    PAYERS.forEach(([key]) => {
      payer[key] = record.payer && record.payer[key] !== undefined ? record.payer[key] : (record[key] !== undefined ? record[key] : '');
    });
    USG_TYPES.forEach(([key]) => {
      const exam = record.exams && record.exams[key] ? record.exams[key] : {};
      exams[key] = { patients: exam.patients !== undefined ? exam.patients : (record[key] !== undefined ? record[key] : '') };
    });

    return { source, payer, exams };
  }

  function writeUsgRecord(date, record) {
    const allRecords = readStorage(USG_KEY);
    const hasValue = Object.values(record.source).some((value) => value !== '' && value != null)
      || Object.values(record.payer).some((value) => value !== '' && value != null)
      || Object.values(record.exams).some((exam) => exam && (exam.patients !== '' && exam.patients != null));

    if (hasValue) {
      allRecords[date] = {
        source: record.source,
        payer: record.payer,
        exams: record.exams
      };
    } else {
      delete allRecords[date];
    }

    localStorage.setItem(USG_KEY, JSON.stringify(allRecords));
  }

  function usgTotals(record) {
    const visits = ORIGINS.reduce((sum, [key]) => sum + safeNumber(record.source[key]), 0);
    const examinations = USG_TYPES.reduce((sum, [key]) => sum + safeNumber(record.exams[key]?.patients), 0);
    return { visits, examinations };
  }

  function usgErrors(record) {
    const errors = [];
    const visits = usgTotals(record).visits;
    const payerTotal = PAYERS.filter(([key]) => key !== 'naker').reduce((sum, [key]) => sum + safeNumber(record.payer[key]), 0);
    const anyValue = [...Object.values(record.source), ...Object.values(record.payer), ...USG_TYPES.map(([key]) => record.exams[key]?.patients)]
      .some((value) => value !== '' && value != null);

    if (anyValue && visits !== payerTotal) {
      errors.push('Total asal pasien harus sama dengan total penjamin (BPJS + Umum + Asuransi).');
    }

    return errors;
  }

  function renderUsgForm() {
    const dateInput = $('usgDate');
    const dateLabel = $('usgCaption');
    const record = getUsgRecord(usgState.date);

    if (!dateInput || !dateLabel) return;

    dateInput.value = usgState.date;
    const targetDate = parseDate(usgState.date);
    dateLabel.textContent = `${DAYS[targetDate.getDay()]}, ${targetDate.getDate()} ${MONTHS[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

    const originsWrap = $('usgOrigins');
    const payersWrap = $('usgPayers');
    const examsWrap = $('usgExamFields');

    if (originsWrap) {
      originsWrap.innerHTML = ORIGINS.map(([key, label]) => `
        <label class="usg-row">
          <span>${label}</span>
          <input type="number" min="0" step="1" inputmode="numeric" data-usg-group="source" data-usg-key="${key}" value="${record.source[key] ?? ''}">
        </label>
      `).join('');
    }

    if (payersWrap) {
      payersWrap.innerHTML = PAYERS.map(([key, label]) => `
        <label class="usg-row">
          <span>${label}</span>
          <input type="number" min="0" step="1" inputmode="numeric" data-usg-group="payer" data-usg-key="${key}" value="${record.payer[key] ?? ''}">
        </label>
      `).join('');
    }

    if (examsWrap) {
      examsWrap.innerHTML = USG_TYPES.map(([key, label]) => `
        <div class="exam-row">
          <strong>${label}</strong>
          <label>
            <span>Jumlah</span>
            <input type="number" min="0" step="1" inputmode="numeric" data-usg-exam="${key}" value="${record.exams[key]?.patients ?? ''}">
          </label>
        </div>
      `).join('');
    }

    document.querySelectorAll('#usgOrigins input, #usgPayers input, #usgExamFields input').forEach((input) => {
      input.oninput = (event) => {
        const current = event.target;
        const raw = current.value.trim();
        if (raw !== '' && (!Number.isInteger(Number(raw)) || Number(raw) < 0)) {
          current.setCustomValidity('Masukkan angka bulat 0 atau lebih.');
          current.reportValidity();
          return;
        }
        current.setCustomValidity('');

        const nextRecord = getUsgRecord(usgState.date);
        const numeric = raw === '' ? '' : Number(raw);

        if (current.dataset.usgGroup) {
          nextRecord[current.dataset.usgGroup][current.dataset.usgKey] = numeric;
        }

        if (current.dataset.usgExam) {
          nextRecord.exams[current.dataset.usgExam] = { ...(nextRecord.exams[current.dataset.usgExam] || {}), patients: numeric };
        }

        writeUsgRecord(usgState.date, nextRecord);
        renderUsgSummary();
        renderUsgReport();
      };
    });

    renderUsgSummary();
  }

  function renderUsgSummary() {
    const dayVisits = $('usgDayVisits');
    const dayExams = $('usgDayExams');
    const dayStatus = $('usgDayStatus');
    const errorsWrap = $('usgErrors');
    const savedWrap = $('usgSaved');

    if (!dayVisits || !dayExams || !dayStatus || !errorsWrap) return;

    const record = getUsgRecord(usgState.date);
    const totals = usgTotals(record);
    const errors = usgErrors(record);

    dayVisits.textContent = formatNumber(totals.visits);
    dayExams.textContent = formatNumber(totals.examinations);
    dayStatus.textContent = errors.length ? 'Perlu dicek' : 'OK';
    dayStatus.className = errors.length ? 'bad' : 'good';
    errorsWrap.innerHTML = errors.length ? `<ul>${errors.map((item) => `<li>${item}</li>`).join('')}</ul>` : 'Data harian valid.';

    if (savedWrap) {
      savedWrap.textContent = 'Tersimpan otomatis di browser ini.';
    }
  }

  function periodKeys(mode, ref) {
    if (mode === 'harian') {
      return { keys: [ref], label: ref };
    }

    if (mode === 'mingguan') {
      const date = parseDate(ref);
      const start = new Date(date);
      const diff = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - diff);
      const keys = [];
      for (let i = 0; i < 7; i += 1) {
        const current = new Date(start);
        current.setDate(start.getDate() + i);
        keys.push(toDateKey(current));
      }
      return { keys, label: `${keys[0]} – ${keys[keys.length - 1]}` };
    }

    const monthKey = ref.slice(0, 7);
    const [year, month] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const keys = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      keys.push(`${year}-${pad(month)}-${pad(day)}`);
    }
    return { keys, label: monthLabel(monthKey) };
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

      ORIGINS.forEach(([key]) => {
        origins[key] += safeNumber(record.source[key]);
      });

      PAYERS.forEach(([key]) => {
        payers[key] += safeNumber(record.payer[key]);
      });

      USG_TYPES.forEach(([key]) => {
        exams[key] += safeNumber(record.exams[key]?.patients);
      });

      days.push({ date, ...totals });
    });

    return { origins, payers, exams, visits, examinationTotal, days };
  }

  function renderUsgReport() {
    const reportControls = $('usgReportControls');
    const reportOutput = $('usgReportOutput');
    if (!reportControls || !reportOutput) return;

    const mode = usgState.report.mode || 'bulanan';
    const ref = usgState.report.ref || todayKey().slice(0, 7);

    const inputType = mode === 'harian' ? 'date' : mode === 'mingguan' ? 'date' : 'month';
    const inputValue = mode === 'bulanan' ? ref.slice(0, 7) : ref;

    reportControls.innerHTML = `
      <div class="seg">
        ${['harian', 'mingguan', 'bulanan'].map((item) => `
          <button type="button" class="${item === mode ? 'on' : ''}" data-usg-mode="${item}">${item[0].toUpperCase()}${item.slice(1)}</button>
        `).join('')}
      </div>
      <label>
        <span>${mode === 'bulanan' ? 'Bulan' : mode === 'mingguan' ? 'Tanggal dalam minggu' : 'Tanggal'}</span>
        <input type="${inputType}" value="${inputValue}">
      </label>
    `;

    reportControls.querySelectorAll('[data-usg-mode]').forEach((button) => {
      button.onclick = () => {
        usgState.report.mode = button.dataset.usgMode;
        if (mode === 'bulanan') {
          usgState.report.ref = ref.slice(0, 7);
        } else if (usgState.report.ref.length === 7 && usgState.report.mode !== 'bulanan') {
          usgState.report.ref = `${ref}-01`;
        }
        renderUsgReport();
      };
    });

    const inputEl = reportControls.querySelector('input');
    inputEl.onchange = (event) => {
      const value = event.target.value;
      if (!value) return;
      usgState.report.ref = value.length === 7 && usgState.report.mode !== 'bulanan' ? `${value}-01` : value;
      renderUsgReport();
    };

    const period = periodKeys(usgState.report.mode, usgState.report.ref);
    const totals = aggregateUsg(period.keys);

    reportOutput.innerHTML = `
      <div class="cards">
        <article><span>Kunjungan</span><strong>${formatNumber(totals.visits)}</strong></article>
        <article><span>Pemeriksaan USG</span><strong>${formatNumber(totals.examinationTotal)}</strong></article>
      </div>

      <section class="panel">
        <div class="summary-grid">
          <article>
            <h3>Asal pasien</h3>
            ${ORIGINS.map(([key, label]) => `<div class="summary-line"><span>${label}</span><strong>${formatNumber(totals.origins[key])}</strong></div>`).join('')}
          </article>
          <article>
            <h3>Penjamin</h3>
            ${PAYERS.filter(([key]) => key !== 'naker').map(([key, label]) => `<div class="summary-line"><span>${label}</span><strong>${formatNumber(totals.payers[key])}</strong></div>`).join('')}
            <p class="hint">Naker dicatat sebagai keterangan dan tidak masuk total.</p>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="section-title"><h3>Jenis pemeriksaan USG</h3></div>
        <div class="scroll">
          <table>
            <thead>
              <tr><th>Jenis Pemeriksaan</th><th>Jumlah</th></tr>
            </thead>
            <tbody>
              ${USG_TYPES.map(([key, label]) => `<tr><td>${label}</td><td>${formatNumber(totals.exams[key])}</td></tr>`).join('')}
              <tr class="subtotal"><th>Total</th><th>${formatNumber(totals.examinationTotal)}</th></tr>
            </tbody>
          </table>
        </div>
      </section>

      ${period.keys.length > 1 ? `
        <section class="panel">
          <div class="section-title"><h3>Per hari · ${period.label}</h3></div>
          <div class="scroll">
            <table>
              <thead>
                <tr><th>Tanggal</th><th>Hari</th><th>Kunjungan</th><th>Pemeriksaan</th></tr>
              </thead>
              <tbody>
                ${totals.days.map((row) => `
                  <tr>
                    <td>${row.date}</td>
                    <td>${DAYS[parseDate(row.date).getDay()]}</td>
                    <td>${formatNumber(row.visits)}</td>
                    <td>${formatNumber(row.examinations)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}
    `;
  }

  function exportUsgExcel() {
    if (!window.XLSX) {
      alert('Excel belum dimuat. Periksa koneksi internet.');
      return;
    }

    const period = periodKeys(usgState.report.mode, usgState.report.ref);
    const rows = [['Tanggal', 'Hari', 'Kunjungan', 'Pemeriksaan USG', ...USG_TYPES.map(([, label]) => label)]];

    period.keys.forEach((date) => {
      const record = getUsgRecord(date);
      const totals = usgTotals(record);
      rows.push([
        date,
        DAYS[parseDate(date).getDay()],
        totals.visits,
        totals.examinations,
        ...USG_TYPES.map(([key]) => safeNumber(record.exams[key]?.patients))
      ]);
    });

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rekap USG');
    XLSX.writeFile(workbook, `rekap-usg-${usgState.report.mode}-${period.keys[0] || todayKey()}.xlsx`);
  }

  function renderUsgModule() {
    const section = $('v-usg');
    if (!section) return;

    section.innerHTML = `
      <nav class="nav usg-nav" aria-label="Navigasi rekap USG" role="tablist">
        <button type="button" data-usg-view="isi" class="on">Isi Data</button>
        <button type="button" data-usg-view="rekap">Lihat Rekapan</button>
        <button type="button" data-usg-view="export">Export</button>
      </nav>
      <div id="usg-isi-view" class="usg-subview">
      <div class="section-title">
        <div>
          <p class="eyebrow">Modul USG</p>
          <h2>Isi Data Harian</h2>
          <p id="usgCaption" class="muted"></p>
        </div>
        <div class="date-nav">
          <button id="usgPrev" type="button" aria-label="Hari sebelumnya">‹</button>
          <label>Tanggal<input id="usgDate" type="date"></label>
          <button id="usgNext" type="button" aria-label="Hari berikutnya">›</button>
        </div>
      </div>

      <div class="form-grid">
        <section>
          <h3>Asal pasien</h3>
          <div id="usgOrigins" class="fields"></div>
        </section>
        <section>
          <h3>Penjamin</h3>
          <p class="hint">Naker hanya keterangan, tidak dihitung dalam total penjamin.</p>
          <div id="usgPayers" class="fields"></div>
        </section>
      </div>

      <section class="exam-section">
        <h3>Jenis pemeriksaan</h3>
        <div id="usgExamFields" class="exam-grid"></div>
      </section>

      <div class="daily-summary">
        <span>Kunjungan <b id="usgDayVisits">-</b></span>
        <span>Pemeriksaan <b id="usgDayExams">-</b></span>
        <span>Status <b id="usgDayStatus">OK</b></span>
      </div>

      <div id="usgErrors" class="errors" aria-live="polite"></div>
      <div class="footer-row">
        <span id="usgSaved" class="hint">Tersimpan otomatis di browser.</span>
      </div>

      </div>
      <section id="usg-rekap-view" class="panel usg-subview" hidden>
        <div class="section-title">
          <div>
            <p class="eyebrow">Rekap USG</p>
            <h2>Lihat Rekapan</h2>
          </div>
        </div>
        <div id="usgReportControls" class="ctl"></div>
        <div id="usgReportOutput"></div>
      </section>
      <section id="usg-export-view" class="panel usg-subview" hidden>
        <div class="section-title"><div><p class="eyebrow">Rekap USG</p><h2>Export Data</h2><p class="muted">Unduh rekap sesuai periode yang dipilih pada menu Lihat Rekapan.</p></div></div>
        <button id="usgExport" class="secondary" type="button">Unduh Excel</button>
      </section>
    `;

    usgState.date = usgState.date || todayKey();
    usgState.report = usgState.report || { mode: 'bulanan', ref: todayKey().slice(0, 7) };

    const dateInput = $('usgDate');
    if (dateInput) {
      dateInput.value = usgState.date;
      dateInput.onchange = (event) => {
        const value = event.target.value;
        if (value) {
          usgState.date = value;
          renderUsgForm();
        }
      };
    }

    $('usgPrev')?.addEventListener('click', () => {
      const next = parseDate(usgState.date);
      next.setDate(next.getDate() - 1);
      usgState.date = toDateKey(next);
      renderUsgForm();
    });

    $('usgNext')?.addEventListener('click', () => {
      const next = parseDate(usgState.date);
      next.setDate(next.getDate() + 1);
      usgState.date = toDateKey(next);
      renderUsgForm();
    });

    $('usgExport')?.addEventListener('click', exportUsgExcel);
    section.querySelectorAll('[data-usg-view]').forEach((button) => button.addEventListener('click', () => {
      usgState.view = button.dataset.usgView;
      section.querySelectorAll('[data-usg-view]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('on', active);
        item.setAttribute('aria-selected', String(active));
      });
      section.querySelectorAll('.usg-subview').forEach((view) => {
        view.hidden = view.id !== `usg-${usgState.view}-view`;
      });
      if (usgState.view === 'rekap') renderUsgReport();
    }));
    section.querySelectorAll('.usg-subview').forEach((view) => { view.hidden = view.id !== `usg-${usgState.view}-view`; });
    section.querySelectorAll('[data-usg-view]').forEach((button) => {
      const active = button.dataset.usgView === usgState.view;
      button.classList.toggle('on', active);
      button.setAttribute('aria-selected', String(active));
    });

    renderUsgForm();
    renderUsgReport();
  }

  function formatDuration(minutes) {
    const rounded = Math.round(minutes);
    return `${Math.floor(rounded / 60)} jam ${String(rounded % 60).padStart(2, '0')} menit`;
  }

  function renderServiceReports() {
    const monthlyWrap = $('serviceMonthly');
    const recentWrap = $('serviceRecent');
    if (!monthlyWrap || !recentWrap) return;

    const records = readStorage(SERVICE_KEY);
    const entries = Object.entries(records)
      .flatMap(([date, list]) => (Array.isArray(list) ? list.map((item) => ({ ...item, date })) : []))
      .filter((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(entry.minutes));

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
    monthlyWrap.innerHTML = rows.length
      ? `<table><thead><tr><th>Bulan</th><th>Jumlah Thorax</th><th>Rata-rata Thorax</th><th>Jumlah semua pemeriksaan</th><th>Rata-rata keseluruhan</th></tr></thead><tbody>${rows.map(([key, row]) => `<tr><td>${monthLabel(key)}</td><td>${formatNumber(row.thoraxCount)}</td><td>${formatDuration(row.thoraxCount ? row.thoraxTotal / row.thoraxCount : 0)}</td><td>${formatNumber(row.allCount)}</td><td>${formatDuration(row.allCount ? row.allTotal / row.allCount : 0)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty-state">Belum ada catatan waktu pelayanan.</p>';

    const recent = entries
      .slice()
      .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
      .slice(0, 30);

    recentWrap.innerHTML = recent.length
      ? `<table><thead><tr><th>Tanggal</th><th>Kelompok</th><th>Mulai</th><th>Selesai</th><th>Durasi</th></tr></thead><tbody>${recent.map((entry) => `<tr><td>${entry.date}</td><td>${entry.type === 'thorax' ? 'Thorax' : 'Pemeriksaan lainnya'}</td><td>${entry.start}</td><td>${entry.end}</td><td>${formatDuration(entry.minutes)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty-state">Belum ada catatan waktu pelayanan.</p>';
  }

  function saveServiceTime() {
    const dateInput = $('serviceDate');
    const typeInput = $('serviceType');
    const startInput = $('serviceStart');
    const endInput = $('serviceEnd');
    const status = $('serviceStatus');

    if (!dateInput || !typeInput || !startInput || !endInput || !status) return;

    const date = dateInput.value;
    const type = typeInput.value;
    const start = startInput.value;
    const end = endInput.value;

    if (!date || !start || !end) {
      status.textContent = 'Lengkapi tanggal, waktu mulai, dan waktu selesai.';
      return;
    }

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    const startAt = startHour * 60 + startMinute;
    let endAt = endHour * 60 + endMinute;

    if (endAt < startAt) {
      endAt += 24 * 60;
    }

    const minutes = endAt - startAt;
    if (minutes <= 0 || minutes > 24 * 60) {
      status.textContent = 'Pastikan waktu selesai berbeda dan durasinya tidak lebih dari 24 jam.';
      return;
    }

    const records = readStorage(SERVICE_KEY);
    const list = Array.isArray(records[date]) ? records[date] : [];
    list.push({ type, start, end, minutes, createdAt: new Date().toISOString() });
    records[date] = list;
    localStorage.setItem(SERVICE_KEY, JSON.stringify(records));

    status.textContent = `Waktu pelayanan tercatat: ${formatDuration(minutes)}.`;
    startInput.value = '';
    endInput.value = '';
    renderServiceReports();
  }

  const usgState = {
    date: todayKey(),
    report: { mode: 'bulanan', ref: todayKey().slice(0, 7) },
    view: 'isi'
  };

  function setModule(module) {
    const menu = $('mainMenu');
    const toggle = $('mainMenuToggle');
    if (menu) menu.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');

    const moduleTarget = `v-${module}`;
    const subtitle = document.getElementById('activeModuleSubtitle');
    if (subtitle) subtitle.textContent = ({ konvensional: 'Rekap Konvensional', usg: 'Rekap USG', waktu: 'Laporan Waktu Pelayanan', reminder: 'Reminder USG', master: 'Master Pemeriksaan' })[module] || ''; 
    document.querySelectorAll('.view').forEach((view) => {
      const shouldHide = view.id !== moduleTarget && !['v-usg', 'v-waktu'].includes(view.id);
      if (shouldHide) {
        view.classList.remove('on');
        view.hidden = false;
      }
      if (view.id === 'v-usg' || view.id === 'v-waktu') {
        view.hidden = view.id !== moduleTarget;
        view.classList.toggle('on', view.id === moduleTarget);
      }
    });

    const conventionalNav = document.querySelector('.conventional-nav');
    if (conventionalNav) {
      conventionalNav.hidden = module !== 'konvensional';
    }

    if (module === 'konvensional') {
      const active = document.querySelector('.conventional-nav button.on') || document.querySelector('.conventional-nav [data-view="isi"]');
      if (active) active.click();
      return;
    }

    const target = $(moduleTarget);
    if (target) {
      target.hidden = false;
      target.classList.add('on');
      history.replaceState(null, '', `#${module}`);
      window.scrollTo({ top: 0 });
    }

    if (module === 'usg') {
      renderUsgModule();
    } else if (module === 'waktu') {
      renderServiceReports();
    }
  }

  function init() {
    const serviceDate = $('serviceDate');
    if (serviceDate) {
      serviceDate.value = todayKey();
    }

    const mainMenuToggle = $('mainMenuToggle');
    const mainMenu = $('mainMenu');

    if (mainMenuToggle && mainMenu) {
      mainMenuToggle.addEventListener('click', () => {
        const hidden = mainMenu.hidden;
        mainMenu.hidden = !hidden;
        mainMenuToggle.setAttribute('aria-expanded', String(!mainMenu.hidden));
      });

      mainMenu.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-module]');
        if (button) {
          setModule(button.dataset.module);
        }
      });
    }

    document.addEventListener('click', (event) => {
      const menuWrap = event.target.closest('.main-menu-wrap');
      if (!menuWrap && mainMenu) {
        mainMenu.hidden = true;
        if (mainMenuToggle) {
          mainMenuToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });

    renderUsgModule();
    renderServiceReports();

    const saveButton = $('saveService');
    if (saveButton) {
      saveButton.addEventListener('click', saveServiceTime);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
