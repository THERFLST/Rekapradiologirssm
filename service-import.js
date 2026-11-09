(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const normalize = (value) => String(value ?? '').toLocaleLowerCase('id-ID').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()–—]/g, ' ').replace(/[\s\u00a0]+/g, ' ').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fmtNumber = (value) => Number(value || 0).toLocaleString('id-ID');
  const fmtDuration = (minutes) => {
    if (!Number.isFinite(minutes)) return '—';
    const sign = minutes < 0 ? '−' : '';
    const absolute = Math.floor(Math.abs(minutes));
    return `${sign}${Math.floor(absolute / 60)} jam ${String(absolute % 60).padStart(2, '0')} menit`;
  };
  const fmtDate = (date) => date ? date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const fmtTime = (date) => date ? date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—';
  const dateKey = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';

  function findColumn(headers, names) {
    const candidates = names.map(normalize);
    return headers.findIndex((header) => candidates.includes(normalize(header)));
  }

  function findHeaderRow(rows) {
    return rows.findIndex((row) => {
      const values = row.map(normalize);
      return values.some((v) => ['pemeriksaan', 'jenis pemeriksaan'].includes(v))
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

  function excelTimeMinutes(value) {
    if (value === '' || value == null) return null;
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getHours() * 60 + value.getMinutes() + value.getSeconds() / 60;
    if (typeof value === 'number' && Number.isFinite(value)) return value * 1440;
    const match = String(value).trim().match(/^(-?\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (match) return Math.sign(Number(match[1])) * (Math.abs(Number(match[1])) * 60 + Number(match[2]) + Number(match[3] || 0) / 60);
    return null;
  }

  function timeOfDayMinutes(value) {
    const date = excelDate(value);
    return date ? date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 : null;
  }

  function parseSheet(rows, sheetName) {
    const headerRow = findHeaderRow(rows);
    if (headerRow < 0) return null;
    const headers = rows[headerRow];
    const col = {
      number: findColumn(headers, ['No', 'Nomor']),
      patient: findColumn(headers, ['Nama Pasien', 'Nama', 'Pasien', 'Nama Lengkap']),
      department: findColumn(headers, ['Departemen', 'Asal Pasien', 'Poliklinik']),
      exam: findColumn(headers, ['Pemeriksaan', 'Jenis Pemeriksaan']),
      registration: findColumn(headers, ['Waktu Registrasi', 'Tanggal Registrasi']),
      billing: findColumn(headers, ['Konfirmasi Billing', 'Waktu Konfirmasi Billing']),
      arrival: findColumn(headers, ['Waktu Kedatangan', 'Tanggal Kedatangan']),
      completion: findColumn(headers, ['Waktu Selesai', 'Tanggal Selesai']),
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
        patient: col.patient >= 0 ? String(row[col.patient] ?? '').trim() : '',
        department: col.department >= 0 ? String(row[col.department] ?? '').trim() : '',
        exam, isThorax, registrationDate, billingDate, arrivalDate, completionDate,
        billingMinutes, arrivalMinutes, status, sheetName
      });
    });
    return { sheetName, records };
  }

  // PDF text is reconstructed into rows using PDF.js item coordinates. Column positions
  // are inferred from the header, so tabular text PDFs can be imported without OCR.
  async function readPdfRows(file) {
    if (!window.pdfjsLib) throw new Error('Pemroses PDF belum siap. Muat ulang halaman dan coba kembali.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const buffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
    const allRows = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => item.str && item.str.trim()).map((item) => ({
        text: item.str.trim(), x: item.transform[4], y: item.transform[5]
      })).sort((a, b) => b.y - a.y || a.x - b.x);
      const lines = [];
      items.forEach((item) => {
        let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
        if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
        line.items.push(item);
      });
      lines.sort((a, b) => b.y - a.y).forEach((line) => {
        line.items.sort((a, b) => a.x - b.x);
        const cells = [];
        line.items.forEach((item) => {
          const previous = cells[cells.length - 1];
          const gap = previous ? item.x - previous.right : Infinity;
          if (previous && gap <= 5) { previous.text += ` ${item.text}`; previous.right = Math.max(previous.right, item.x + item.text.length * 2); }
          else cells.push({ text: item.text, right: item.x + item.text.length * 2 });
        });
        allRows.push(cells.map((cell) => cell.text));
      });
    }
    return allRows;
  }

  function buildReportFromRows(rows, fileName) {
    const parsed = parseSheet(rows, fileName);
    if (!parsed || !parsed.records.length) throw new Error('Format PDF belum dikenali. Pastikan PDF berisi tabel dengan kolom Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai. PDF hasil scan/foto belum didukung.');
    return finalizeReport([{ sheetName: fileName, records: parsed.records }], [fileName]);
  }

  function finalizeReport(parsedSheets, sheetNames) {
    const allRecords = parsedSheets.flatMap((sheet) => sheet.records);
    if (!allRecords.length) throw new Error('Tidak ditemukan baris data pemeriksaan pada file.');
    const thoraxRecords = allRecords.filter((record) => record.isThorax);
    if (!thoraxRecords.length) throw new Error('Data berhasil dibaca, tetapi tidak ditemukan baris pemeriksaan Thorax untuk laporan waktu pelayanan.');
    const complete = thoraxRecords.filter((record) => record.status !== 'Data Tidak Lengkap' && Number.isFinite(record.arrivalMinutes));
    const under = complete.filter((record) => record.arrivalMinutes < 480).length;
    const over = complete.length - under;
    const incomplete = thoraxRecords.length - complete.length;
    const average = complete.length ? complete.reduce((sum, record) => sum + record.arrivalMinutes, 0) / complete.length : NaN;
    return { records: thoraxRecords, allRecords, complete, under, over, incomplete, average,
      percent: complete.length ? under / complete.length : 0,
      overPercent: complete.length ? over / complete.length : 0,
      sourceRows: allRecords.length, sheetNames, fileName: sheetNames.join(', ') };
  }

  function buildReport(workbook) {
    const parsedSheets = workbook.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
      return parseSheet(rows, name);
    }).filter(Boolean);
    if (!parsedSheets.length) throw new Error('Format Excel belum dikenali. Pastikan terdapat header Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai.');
    return finalizeReport(parsedSheets, workbook.SheetNames);
  }

  function filterPeriod(report) {
    const start = $('serviceStartDate')?.value || '';
    const end = $('serviceEndDate')?.value || '';
    if (start && end && start > end) throw new Error('Tanggal mulai tidak boleh melewati tanggal akhir.');
    const inRange = (record) => {
      const date = record.arrivalDate || record.registrationDate || record.completionDate;
      const key = dateKey(date);
      return (!start || (key && key >= start)) && (!end || (key && key <= end));
    };
    const allRecords = report.allRecords.filter(inRange);
    const records = allRecords.filter((record) => record.isThorax);
    if (!allRecords.length) throw new Error('Tidak ada data pemeriksaan pada rentang tanggal yang dipilih.');
    const complete = records.filter((record) => record.status !== 'Data Tidak Lengkap' && Number.isFinite(record.arrivalMinutes));
    const under = complete.filter((record) => record.arrivalMinutes < 480).length;
    const over = complete.length - under;
    return { ...report, allRecords, records, complete, under, over, incomplete: records.length - complete.length,
      average: complete.length ? complete.reduce((sum, record) => sum + record.arrivalMinutes, 0) / complete.length : NaN,
      percent: complete.length ? under / complete.length : 0,
      overPercent: complete.length ? over / complete.length : 0,
      rangeLabel: `${start ? fmtDate(new Date(`${start}T00:00:00`)) : 'Awal data'} – ${end ? fmtDate(new Date(`${end}T00:00:00`)) : 'Akhir data'}` };
  }

  function summaryRows(report) {
    const map = new Map();
    report.allRecords.forEach((record) => {
      const key = record.exam || 'Tidak diketahui';
      if (!map.has(key)) map.set(key, { exam: key, total: 0, under: 0, over: 0, incomplete: 0 });
      const item = map.get(key); item.total += 1;
      if (record.status === 'Kurang dari 8 Jam') item.under += 1;
      else if (record.status === 'Lebih dari 8 Jam') item.over += 1;
      else item.incomplete += 1;
    });
    return [...map.values()].sort((a, b) => a.exam.localeCompare(b.exam, 'id'));
  }

  function renderReport(report, fileName) {
    const target = $('serviceReportContent');
    const result = $('serviceReportResult');
    const evaluation = `Dari hasil pemantauan waktu tunggu pelayanan foto thorax di Instalasi Radiologi RS Setia Mitra pada periode ${escapeHtml(report.rangeLabel)}, terdapat ${fmtNumber(report.over)} pasien (${(report.overPercent * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%) yang mencapai atau melebihi standar waktu tunggu 8 jam. Waktu rata-rata pelayanan foto thorax adalah ${fmtDuration(report.average)}.`;
    const dataRows = report.allRecords.map((record, index) => {
      const date = record.arrivalDate || record.registrationDate || record.completionDate;
      const statusClass = record.status === 'Kurang dari 8 Jam' ? 'is-under' : record.status === 'Lebih dari 8 Jam' ? 'is-over' : 'is-incomplete';
      return `<tr><td>${index + 1}</td><td>${escapeHtml(record.patient || '—')}</td><td>${fmtDate(date)}</td><td>${escapeHtml(record.department || '—')}</td><td>${escapeHtml(record.exam)}</td><td>${fmtTime(record.arrivalDate)}</td><td>${fmtTime(record.completionDate)}</td><td>${fmtDuration(record.arrivalMinutes)}</td><td><span class="service-status ${statusClass}">${escapeHtml(record.status)}</span></td></tr>`;
    }).join('');
    const recapRows = summaryRows(report).map((item) => `<tr><td>${escapeHtml(item.exam)}</td><td>${fmtNumber(item.total)}</td><td>${fmtNumber(item.under)}</td><td>${fmtNumber(item.over)}</td><td>${fmtNumber(item.incomplete)}</td></tr>`).join('');

    target.innerHTML = `
      <div class="service-report-toolbar"><div><p class="eyebrow">Hasil pembacaan otomatis</p><h3>${escapeHtml(fileName)}</h3><p class="muted">Sheet terbaca: ${report.sheetNames.map(escapeHtml).join(', ')}</p></div><span class="service-read-count">${fmtNumber(report.allRecords.length)} data pemeriksaan</span></div>
      <article id="serviceMainReport" class="service-formal-report">
        <header class="service-formal-heading"><strong>RUMAH SAKIT SETIA MITRA</strong><strong>INSTALASI RADIOLOGI</strong><h3>LAPORAN DAN EVALUASI WAKTU TUNGGU HASIL PELAYANAN FOTO THORAX</h3><p>Periode: ${escapeHtml(report.rangeLabel)}</p></header>
        <section class="service-report-section"><h4>I. Pemantauan</h4><div class="service-stat-grid">
          <div><span>Waktu tunggu kurang dari 8 jam</span><strong>${fmtNumber(report.under)}</strong></div>
          <div><span>Waktu tunggu 8 jam atau lebih</span><strong>${fmtNumber(report.over)}</strong></div>
          <div><span>Jumlah total foto Thorax</span><strong>${fmtNumber(report.records.length)}</strong></div>
          <div><span>Data Thorax tidak lengkap</span><strong>${fmtNumber(report.incomplete)}</strong></div>
          <div><span>Persentase waktu tunggu kurang dari 8 jam (data lengkap)</span><strong>${(report.percent * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong></div>
          <div><span>Waktu rata-rata pelayanan (kedatangan–selesai)</span><strong>${fmtDuration(report.average)}</strong></div>
        </div></section>
        <section class="service-report-section"><h4>II. Evaluasi</h4><p>${evaluation}</p><p>Hasil pemantauan menjadi bahan evaluasi alur pelayanan, ketersediaan dokter spesialis radiologi, serta faktor operasional yang dapat memengaruhi waktu penyelesaian hasil pemeriksaan.</p></section>
        <section class="service-report-section"><h4>III. Tindak Lanjut</h4><p>Instalasi Radiologi melakukan evaluasi secara berkesinambungan serta berkoordinasi dengan dokter spesialis radiologi dan pihak terkait untuk meningkatkan mutu waktu tunggu hasil pelayanan.</p></section>
      </article>
      <section id="serviceRecapSection" class="service-data-section"><div class="service-data-heading"><h3>Rekapitulasi seluruh jenis pemeriksaan</h3><p class="muted">Rekap jumlah dan status waktu pelayanan berdasarkan jenis pemeriksaan.</p></div>
        <div class="service-table-wrap"><table class="service-data-table"><thead><tr><th>Jenis Pemeriksaan</th><th>Total</th><th>&lt; 8 Jam</th><th>≥ 8 Jam</th><th>Tidak Lengkap</th></tr></thead><tbody>${recapRows}</tbody></table></div></section>
      <section id="serviceAllDataSection" class="service-data-section"><div class="service-data-heading"><h3>Data Keseluruhan</h3><p class="muted">${fmtNumber(report.allRecords.length)} data pemeriksaan; nama pasien ditampilkan sesuai file sumber.</p></div>
        <div class="service-table-wrap"><table class="service-data-table"><thead><tr><th>No</th><th>Nama Pasien</th><th>Tanggal</th><th>Departemen</th><th>Pemeriksaan</th><th>Waktu Kedatangan</th><th>Waktu Selesai</th><th>Durasi</th><th>Keterangan</th></tr></thead><tbody>${dataRows}</tbody></table></div></section>
      <p class="service-data-footnote">Total data yang berhasil dibaca: ${fmtNumber(report.allRecords.length)} baris dari ${report.sheetNames.length} sheet.</p>`;
    result.hidden = false;
    $('serviceDownloadPdf').disabled = false;
  }

  function applyAndRender() {
    const holder = $('serviceCurrentReport');
    if (!holder?._report) return;
    try {
      const report = filterPeriod(holder._report);
      renderReport(report, holder._fileName);
      $('serviceImportStatus').textContent = `Laporan diperbarui. ${fmtNumber(report.allRecords.length)} data sesuai periode ${report.rangeLabel}.`;
    } catch (error) { $('serviceImportStatus').textContent = error.message; }
  }

  async function handleFile(file) {
    const status = $('serviceImportStatus');
    const result = $('serviceReportResult');
    if (!file) return;
    result.hidden = true; $('serviceReportContent').replaceChildren(); $('serviceDownloadPdf').disabled = true;
    $('serviceCurrentReport')._report = null;
    status.textContent = `Membaca seluruh isi ${file.name}…`;
    try {
      let report;
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        const rows = await readPdfRows(file);
        report = buildReportFromRows(rows, file.name);
      } else {
        if (!window.XLSX) throw new Error('Pemroses Excel belum siap. Muat ulang halaman dan coba kembali.');
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellNF: false, cellText: false });
        report = buildReport(workbook);
      }
      $('serviceCurrentReport')._report = report;
      $('serviceCurrentReport')._fileName = file.name;
      const filtered = filterPeriod(report);
      renderReport(filtered, file.name);
      status.textContent = `Selesai. ${fmtNumber(filtered.allRecords.length)} data pemeriksaan berhasil dibaca dan laporan dibuat otomatis.`;
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'File gagal dibaca. Periksa format file.';
      result.hidden = true;
    }
  }

  function downloadPdf() {
    const report = $('serviceCurrentReport')?._report;
    const fileName = $('serviceCurrentReport')?._fileName || 'laporan-waktu-pelayanan';
    if (!report) return;
    if (!window.jspdf?.jsPDF) { $('serviceImportStatus').textContent = 'Generator PDF belum siap. Muat ulang halaman dan coba kembali.'; return; }
    let filtered;
    try { filtered = filterPeriod(report); } catch (error) { $('serviceImportStatus').textContent = error.message; return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text('RUMAH SAKIT SETIA MITRA', 148, 16, { align: 'center' });
    doc.setFontSize(11); doc.text('INSTALASI RADIOLOGI', 148, 22, { align: 'center' });
    doc.setFontSize(13); doc.text('LAPORAN WAKTU TUNGGU HASIL PELAYANAN FOTO THORAX', 148, 31, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Periode: ${filtered.rangeLabel}`, margin, 41);
    doc.autoTable({ startY: 47, head: [['Indikator', 'Hasil']], body: [['Jumlah foto Thorax < 8 jam', fmtNumber(filtered.under)], ['Jumlah foto Thorax ≥ 8 jam', fmtNumber(filtered.over)], ['Total foto Thorax', fmtNumber(filtered.records.length)], ['Data tidak lengkap', fmtNumber(filtered.incomplete)], ['Persentase < 8 jam (data lengkap)', `${(filtered.percent * 100).toFixed(1)}%`], ['Rata-rata waktu pelayanan', fmtDuration(filtered.average)]], theme: 'grid', styles: { fontSize: 9, cellPadding: 2.5 }, headStyles: { fillColor: [31, 79, 91] } });
    let y = (doc.lastAutoTable?.finalY || 90) + 9;
    doc.setFont('helvetica', 'bold'); doc.text('Evaluasi', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    const evaluation = `Pada periode ${filtered.rangeLabel}, terdapat ${filtered.over} pasien (${(filtered.overPercent * 100).toFixed(1)}%) yang mencapai atau melebihi standar waktu tunggu 8 jam. Rata-rata waktu pelayanan foto Thorax adalah ${fmtDuration(filtered.average)}. Hasil ini menjadi bahan evaluasi alur pelayanan, ketersediaan dokter spesialis radiologi, dan faktor operasional.`;
    const lines = doc.splitTextToSize(evaluation, 268); doc.text(lines, margin, y); y += lines.length * 5 + 5;
    doc.setFont('helvetica', 'bold'); doc.text('Tindak Lanjut', margin, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize('Instalasi Radiologi melakukan evaluasi berkesinambungan serta berkoordinasi dengan dokter spesialis radiologi dan pihak terkait untuk meningkatkan mutu waktu tunggu hasil pelayanan.', 268), margin, y);

    // Required PDF order: main report -> recap -> complete examination data.
    doc.addPage('a4', 'landscape');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('REKAPITULASI PEMERIKSAAN', margin, 16);
    doc.autoTable({ startY: 22, head: [['Jenis Pemeriksaan', 'Total', '< 8 Jam', '≥ 8 Jam', 'Tidak Lengkap']], body: summaryRows(filtered).map((item) => [item.exam, item.total, item.under, item.over, item.incomplete]), theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [31, 79, 91] } });

    doc.addPage('a4', 'landscape');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('SELURUH DATA PEMERIKSAAN', margin, 16);
    doc.autoTable({ startY: 22, head: [['No', 'Nama Pasien', 'Tanggal', 'Departemen', 'Pemeriksaan', 'Kedatangan', 'Selesai', 'Durasi', 'Keterangan']], body: filtered.allRecords.map((record, index) => [index + 1, record.patient || '—', fmtDate(record.arrivalDate || record.registrationDate || record.completionDate), record.department || '—', record.exam, fmtTime(record.arrivalDate), fmtTime(record.completionDate), fmtDuration(record.arrivalMinutes), record.status]), theme: 'grid', styles: { fontSize: 6.5, cellPadding: 1.5, overflow: 'linebreak' }, headStyles: { fillColor: [31, 79, 91] }, didDrawPage: () => { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(`Periode ${filtered.rangeLabel}`, margin, 200); } });
    const safeName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_');
    doc.save(`Laporan_Waktu_Pelayanan_${safeName}.pdf`);
  }


  function init() {
    const input = $('serviceImportFile');
    if (!input) return;
    input.addEventListener('change', () => handleFile(input.files?.[0]));
    $('serviceStartDate').addEventListener('change', applyAndRender);
    $('serviceEndDate').addEventListener('change', applyAndRender);
    $('serviceDownloadPdf').addEventListener('click', downloadPdf);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
