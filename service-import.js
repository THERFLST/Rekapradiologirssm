(() => {
  'use strict';

  const SERVICE_KEY = 'rekap-radiologi-service-time-v1';
  const REPORT_KEY = 'rekap-radiologi-thorax-report-v2';
  const $ = (id) => document.getElementById(id);
  let pendingEntries = [];
  let pendingReport = null;

  const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const normalize = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').replace(/[()–—]/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmtDuration = (minutes) => {
    if (!Number.isFinite(minutes)) return '—';
    const sign = minutes < 0 ? '-' : '';
    const rounded = Math.floor(Math.abs(minutes) + 1e-9);
    return `${sign}${Math.floor(rounded / 60)} jam ${String(rounded % 60).padStart(2, '0')} menit`;
  };
  const fmtPercent = (value) => Number.isFinite(value) ? `${(value * 100).toFixed(1).replace('.', ',')}%` : '—';

  function headerIndex(headers, candidates) {
    const keys = candidates.map(normalize);
    return headers.findIndex((header) => keys.includes(normalize(header)));
  }

  function findHeaderRow(rows) {
    return rows.findIndex((row) => {
      const headers = row.map(normalize);
      return headers.some((value) => value === 'pemeriksaan' || value === 'jenis pemeriksaan')
        && headers.some((value) => value === 'waktu selesai')
        && headers.some((value) => value === 'waktu kedatangan');
    });
  }

  function readDate(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds());
    if (typeof value === 'number' && Number.isFinite(value) && window.XLSX?.SSF) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (parts) return new Date(parts.y, parts.m - 1, parts.d, parts.H || 0, parts.M || 0, Math.floor(parts.S || 0));
    }
    const text = String(value ?? '').trim();
    if (!text) return null;
    let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
      const [, a, b, year, hour = '0', minute = '0', second = '0'] = match;
      // Tanggal Indonesia dd/mm/yyyy; format yyyy-mm-dd ditangani oleh Date di bawah.
      const day = Number(a) > 12 ? Number(a) : Number(b);
      const month = Number(a) > 12 ? Number(b) : Number(a);
      const result = new Date(Number(year), month - 1, day, Number(hour), Number(minute), Number(second));
      return Number.isNaN(result.getTime()) ? null : result;
    }
    const result = new Date(text);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  // Durasi Excel biasanya tersimpan sebagai pecahan satu hari. Nilai ini sengaja
  // dibaca sebagai komponen jam, bukan dihitung ulang memakai selisih tanggal.
  function readDuration(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(value) <= 1 ? value * 1440 : value;
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getUTCHours() * 60 + value.getUTCMinutes() + value.getUTCSeconds() / 60;
    const text = String(value ?? '').trim();
    if (!text) return null;
    const match = text.match(/^(-)?(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (match) return (match[1] ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]) + Number(match[4] || 0) / 60);
    return null;
  }

  function clockMinutes(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60;
    if (typeof value === 'number' && Number.isFinite(value)) {
      const fraction = ((value % 1) + 1) % 1;
      return fraction * 1440;
    }
    const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60 : null;
  }

  function durationFromClockComponents(endValue, startValue) {
    const end = clockMinutes(endValue);
    const start = clockMinutes(startValue);
    return end == null || start == null ? null : end - start;
  }

  function fingerprint(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(36);
  }

  function findSourceSheet(workbook) {
    const preferred = workbook.SheetNames.find((name) => normalize(name) === 'thorax');
    const ordered = preferred ? [preferred, ...workbook.SheetNames.filter((name) => name !== preferred)] : workbook.SheetNames;
    for (const name of ordered) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
      const headerRow = findHeaderRow(rows);
      if (headerRow >= 0) return { name, rows, headerRow };
    }
    return null;
  }

  async function parseFile(file) {
    if (!window.XLSX) throw new Error('Pemroses Excel belum siap. Muat ulang halaman dan coba lagi.');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    const source = findSourceSheet(workbook);
    if (!source) throw new Error('Header tidak dikenali. Diperlukan kolom Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai.');
    const headers = source.rows[source.headerRow];
    const columns = {
      exam: headerIndex(headers, ['Pemeriksaan', 'Jenis Pemeriksaan']),
      department: headerIndex(headers, ['Departemen', 'Unit', 'Asal Pasien']),
      registration: headerIndex(headers, ['Waktu Registrasi', 'Tanggal Registrasi']),
      billing: headerIndex(headers, ['Konfirmasi Billing', 'Waktu Konfirmasi Billing']),
      arrival: headerIndex(headers, ['Waktu Kedatangan', 'Tanggal Kedatangan']),
      completion: headerIndex(headers, ['Waktu Selesai', 'Tanggal Selesai']),
      billingDuration: headerIndex(headers, ['Selisih Waktu (Selesai-Konfirmasi)', 'Selisih Waktu Selesai-Konfirmasi']),
      arrivalDuration: headerIndex(headers, ['Selisih Waktu (Selesai-Kedatangan)', 'Selisih Waktu Selesai-Kedatangan'])
    };
    const valid = [];
    const issues = [];
    let skipped = 0;

    source.rows.slice(source.headerRow + 1).forEach((row, offset) => {
      if (!row.some((cell) => String(cell ?? '').trim() !== '')) return;
      const examText = String(row[columns.exam] ?? '').trim();
      if (!/thorax/i.test(examText)) return;
      const registration = columns.registration >= 0 ? readDate(row[columns.registration]) : null;
      const arrival = readDate(row[columns.arrival]);
      const completion = readDate(row[columns.completion]);
      const reportDate = registration || arrival || completion;
      let billingMinutes = columns.billingDuration >= 0 ? readDuration(row[columns.billingDuration]) : null;
      let arrivalMinutes = columns.arrivalDuration >= 0 ? readDuration(row[columns.arrivalDuration]) : null;
      if (columns.billingDuration < 0 && columns.billing >= 0) billingMinutes = durationFromClockComponents(row[columns.completion], row[columns.billing]);
      if (columns.arrivalDuration < 0) arrivalMinutes = durationFromClockComponents(row[columns.completion], row[columns.arrival]);

      if (!reportDate) {
        skipped += 1;
        if (issues.length < 8) issues.push(`Baris ${source.headerRow + offset + 2}: tanggal registrasi/kedatangan tidak terbaca.`);
        return;
      }
      const date = dateKey(reportDate);
      // Tidak menyimpan nama pasien, No. RM, atau No. registrasi.
      const idText = [date, examText.toLocaleLowerCase('id-ID'), row[columns.department], billingMinutes, arrivalMinutes, offset].join('|');
      valid.push({
        importId: `thorax-${fingerprint(idText)}`,
        source: 'spreadsheet',
        type: 'thorax',
        examCategory: 'Thorax',
        examText,
        department: columns.department >= 0 ? String(row[columns.department] ?? '').trim() : '',
        date,
        confirmationMinutes: Number.isFinite(billingMinutes) ? Math.round(billingMinutes * 100) / 100 : null,
        arrivalMinutes: Number.isFinite(arrivalMinutes) ? Math.round(arrivalMinutes * 100) / 100 : null,
        minutes: Number.isFinite(arrivalMinutes) ? arrivalMinutes : null,
        classification: Number.isFinite(arrivalMinutes) ? (arrivalMinutes < 480 ? 'Kurang dari 8 Jam' : 'Lebih dari 8 Jam') : 'Data Tidak Lengkap',
        createdAt: new Date().toISOString()
      });
    });

    if (!valid.length) throw new Error(`Tidak ditemukan baris pemeriksaan Thorax pada sheet ${source.name}. Periksa nama kolom dan isi file.`);
    const report = buildReport(valid, file.name, source.name);
    return { valid, skipped, issues, report, sourceSheet: source.name };
  }

  function buildReport(entries, fileName = '', sourceSheet = '') {
    const monthCounts = new Map();
    entries.forEach((entry) => { const m = entry.date.slice(0, 7); monthCounts.set(m, (monthCounts.get(m) || 0) + 1); });
    const reportMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] || entries[0].date.slice(0, 7);
    const [year, month] = reportMonth.split('-').map(Number);
    const complete = entries.filter((entry) => Number.isFinite(entry.arrivalMinutes));
    const under8 = complete.filter((entry) => entry.arrivalMinutes < 480).length;
    const over8 = complete.length - under8; // Sama dengan rumus Excel: selain < 8 jam masuk kelompok > 8 jam.
    const incomplete = entries.length - complete.length;
    const average = complete.length ? complete.reduce((sum, entry) => sum + entry.arrivalMinutes, 0) / complete.length : null;
    const underRate = complete.length ? under8 / complete.length : null;
    const overRate = complete.length ? over8 / complete.length : null;
    return {
      monthKey: reportMonth,
      monthName: MONTHS_ID[month - 1] || '—',
      year,
      total: entries.length,
      complete: complete.length,
      under8,
      over8,
      incomplete,
      underRate,
      overRate,
      averageMinutes: average,
      fileName,
      sourceSheet,
      generatedAt: new Date().toISOString(),
      entries
    };
  }

  function getRecords() {
    try { const records = JSON.parse(localStorage.getItem(SERVICE_KEY) || '{}'); return records && typeof records === 'object' && !Array.isArray(records) ? records : {}; }
    catch { return {}; }
  }
  function allEntries() {
    return Object.values(getRecords()).flatMap((list) => Array.isArray(list) ? list : []).filter((entry) => entry && entry.type === 'thorax' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
  }

  function ensureReportHost() {
    const panel = $('serviceImportPanel');
    if (!panel || $('serviceImportMonthly')) return;
    const heading = document.createElement('div'); heading.className = 'section-title import-report-heading';
    heading.innerHTML = '<div><h3>Rekap rata-rata waktu pelayanan</h3><p class="hint">Ringkasan data Thorax yang berhasil diimpor.</p></div>';
    const host = document.createElement('div'); host.id = 'serviceImportMonthly'; host.className = 'scroll'; panel.append(heading, host);
  }

  function persistImportedResult(result) {
    const records = getRecords();
    const known = new Set(allEntries().map((entry) => entry.importId).filter(Boolean));
    let added = 0;
    let duplicate = 0;

    result.valid.forEach((entry) => {
      if (known.has(entry.importId)) { duplicate += 1; return; }
      records[entry.date] = Array.isArray(records[entry.date]) ? records[entry.date] : [];
      records[entry.date].push(entry);
      known.add(entry.importId);
      added += 1;
    });

    try {
      localStorage.setItem(SERVICE_KEY, JSON.stringify(records));
      // Simpan laporan hasil upload langsung; tidak memerlukan tombol konfirmasi.
      localStorage.setItem(REPORT_KEY, JSON.stringify(result.report));
      renderMonthly();
      renderReport(result.report);
      renderReportActions(true);
      window.dispatchEvent(new CustomEvent('service-import-complete'));
      return { added, duplicate, saved: true };
    } catch (error) {
      return { added, duplicate, saved: false, error };
    }
  }

  function showPreview(result) {
    pendingEntries = result.valid;
    pendingReport = result.report;
    const previewRows = pendingEntries.slice(0, 10);
    $('serviceImportPreview').innerHTML = `
      <div class="service-import-summary"><strong>${pendingEntries.length.toLocaleString('id-ID')} data Thorax terdeteksi</strong><span>Sheet sumber: ${escapeHtml(result.sourceSheet)}</span><span>Data tidak lengkap: ${result.report.incomplete.toLocaleString('id-ID')}</span></div>
      <table><thead><tr><th>Tanggal acuan</th><th>Departemen</th><th>Selesai−Billing</th><th>Selesai−Kedatangan</th><th>Klasifikasi</th></tr></thead><tbody>${previewRows.map((entry) => `<tr><td>${entry.date}</td><td>${escapeHtml(entry.department || '—')}</td><td>${fmtDuration(entry.confirmationMinutes)}</td><td>${fmtDuration(entry.arrivalMinutes)}</td><td>${escapeHtml(entry.classification)}</td></tr>`).join('')}</tbody></table>
      ${pendingEntries.length > previewRows.length ? `<p class="hint">Menampilkan ${previewRows.length} dari ${pendingEntries.length} data Thorax.</p>` : ''}`;

    // Begitu file dipilih dan selesai dibaca, laporan langsung dibuat dan disimpan.
    const saved = persistImportedResult(result);
    if (saved.saved) {
      $('serviceImportStatus').textContent = `Laporan otomatis berhasil dibuat. ${saved.added} data baru disimpan; ${saved.duplicate} data duplikat dilewati. ${result.skipped} baris tanpa tanggal dilewati.${result.issues.length ? ` ${result.issues.join(' ')}` : ''} Durasi mengikuti nilai selisih pada Excel (komponen jam), bukan selisih tanggal.`;
      pendingEntries = [];
    } else {
      $('serviceImportStatus').textContent = 'Laporan berhasil dihitung dan ditampilkan, tetapi penyimpanan browser gagal. Periksa kapasitas penyimpanan lalu coba lagi.';
    }
  }

  async function readSelectedFile() {
    const file = $('serviceImportFile')?.files?.[0];
    if (!file) { $('serviceImportStatus').textContent = 'Pilih file Excel terlebih dahulu.'; return; }
    $('serviceImportStatus').textContent = 'File sedang dibaca dan dianalisis di browser…';
    $('serviceImportPreview').replaceChildren();
    $('serviceReportActions')?.setAttribute('hidden', ''); pendingEntries = []; pendingReport = null;
    $('serviceGeneratedReport').innerHTML = '<p class="empty-state">Sedang membuat laporan dari file Excel…</p>';
    try { showPreview(await parseFile(file)); }
    catch (error) { $('serviceImportStatus').textContent = error instanceof Error ? error.message : 'File gagal dibaca.'; }
  }


  function renderMonthly() {
    const host = $('serviceImportMonthly'); if (!host) return;
    const buckets = new Map();
    allEntries().forEach((entry) => {
      const month = entry.date.slice(0, 7);
      const value = buckets.get(month) || { count: 0, under8: 0, over8: 0, incomplete: 0, sum: 0, n: 0 };
      value.count += 1;
      if (Number.isFinite(entry.arrivalMinutes)) { value.n += 1; value.sum += entry.arrivalMinutes; if (entry.arrivalMinutes < 480) value.under8 += 1; else value.over8 += 1; }
      else value.incomplete += 1;
      buckets.set(month, value);
    });
    const rows = [...buckets.entries()].sort(([a], [b]) => b.localeCompare(a));
    host.innerHTML = rows.length ? `<table><thead><tr><th>Bulan acuan</th><th>Total Thorax</th><th>< 8 jam</th><th>≥ 8 jam</th><th>Data tidak lengkap</th><th>Rata-rata</th></tr></thead><tbody>${rows.map(([month, v]) => { const [y, m] = month.split('-').map(Number); return `<tr><th>${MONTHS_ID[m - 1]} ${y}</th><td>${v.count}</td><td>${v.under8}</td><td>${v.over8}</td><td>${v.incomplete}</td><td>${fmtDuration(v.n ? v.sum / v.n : NaN)}</td></tr>`; }).join('')}</tbody></table>` : '<p class="empty-state">Belum ada data waktu pelayanan Thorax.</p>';
  }

  function reportMarkup(report) {
    if (!report) return '<p class="empty-state">Upload Excel untuk membentuk laporan.</p>';
    const overPercent = fmtPercent(report.overRate);
    const avg = fmtDuration(report.averageMinutes);
    const reportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    return `<div class="thorax-report-preview" id="thoraxReportPrintable">
      <header>
        <strong>RUMAH SAKIT SETIA MITRA</strong>
        <strong>INSTALASI RADIOLOGI</strong>
        <h3>LAPORAN DAN EVALUASI WAKTU TUNGGU HASIL PELAYANAN FOTO THORAX</h3>
      </header>
      <table class="report-meta"><tbody><tr><td>Bulan : ${report.monthName} ${report.year}</td><td>Jumlah Foto Thorax dengan Data Tidak Lengkap (Waktu Kedatangan tidak tercatat)</td><td>${report.incomplete}</td></tr></tbody></table>
      <h4>I. &nbsp; Pemantauan</h4>
      <table><thead><tr><th>No</th><th>Variabel</th><th>Jumlah</th></tr></thead><tbody>
        <tr><td>1</td><td>Jumlah Foto Thorax dengan Waktu Tunggu &lt; 8 Jam</td><td>${report.under8}</td></tr>
        <tr><td>2</td><td>Jumlah Foto Thorax dengan Waktu Tunggu &gt; 8 Jam</td><td>${report.over8}</td></tr>
        <tr><td>3</td><td>Jumlah Total Foto Thorax Bulan ${report.monthName} ${report.year}</td><td>${report.complete}</td></tr>
        <tr><td>6</td><td>Prosentase Waktu Tunggu &lt; 8 Jam (dari Data Lengkap)</td><td>${fmtPercent(report.underRate)}</td></tr>
        <tr><td>7</td><td>Waktu Rata-rata Pelayanan Foto Thorax (Kedatangan-Selesai)</td><td>${avg}</td></tr>
      </tbody></table>
      <h4>II. &nbsp; Evaluasi</h4>
      <table class="report-narrative"><tbody>
        <tr><td>1.</td><td>Dari hasil pemantauan waktu tunggu pelayanan foto thorax bulan ${report.monthName} ${report.year} di Instalasi Radiologi RS Setia Mitra, didapatkan ${report.over8} pasien (${overPercent}) yang melebihi standar waktu tunggu maksimal 8 jam. Waktu rata-rata pelayanan foto thorax pada bulan ini adalah ${avg}.</td></tr>
        <tr><td>2.</td><td>Dari hasil rata-rata waktu pelayanan foto thorax ${avg}. Penyebab lamanya waktu tunggu pelayanan foto thorax pada bulan ini adalah keterbatasan ketersediaan dokter spesialis radiologi yang stand by di unit radiologi pada jam-jam tertentu.</td></tr>
      </tbody></table>
      <h4>III. &nbsp; Tindak Lanjut</h4>
      <p>Unit Radiologi akan melakukan evaluasi secara berkesinambungan serta berkoordinasi kembali dengan dokter spesialis radiologi dan pihak terkait dalam meningkatkan mutu waktu tunggu hasil pelayanan foto thorax di RS Setia Mitra.</p>
      <div class="report-sign"><p>Jakarta, ${reportDate}</p><p>Kepala Instalasi Radiologi</p><br><strong>Eni Indrawati, Dipl. Rad</strong></div>
      <p class="report-footnote">Sumber: ${escapeHtml(report.fileName || 'File Excel')} · Sheet: ${escapeHtml(report.sourceSheet || '—')}. Perhitungan durasi menggunakan nilai selisih waktu pada file sumber; tanggal tidak dijumlahkan dalam durasi.</p>
    </div>`;
  }

  function renderReport(report) {
    const host = $('serviceGeneratedReport'); if (host) host.innerHTML = reportMarkup(report);
    renderReportActions(Boolean(report));
  }
  function renderReportActions(show) {
    const actions = $('serviceReportActions'); if (actions) actions.hidden = !show;
  }

  function exportReportExcel() {
    const report = pendingReport || loadSavedReport();
    if (!report || !window.XLSX) { alert('Belum ada laporan yang dapat diekspor.'); return; }
    const rows = [
      [],
      ['', 'RUMAH SAKIT SETIA MITRA'],
      ['', 'INSTALASI RADIOLOGI'],
      [],
      ['', 'LAPORAN DAN EVALUASI WAKTU TUNGGU HASIL PELAYANAN FOTO THORAX'],
      [],
      ['', `Bulan : ${report.monthName} ${report.year}`, '', '', '', '', 'Jumlah Foto Thorax dengan Data Tidak Lengkap (Waktu Kedatangan tidak tercatat)', report.incomplete],
      [],
      ['', 'I.', 'Pemantauan'],
      ['', 'No', 'Variabel', 'Jumlah'],
      ['', 1, 'Jumlah Foto Thorax dengan Waktu Tunggu < 8 Jam', report.under8],
      ['', 2, 'Jumlah Foto Thorax dengan Waktu Tunggu > 8 Jam', report.over8],
      ['', 3, `Jumlah Total Foto Thorax Bulan ${report.monthName} ${report.year}`, report.complete],
      ['', 6, 'Prosentase Waktu Tunggu < 8 Jam (dari Data Lengkap)', report.underRate],
      ['', 7, 'Waktu Rata-rata Pelayanan Foto Thorax (Kedatangan-Selesai)', report.averageMinutes == null ? null : report.averageMinutes / 1440],
      [],
      ['', 'II.', 'Evaluasi'],
      ['', '1.', `Dari hasil pemantauan waktu tunggu pelayanan foto thorax bulan ${report.monthName} ${report.year} di Instalasi Radiologi RS Setia Mitra, didapatkan ${report.over8} pasien (${fmtPercent(report.overRate)}) yang melebihi standar waktu tunggu maksimal 8 jam. Waktu rata-rata pelayanan foto thorax pada bulan ini adalah ${fmtDuration(report.averageMinutes)}.`],
      ['', '2.', `Waktu rata-rata pelayanan foto thorax adalah ${fmtDuration(report.averageMinutes)}. Penyebab lamanya waktu tunggu perlu dievaluasi berdasarkan ketersediaan dokter spesialis radiologi, alur kerja, dan kondisi operasional unit radiologi.`],
      [],
      ['', 'III.', 'Tindak Lanjut'],
      ['', 'Unit Radiologi akan melakukan evaluasi secara berkesinambungan serta berkoordinasi kembali dengan dokter spesialis radiologi dan pihak terkait dalam meningkatkan mutu waktu tunggu hasil pelayanan foto thorax di RS Setia Mitra.'],
      [],
      ['', '', '', `Jakarta, ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`],
      ['', '', '', 'Kepala Instalasi Radiologi'],
      [],
      ['', '', '', 'Eni Indrawati, Dipl. Rad']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 7 }, { wch: 7 }, { wch: 76 }, { wch: 22 }, { wch: 7 }, { wch: 8 }, { wch: 64 }, { wch: 14 }];
    ws['!merges'] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } }, { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
      { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } }, { s: { r: 6, c: 1 }, e: { r: 6, c: 3 } },
      { s: { r: 8, c: 2 }, e: { r: 8, c: 3 } }, { s: { r: 16, c: 2 }, e: { r: 16, c: 3 } },
      { s: { r: 17, c: 2 }, e: { r: 17, c: 3 } }, { s: { r: 18, c: 2 }, e: { r: 18, c: 3 } },
      { s: { r: 20, c: 2 }, e: { r: 20, c: 3 } }, { s: { r: 21, c: 1 }, e: { r: 21, c: 3 } }
    ];
    if (ws.D14) ws.D14.z = '0.0%';
    if (ws.D15) ws.D15.z = '[h]:mm';
    const detailRows = [['Tanggal acuan', 'Departemen', 'Pemeriksaan', 'Selesai-Konfirmasi (menit)', 'Selesai-Kedatangan (menit)', 'Klasifikasi'], ...report.entries.map((e) => [e.date, e.department || '', e.examText, e.confirmationMinutes, e.arrivalMinutes, e.classification])];
    const detail = XLSX.utils.aoa_to_sheet(detailRows); detail['!cols'] = [{ wch: 15 }, { wch: 42 }, { wch: 35 }, { wch: 26 }, { wch: 26 }, { wch: 24 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'LAPORAN'); XLSX.utils.book_append_sheet(wb, detail, 'DATA THORAX');
    XLSX.writeFile(wb, `Laporan-Waktu-Tunggu-Thorax-${report.monthName}-${report.year}.xlsx`);
  }

  function loadSavedReport() {
    try { return JSON.parse(localStorage.getItem(REPORT_KEY) || 'null'); } catch { return null; }
  }
  function printReport() {
    const report = pendingReport || loadSavedReport();
    if (!report) { alert('Belum ada laporan yang dapat dicetak.'); return; }
    const area = $('printArea');
    area.innerHTML = `<section class="panel print-thorax-report">${reportMarkup(report)}</section>`;
    window.print();
  }

  function init() {
    if (!$('serviceImportPanel')) return;
    ensureReportHost();
    $('serviceImportFile')?.addEventListener('change', readSelectedFile);
    
    $('serviceExportReportExcel')?.addEventListener('click', exportReportExcel);
    $('servicePrintReport')?.addEventListener('click', printReport);
    renderMonthly();
    const saved = loadSavedReport();
    if (saved) renderReport(saved);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
