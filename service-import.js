(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const normalize = (value) => String(value ?? '').toLocaleLowerCase('id-ID').replace(/[()–—]/g, ' ').replace(/[\s\u00a0]+/g, ' ').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmtNumber = (value) => Number(value || 0).toLocaleString('id-ID');
  const fmtDuration = (minutes) => {
    if (!Number.isFinite(minutes)) return '—';
    const sign = minutes < 0 ? '−' : '';
    const absolute = Math.floor(Math.abs(minutes));
    return `${sign}${Math.floor(absolute / 60)} jam ${String(absolute % 60).padStart(2, '0')} menit`;
  };

  function findColumn(headers, names) {
    const candidates = names.map(normalize);
    return headers.findIndex((header) => candidates.includes(normalize(header)));
  }

  function findHeaderRow(rows) {
    return rows.findIndex((row) => {
      const values = row.map(normalize);
      return values.some((v) => v === 'pemeriksaan' || v === 'jenis pemeriksaan')
        && values.some((v) => v === 'waktu kedatangan')
        && values.some((v) => v === 'waktu selesai');
    });
  }

  function excelDate(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value === 'number' && window.XLSX?.SSF) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0));
    }
    const text = String(value ?? '').trim();
    if (!text) return null;
    const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (dmy) {
      const [, day, month, year, hour = '0', minute = '0', second = '0'] = dmy;
      const result = new Date(+year, +month - 1, +day, +hour, +minute, +second);
      return Number.isNaN(result.getTime()) ? null : result;
    }
    const result = new Date(text);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  // Excel time cells are fractions of a day. Keep their time-of-day value; do not
  // subtract full calendar datetimes because the workbook's report compares clock time.
  function excelTimeMinutes(value) {
    if (value === '' || value == null) return null;
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getUTCHours() * 60 + value.getUTCMinutes() + value.getUTCSeconds() / 60;
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value >= 0 && value < 1) return value * 1440;
      return value * 1440;
    }
    if (typeof value === 'object' && Number.isFinite(value?.getTime?.())) return value.getHours() * 60 + value.getMinutes();
    const match = String(value).trim().match(/^(-?\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (match) return Math.sign(Number(match[1])) * (Math.abs(Number(match[1])) * 60 + Number(match[2]) + Number(match[3] || 0) / 60);
    return null;
  }

  function timeOfDayMinutes(value) {
    const date = excelDate(value);
    return date ? date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 : null;
  }

  function monthFromWorkbook(workbook, rows, dataSheet) {
    const report = workbook.Sheets[workbook.SheetNames.find((name) => normalize(name) === 'laporan')];
    if (report) {
      const reportRows = XLSX.utils.sheet_to_json(report, { header: 1, raw: true, defval: '' });
      const line = reportRows.find((row) => normalize(row[1]).startsWith('bulan'));
      const text = line ? String(line[1]) : '';
      const match = text.match(/(januari|februari|maret|april|mei|juni|juli|agustus|agutus|september|oktober|november|desember)\s+(20\d{2})/i);
      if (match) {
        const index = MONTHS.findIndex((month) => normalize(month).startsWith(normalize(match[1]).slice(0, 4)));
        return `${MONTHS[index >= 0 ? index : 7]} ${match[2]}`;
      }
    }
    const title = String(rows[0]?.[0] ?? '');
    const titleMatch = title.match(/(januari|februari|maret|april|mei|juni|juli|agustus|agutus|september|oktober|november|desember)\s+(20\d{2})/i);
    if (titleMatch) {
      const index = MONTHS.findIndex((month) => normalize(month).startsWith(normalize(titleMatch[1]).slice(0, 4)));
      return `${MONTHS[index >= 0 ? index : 7]} ${titleMatch[2]}`;
    }
    const first = dataSheet.find((row) => row.arrivalDate || row.registrationDate);
    const date = first?.arrivalDate || first?.registrationDate;
    return date ? `${MONTHS[date.getMonth()]} ${date.getFullYear()}` : 'Periode tidak teridentifikasi';
  }

  function parseSheet(rows, sheetName) {
    const headerRow = findHeaderRow(rows);
    if (headerRow < 0) return null;
    const headers = rows[headerRow];
    const col = {
      number: findColumn(headers, ['No']),
      department: findColumn(headers, ['Departemen', 'Asal Pasien']),
      exam: findColumn(headers, ['Pemeriksaan', 'Jenis Pemeriksaan']),
      registration: findColumn(headers, ['Waktu Registrasi']),
      billing: findColumn(headers, ['Konfirmasi Billing']),
      arrival: findColumn(headers, ['Waktu Kedatangan']),
      completion: findColumn(headers, ['Waktu Selesai']),
      billingDiff: findColumn(headers, ['Selisih Waktu (Selesai-Konfirmasi)', 'Selisih Waktu Selesai-Konfirmasi']),
      arrivalDiff: findColumn(headers, ['Selisih Waktu (Selesai-Kedatangan)', 'Selisih Waktu Selesai-Kedatangan']),
      category: findColumn(headers, ['Keterangan Waktu Tunggu (Kedatangan-Selesai)', 'Keterangan Waktu Tunggu'])
    };
    const records = [];
    rows.slice(headerRow + 1).forEach((row, index) => {
      if (!row.some((cell) => String(cell ?? '').trim() !== '')) return;
      const exam = String(row[col.exam] ?? '').trim();
      if (!exam) return;
      const arrivalDate = col.arrival >= 0 ? excelDate(row[col.arrival]) : null;
      const registrationDate = col.registration >= 0 ? excelDate(row[col.registration]) : null;
      const completionDate = col.completion >= 0 ? excelDate(row[col.completion]) : null;
      const billingDate = col.billing >= 0 ? excelDate(row[col.billing]) : null;
      let billingMinutes = col.billingDiff >= 0 ? excelTimeMinutes(row[col.billingDiff]) : null;
      let arrivalMinutes = col.arrivalDiff >= 0 ? excelTimeMinutes(row[col.arrivalDiff]) : null;
      if (billingMinutes == null && completionDate && billingDate) billingMinutes = timeOfDayMinutes(completionDate) - timeOfDayMinutes(billingDate);
      if (arrivalMinutes == null && completionDate && arrivalDate) arrivalMinutes = timeOfDayMinutes(completionDate) - timeOfDayMinutes(arrivalDate);
      const categoryText = col.category >= 0 ? String(row[col.category] ?? '').trim() : '';
      const isThorax = /thorax/i.test(exam);
      const status = /data tidak lengkap/i.test(categoryText) || !arrivalDate || arrivalMinutes == null
        ? 'Data Tidak Lengkap'
        : /kurang dari 8 jam/i.test(categoryText) ? 'Kurang dari 8 Jam'
          : /lebih dari 8 jam/i.test(categoryText) ? 'Lebih dari 8 Jam'
            : arrivalMinutes < 480 ? 'Kurang dari 8 Jam' : 'Lebih dari 8 Jam';
      records.push({
        rowNumber: headerRow + index + 2,
        number: col.number >= 0 ? row[col.number] : records.length + 1,
        department: col.department >= 0 ? String(row[col.department] ?? '').trim() : '',
        exam,
        isThorax,
        registrationDate,
        billingDate,
        arrivalDate,
        completionDate,
        billingMinutes,
        arrivalMinutes,
        status
      });
    });
    return { sheetName, records };
  }

  function buildReport(workbook) {
    const parsedSheets = workbook.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
      return parseSheet(rows, name);
    }).filter(Boolean);
    if (!parsedSheets.length) throw new Error('Format Excel belum dikenali. Pastikan terdapat header Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai.');

    const thoraxSheet = parsedSheets.find((sheet) => normalize(sheet.sheetName) === 'thorax');
    const sourceSheet = parsedSheets.find((sheet) => normalize(sheet.sheetName) !== 'thorax' && normalize(sheet.sheetName) !== 'laporan');
    const thoraxRecords = thoraxSheet ? thoraxSheet.records : (sourceSheet || parsedSheets[0]).records.filter((record) => record.isThorax);
    if (!thoraxRecords.length) throw new Error('Data berhasil dibaca, tetapi tidak ditemukan baris pemeriksaan Thorax.');

    const workbookRows = XLSX.utils.sheet_to_json(workbook.Sheets[thoraxSheet?.sheetName || sourceSheet?.sheetName || parsedSheets[0].sheetName], { header: 1, raw: true, defval: '' });
    const period = monthFromWorkbook(workbook, workbookRows, thoraxRecords);
    const complete = thoraxRecords.filter((record) => record.status !== 'Data Tidak Lengkap' && Number.isFinite(record.arrivalMinutes));
    const under = complete.filter((record) => record.arrivalMinutes < 480).length;
    const over = complete.length - under;
    const incomplete = thoraxRecords.length - complete.length;
    const average = complete.length ? complete.reduce((sum, record) => sum + record.arrivalMinutes, 0) / complete.length : NaN;
    const percent = complete.length ? under / complete.length : 0;
    const overPercent = complete.length ? over / complete.length : 0;
    const sourceRows = parsedSheets.reduce((sum, sheet) => sum + sheet.records.length, 0);

    return { period, records: thoraxRecords, complete, under, over, incomplete, average, percent, overPercent, sourceRows, sheetNames: workbook.SheetNames };
  }

  function renderReport(report, fileName) {
    const target = $('serviceReportContent');
    const result = $('serviceReportResult');
    const evaluation = `Dari hasil pemantauan waktu tunggu pelayanan foto thorax bulan ${escapeHtml(report.period)} di Instalasi Radiologi RS Setia Mitra, didapatkan ${fmtNumber(report.over)} pasien (${(report.overPercent * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%) yang melebihi standar waktu tunggu maksimal 8 jam. Waktu rata-rata pelayanan foto thorax pada bulan ini adalah ${fmtDuration(report.average)}.`;
    const averageText = fmtDuration(report.average);
    const dataRows = report.records.map((record, index) => {
      const date = record.arrivalDate || record.registrationDate;
      const dateText = date ? date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
      const time = (value) => value ? value.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
      const statusClass = record.status === 'Kurang dari 8 Jam' ? 'is-under' : record.status === 'Lebih dari 8 Jam' ? 'is-over' : 'is-incomplete';
      return `<tr><td>${index + 1}</td><td>${dateText}</td><td>${escapeHtml(record.department || '—')}</td><td>${escapeHtml(record.exam)}</td><td>${time(record.arrivalDate)}</td><td>${time(record.completionDate)}</td><td>${fmtDuration(record.arrivalMinutes)}</td><td><span class="service-status ${statusClass}">${escapeHtml(record.status)}</span></td></tr>`;
    }).join('');

    target.innerHTML = `
      <div class="service-report-toolbar"><div><p class="eyebrow">Hasil pembacaan otomatis</p><h3>${escapeHtml(fileName)}</h3><p class="muted">Sheet terbaca: ${report.sheetNames.map(escapeHtml).join(', ')}</p></div><span class="service-read-count">${fmtNumber(report.records.length)} data Thorax</span></div>
      <article class="service-formal-report">
        <header class="service-formal-heading"><strong>RUMAH SAKIT SETIA MITRA</strong><strong>INSTALASI RADIOLOGI</strong><h3>LAPORAN DAN EVALUASI WAKTU TUNGGU HASIL PELAYANAN FOTO THORAX</h3><p>Bulan: ${escapeHtml(report.period)}</p></header>
        <section class="service-report-section"><h4>I. Pemantauan</h4><div class="service-stat-grid">
          <div><span>Jumlah foto Thorax dengan waktu tunggu &lt; 8 jam</span><strong>${fmtNumber(report.under)}</strong></div>
          <div><span>Jumlah foto Thorax dengan waktu tunggu &gt;= 8 jam</span><strong>${fmtNumber(report.over)}</strong></div>
          <div><span>Jumlah total foto Thorax</span><strong>${fmtNumber(report.records.length)}</strong></div>
          <div><span>Data tidak lengkap (waktu kedatangan/durasi tidak tercatat)</span><strong>${fmtNumber(report.incomplete)}</strong></div>
          <div><span>Persentase waktu tunggu &lt; 8 jam (dari data lengkap)</span><strong>${(report.percent * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong></div>
          <div><span>Waktu rata-rata pelayanan (kedatangan–selesai)</span><strong>${averageText}</strong></div>
        </div></section>
        <section class="service-report-section"><h4>II. Evaluasi</h4><p>${evaluation}</p><p>Dari hasil rata-rata waktu pelayanan foto thorax ${averageText}. Penyebab lamanya waktu tunggu pelayanan perlu dievaluasi berdasarkan alur pelayanan, ketersediaan dokter spesialis radiologi, serta faktor operasional pada periode tersebut.</p></section>
        <section class="service-report-section"><h4>III. Tindak Lanjut</h4><p>Unit Radiologi melakukan evaluasi secara berkesinambungan serta berkoordinasi dengan dokter spesialis radiologi dan pihak terkait untuk meningkatkan mutu waktu tunggu hasil pelayanan foto thorax di RS Setia Mitra.</p></section>
        <p class="service-report-note">Laporan dibuat otomatis berdasarkan seluruh ${fmtNumber(report.records.length)} baris pada sheet data Thorax. Data identitas pasien tidak ditampilkan.</p>
      </article>
      <section class="service-data-section"><div class="service-data-heading"><div><h3>Seluruh data pemeriksaan Thorax</h3><p class="muted">${fmtNumber(report.records.length)} baris dibaca; tidak dibatasi pratinjau.</p></div></div>
        <div class="service-table-wrap"><table class="service-data-table"><thead><tr><th>No</th><th>Tanggal</th><th>Departemen</th><th>Pemeriksaan</th><th>Waktu Kedatangan</th><th>Waktu Selesai</th><th>Selisih Kedatangan–Selesai</th><th>Keterangan</th></tr></thead><tbody>${dataRows}</tbody></table></div>
      </section>
      <p class="service-data-footnote">Total baris data yang berhasil dibaca dari sheet data dalam workbook: ${fmtNumber(report.sourceRows)}.</p>`;
    result.hidden = false;
  }

  async function handleFile(file) {
    const status = $('serviceImportStatus');
    const result = $('serviceReportResult');
    if (!file) return;
    result.hidden = true;
    $('serviceReportContent').replaceChildren();
    status.textContent = `Membaca seluruh isi ${file.name}…`;
    try {
      if (!window.XLSX) throw new Error('Pemroses Excel belum siap. Muat ulang halaman dan coba kembali.');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });
      const report = buildReport(workbook);
      renderReport(report, file.name);
      status.textContent = `Selesai. Seluruh workbook dibaca dan laporan berhasil dibuat dari ${fmtNumber(report.records.length)} data Thorax.`;
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'File gagal dibaca. Periksa format Excel.';
      result.hidden = true;
    }
  }

  function init() {
    const input = $('serviceImportFile');
    if (!input) return;
    input.addEventListener('change', () => handleFile(input.files?.[0]));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
