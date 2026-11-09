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
  const fmtDateTime = (date) => date ? `${fmtDate(date)} ${fmtTime(date)}` : '—';
  const dateKey = (date) => date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : '';

  // Cari kolom secara persis dulu. Pencocokan sebagian hanya untuk frasa multi-kata,
  // supaya kata tunggal seperti "Registrasi" tidak salah mengenali kolom "No Registrasi".
  function findColumn(headers, names) {
    const candidates = names.map(normalize);
    const values = headers.map(normalize);
    for (const candidate of candidates) {
      const index = values.indexOf(candidate);
      if (index >= 0) return index;
    }
    // Pencocokan sebagian untuk nama kolom yang lebih panjang (mis. "Pemeriksaan Radiologi"),
    // kecuali kolom nomor seperti "No Registrasi" agar tidak salah dikenali sebagai tanggal.
    return values.findIndex((value) => !/^no\b/.test(value) && candidates.some((candidate) => candidate.length >= 9 && value.includes(candidate)));
  }

  function findHeaderRow(rows) {
    return rows.findIndex((row) => {
      const values = row.map(normalize).filter(Boolean);
      const hasExam = values.some((v) => /pemeriksaan/.test(v));
      const hasArrival = values.some((v) => /waktu kedatangan|tanggal kedatangan|jam kedatangan/.test(v));
      const hasCompletion = values.some((v) => /waktu selesai|tanggal selesai|jam selesai/.test(v));
      return hasExam && hasArrival && hasCompletion;
    });
  }

  function excelDate(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value === 'number' && window.XLSX?.SSF) {
      if (value < 20000 || value > 80000) return null;
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0));
    }
    const text = String(value ?? '').trim();
    if (!text) return null;
    // Format sumber: 8/28/2026 (bulan/hari/tahun) dan 27-08-2026 (hari-bulan-tahun).
    const parts = text.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (parts) {
      const [, first, separator, second, year, hour = '0', minute = '0', second2 = '0'] = parts;
      let day = +first, month = +second;
      if (separator === '/') {
        if (+first > 12) { day = +first; month = +second; }
        else { month = +first; day = +second; }
      }
      const result = new Date(+year, month - 1, day, +hour, +minute, +second2);
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
      medicalRecord: findColumn(headers, ['No RM', 'Nomor RM', 'No. RM', 'Rekam Medis']),
      patient: findColumn(headers, ['Nama Pasien', 'Nama Lengkap', 'Nama']),
      registrationNumber: findColumn(headers, ['No Registrasi', 'No. Registrasi', 'Nomor Registrasi']),
      department: findColumn(headers, ['Departemen', 'Asal Pasien', 'Poliklinik', 'Unit Asal']),
      exam: findColumn(headers, ['Jenis Pemeriksaan', 'Nama Pemeriksaan', 'Pemeriksaan']),
      registration: findColumn(headers, ['Waktu Registrasi', 'Tanggal Registrasi', 'Registrasi']),
      inputDate: findColumn(headers, ['Waktu Input', 'Tanggal Input']),
      billing: findColumn(headers, ['Konfirmasi Billing', 'Waktu Konfirmasi Billing', 'Tanggal Billing']),
      arrival: findColumn(headers, ['Waktu Kedatangan', 'Tanggal Kedatangan', 'Jam Kedatangan']),
      completion: findColumn(headers, ['Waktu Selesai', 'Tanggal Selesai', 'Jam Selesai']),
      billingDiff: findColumn(headers, ['Selisih Waktu (Selesai-Konfirmasi)', 'Selisih Waktu Selesai-Konfirmasi']),
      arrivalDiff: findColumn(headers, ['Selisih Waktu (Selesai-Kedatangan)', 'Selisih Waktu Selesai-Kedatangan']),
      category: findColumn(headers, ['Keterangan Waktu Tunggu (Kedatangan-Selesai)', 'Keterangan Waktu Tunggu'])
    };
    const records = [];
    let previousExam = '';
    let previousDepartment = '';
    rows.slice(headerRow + 1).forEach((row, index) => {
      if (!row.some((cell) => String(cell ?? '').trim() !== '')) return;
      // Some Excel exports use vertically merged cells. Carry the examination/group
      // label forward so patient rows are not silently discarded.
      let exam = String(row[col.exam] ?? '').trim();
      if (/^(pemeriksaan|jenis pemeriksaan|nama pemeriksaan)$/i.test(normalize(exam))) return;
      if (exam) previousExam = exam; else exam = previousExam;
      let department = col.department >= 0 ? String(row[col.department] ?? '').trim() : '';
      if (department) previousDepartment = department; else department = previousDepartment;
      const patientValue = col.patient >= 0 ? String(row[col.patient] ?? '').trim() : '';
      const medicalRecord = col.medicalRecord >= 0 ? String(row[col.medicalRecord] ?? '').trim() : '';
      const registrationNumber = col.registrationNumber >= 0 ? String(row[col.registrationNumber] ?? '').trim() : '';
      const arrivalDate = col.arrival >= 0 ? excelDate(row[col.arrival]) : null;
      const registrationDate = col.registration >= 0 ? excelDate(row[col.registration]) : null;
      const inputDate = col.inputDate >= 0 ? excelDate(row[col.inputDate]) : null;
      const completionDate = col.completion >= 0 ? excelDate(row[col.completion]) : null;
      const billingDate = col.billing >= 0 ? excelDate(row[col.billing]) : null;
      let billingMinutes = col.billingDiff >= 0 ? excelTimeMinutes(row[col.billingDiff]) : null;
      let arrivalMinutes = col.arrivalDiff >= 0 ? excelTimeMinutes(row[col.arrivalDiff]) : null;
      if (billingMinutes == null && completionDate && billingDate) billingMinutes = timeOfDayMinutes(completionDate) - timeOfDayMinutes(billingDate);
      if (arrivalMinutes == null && completionDate && arrivalDate) arrivalMinutes = timeOfDayMinutes(completionDate) - timeOfDayMinutes(arrivalDate);
      const categoryText = col.category >= 0 ? String(row[col.category] ?? '').trim() : '';
      // Keep every patient/examination row with useful source data, even if one
      // optional field is blank; this prevents partial exports in the PDF.
      if (!exam && !patientValue && !arrivalDate && !completionDate && !registrationDate) return;
      const isThorax = /thorax/i.test(exam);
      const status = /data tidak lengkap/i.test(categoryText) || !arrivalDate || arrivalMinutes == null
        ? 'Data Tidak Lengkap'
        : /kurang dari 8 jam/i.test(categoryText) ? 'Kurang dari 8 Jam'
          : /lebih dari 8 jam/i.test(categoryText) ? 'Lebih dari 8 Jam'
            : arrivalMinutes < 480 ? 'Kurang dari 8 Jam' : 'Lebih dari 8 Jam';
      records.push({
        rowNumber: headerRow + index + 2,
        number: col.number >= 0 ? row[col.number] : records.length + 1,
        patient: patientValue, medicalRecord, registrationNumber,
        department,
        exam, isThorax, registrationDate, inputDate, billingDate, arrivalDate, completionDate,
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
        text: item.str.trim(), x: item.transform[4], y: item.transform[5],
        right: item.transform[4] + (item.width || item.str.trim().length * 2)
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
          if (previous && gap <= 5) { previous.text += ` ${item.text}`; previous.right = Math.max(previous.right, item.right); }
          else cells.push({ text: item.text, right: item.right });
        });
        allRows.push(cells.map((cell) => cell.text));
      });
    }
    return allRows;
  }

  // Membaca setiap baris PDF berdasarkan pola isinya (lima tanggal-jam, dua durasi, keterangan),
  // bukan posisi kolom. Ini tahan terhadap header yang terpotong dan kolom No yang menyatu dengan No. RM.
  const DATETIME_RE = /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?|\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?/g;
  const RECORD_START_RE = /^\d{1,4}\s+(?:\d{2}-\d{2}-\d{2}(?:-\d{2})?\s+)?.*\b\d{10}\b/;

  // Satu baris data PDF -> satu record. Mengembalikan null bila pola tidak lengkap.
  function parsePdfRecordLine(line, number) {
    const dateMatches = [...line.matchAll(DATETIME_RE)];
    if (dateMatches.length < 2) return null;
    const head = line.slice(0, dateMatches[0].index).trim();
    const regMatch = head.match(/\b(\d{10})\b/);
    if (!regMatch) return null;
    const left = head.slice(0, regMatch.index).trim();
    const afterReg = head.slice(regMatch.index + regMatch[0].length).trim();
    const numberMatch = left.match(/^(\d{1,4})\s+/);
    const withoutNumber = numberMatch ? left.slice(numberMatch[0].length) : left;
    const rmMatch = withoutNumber.match(/^(\d{2}-\d{2}-\d{2}(?:-\d{2})?)\s+/);
    const medicalRecord = rmMatch ? rmMatch[1] : '';
    const patient = rmMatch ? withoutNumber.slice(rmMatch[0].length).trim() : withoutNumber;
    const examIndex = afterReg.search(/-?\s*Thorax/i);
    const department = examIndex >= 0 ? afterReg.slice(0, examIndex).trim() : afterReg;
    const exam = examIndex >= 0 ? afterReg.slice(examIndex).replace(/^-\s*/, '').trim() : 'Thorax';
    const dates = dateMatches.slice(0, 5).map((m) => excelDate(m[0]));
    const [registrationDate, inputDate, billingDate, arrivalDate, completionDate] = [0, 1, 2, 3, 4].map((i) => dates[i] || null);
    const tail = line.slice(dateMatches[Math.min(4, dateMatches.length - 1)].index + dateMatches[Math.min(4, dateMatches.length - 1)][0].length);
    const durations = [...tail.matchAll(/\d{1,3}:\d{2}:\d{2}/g)].map((m) => excelTimeMinutes(m[0]));
    const billingMinutes = durations[0] ?? null;
    const arrivalMinutes = durations[1] ?? null;
    const categoryText = (tail.match(/Kurang dari 8 Jam|Lebih dari 8 Jam|Data Tidak Lengkap/i) || [''])[0];
    const status = /data tidak lengkap/i.test(categoryText) || !arrivalDate || arrivalMinutes == null
      ? 'Data Tidak Lengkap'
      : /kurang dari 8 jam/i.test(categoryText) ? 'Kurang dari 8 Jam'
        : /lebih dari 8 jam/i.test(categoryText) ? 'Lebih dari 8 Jam'
          : arrivalMinutes < 480 ? 'Kurang dari 8 Jam' : 'Lebih dari 8 Jam';
    return {
      number, patient, medicalRecord, registrationNumber: regMatch[1],
      department, exam, isThorax: /thorax/i.test(exam), registrationDate, inputDate, billingDate,
      arrivalDate, completionDate, billingMinutes, arrivalMinutes, status, sheetName: 'PDF'
    };
  }

  // Menggabungkan baris PDF yang terpotong (nama/departemen panjang) lalu membaca setiap record.
  // Baris yang tampak seperti data tetapi tidak bisa dibaca dihitung agar tidak terlewat diam-diam.
  function parsePdfTextRows(rows) {
    const lines = rows.map((cells) => cells.map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' ')).filter(Boolean);
    const groups = [];
    lines.forEach((line) => {
      if (RECORD_START_RE.test(line)) { groups.push(line); return; }
      const last = groups.length ? groups[groups.length - 1] : null;
      const lastIsOpen = last && RECORD_START_RE.test(last) && [...last.matchAll(DATETIME_RE)].length < 5;
      if (lastIsOpen) groups[groups.length - 1] = `${last} ${line}`;
    });
    const records = [];
    let unparsed = 0;
    groups.forEach((line) => {
      const number = records.length + unparsed + 1;
      const record = RECORD_START_RE.test(line) ? parsePdfRecordLine(line, Number(line.match(/^\d+/)[0])) : null;
      if (record) records.push({ ...record, rowNumber: number });
      else unparsed += 1;
    });
    return { records, unparsed };
  }

  function buildReportFromRows(rows, fileName) {
    let { records, unparsed } = parsePdfTextRows(rows);
    if (!records.length) {
      const parsed = parseSheet(rows, fileName);
      records = parsed ? parsed.records : [];
      unparsed = 0;
    }
    if (!records.length) throw new Error('Format PDF belum dikenali. Pastikan PDF berisi tabel data pemeriksaan dengan kolom Waktu Registrasi, Waktu Kedatangan, dan Waktu Selesai. PDF hasil scan/foto belum didukung.');
    const report = finalizeReport([{ sheetName: fileName, records }], [fileName]);
    report.unparsedRows = unparsed;
    return report;
  }

  function finalizeReport(parsedSheets, sheetNames) {
    const allRecords = parsedSheets.flatMap((sheet) => sheet.records);
    if (!allRecords.length) throw new Error('Tidak ditemukan baris data pemeriksaan pada file.');
    const thoraxRecords = allRecords.filter((record) => record.isThorax);
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
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false, range: workbook.Sheets[name]['!ref'] || undefined });
      return parseSheet(rows, name);
    }).filter((sheet) => sheet && sheet.records.length > 0);
    if (!parsedSheets.length) throw new Error('Format Excel belum dikenali. Pastikan terdapat header Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai.');
    return finalizeReport(parsedSheets, workbook.SheetNames);
  }

  // Bulan yang ada di file (berdasarkan tanggal registrasi, atau tanggal lain bila kosong), urut terbanyak.
  function monthsInRecords(records) {
    const counts = new Map();
    records.forEach((record) => {
      const reference = record.registrationDate || record.arrivalDate || record.completionDate;
      if (!reference) return;
      const key = dateKey(reference).slice(0, 7);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => {
      const [year, month] = key.split('-').map(Number);
      return { key, count, label: `${MONTHS[month - 1]} ${year}` };
    });
  }

  function filterPeriod(report) {
    const period = $('servicePeriod')?.value || '';
    if (period && !/^\d{4}-\d{2}$/.test(period)) throw new Error('Pilih periode bulan dan tahun yang valid.');
    // Periode laporan mengikuti tanggal registrasi/order, bukan tanggal selesai.
    // Pada data RS, pemeriksaan yang diregistrasi di akhir bulan dapat selesai
    // pada bulan berikutnya; memakai tanggal kedatangan/selesai lebih dahulu
    // membuat banyak baris sah terbuang dari laporan bulan asalnya.
    const inPeriod = (record) => {
      if (!period) return true;
      const referenceDate = record.registrationDate || record.arrivalDate || record.completionDate;
      return Boolean(referenceDate && dateKey(referenceDate).slice(0, 7) === period);
    };
    const allRecords = report.allRecords.filter(inPeriod);
    const records = allRecords.filter((record) => record.isThorax);
    if (!allRecords.length) {
      const months = monthsInRecords(report.allRecords);
      const undated = report.allRecords.filter((record) => !record.registrationDate && !record.arrivalDate && !record.completionDate).length;
      let message = `Tidak ada data pemeriksaan pada periode ${period ? `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}` : 'yang dipilih'}.`;
      if (months.length) message += ` Data dalam file ada pada: ${months.map((m) => `${m.label} (${fmtNumber(m.count)} baris)`).join(', ')}. Pilih periode tersebut.`;
      if (undated) message += ` ${fmtNumber(undated)} baris tidak memiliki tanggal yang terbaca. Jika file berisi rumus, buka file di Excel, simpan ulang agar nilai rumus tersimpan, lalu unggah ulang.`;
      throw new Error(message);
    }
    const complete = records.filter((record) => record.status !== 'Data Tidak Lengkap' && Number.isFinite(record.arrivalMinutes));
    const under = complete.filter((record) => record.arrivalMinutes < 480).length;
    const over = complete.length - under;
    const [year, month] = period ? period.split('-').map(Number) : [];
    const rangeLabel = period ? `${MONTHS[month - 1]} ${year}` : 'Seluruh periode data';
    return { ...report, allRecords, records, complete, under, over, incomplete: records.length - complete.length,
      average: complete.length ? complete.reduce((sum, record) => sum + record.arrivalMinutes, 0) / complete.length : NaN,
      percent: complete.length ? under / complete.length : 0,
      overPercent: complete.length ? over / complete.length : 0,
      rangeLabel, periodKey: period };
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
      // Jika periode belum dipilih, pakai bulan terbanyak yang ada di file.
      const periodInput = $('servicePeriod');
      if (!periodInput.value) {
        const months = monthsInRecords(report.allRecords);
        if (months.length) periodInput.value = months[0].key;
      }
      const filtered = filterPeriod(report);
      renderReport(filtered, file.name);
      const unparsedNote = report.unparsedRows ? ` Peringatan: ${fmtNumber(report.unparsedRows)} baris tampak seperti data tetapi tidak terbaca; periksa file sumber.` : '';
      status.textContent = `Selesai. ${fmtNumber(filtered.allRecords.length)} data pemeriksaan berhasil dibaca dan laporan dibuat otomatis.${unparsedNote}`;
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'File gagal dibaca. Periksa format file.';
      result.hidden = true;
    }
  }

  function downloadPdf() {
    const report = $('serviceCurrentReport')?._report;
    const fileName = $('serviceCurrentReport')?._fileName || 'laporan-waktu-pelayanan';
    const status = $('serviceImportStatus');
    if (!report) { status.textContent = 'Unggah file Excel atau PDF terlebih dahulu.'; return; }
    if (!$('servicePeriod')?.value) { status.textContent = 'Pilih bulan dan tahun periode laporan terlebih dahulu sebelum mengunduh PDF.'; $('servicePeriod')?.focus(); return; }
    if (!window.jspdf?.jsPDF) { status.textContent = 'Generator PDF belum siap. Periksa koneksi internet, muat ulang halaman, lalu coba kembali.'; return; }
    let filtered;
    try { filtered = filterPeriod(report); } catch (error) { status.textContent = error.message; return; }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      if (typeof doc.autoTable !== 'function') throw new Error('Komponen tabel PDF belum termuat. Muat ulang halaman dan coba kembali.');
      const margin = 17;
      const pageWidth = 210;
      const center = pageWidth / 2;
      const isIOSBrowser = /iPad|iPhone|iPod/.test(navigator.userAgent);
      // Reserve a preview tab during the original click gesture; iOS may block
      // opening a new tab after PDF generation has completed.
      const iosPreviewWindow = isIOSBrowser ? window.open('about:blank', '_blank') : null;
      const reportDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
      const fmtClock = (date) => date ? fmtTime(date) : '—';
      const totalThorax = filtered.records.length;
      const completeCount = filtered.complete.length;
      const latePercent = completeCount ? (filtered.over / completeCount) * 100 : 0;
      const averageText = fmtDuration(filtered.average);

      // HALAMAN 1 — laporan utama mengikuti susunan contoh laporan RS.
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text('RUMAH SAKIT SETIA MITRA', center, 18, { align: 'center' });
      doc.setFontSize(10); doc.text('INSTALASI RADIOLOGI', center, 24, { align: 'center' });
      doc.setFontSize(12); doc.text('LAPORAN DAN EVALUASI WAKTU TUNGGU HASIL PELAYANAN FOTO THORAX', center, 36, { align: 'center', maxWidth: 178 });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(`Bulan : ${filtered.rangeLabel}`, margin, 49);

      doc.setFont('helvetica', 'bold'); doc.text('I.  Pemantauan', margin, 61);
      doc.autoTable({ startY: 66, margin: { left: margin, right: margin }, head: [['No', 'Variabel', 'Jumlah']], body: [
        ['1', 'Jumlah Foto Thorax dengan Waktu Tunggu kurang dari 8 Jam', fmtNumber(filtered.under)],
        ['2', 'Jumlah Foto Thorax dengan Waktu Tunggu 8 Jam atau Lebih', fmtNumber(filtered.over)],
        ['3', `Jumlah Total Foto Thorax Bulan ${filtered.rangeLabel}`, fmtNumber(totalThorax)],
        ['4', 'Jumlah Data Foto Thorax Tidak Lengkap', fmtNumber(filtered.incomplete)],
        ['5', 'Persentase Waktu Tunggu kurang dari 8 Jam (dari Data Lengkap)', `${(filtered.percent * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`],
        ['6', 'Waktu Rata-rata Pelayanan Foto Thorax (Kedatangan-Selesai)', averageText]
      ], theme: 'grid', styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5, textColor: [20, 20, 20], lineColor: [90, 90, 90], lineWidth: 0.2 }, headStyles: { fillColor: [190, 225, 237], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center' }, columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 132 }, 2: { cellWidth: 34, halign: 'center' } } });

      let y = (doc.lastAutoTable?.finalY || 112) + 10;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('II.  Evaluasi', margin, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const evaluation1 = `Dari hasil pemantauan waktu tunggu pelayanan foto Thorax bulan ${filtered.rangeLabel} di Instalasi Radiologi RS Setia Mitra, didapatkan ${fmtNumber(filtered.over)} pasien (${latePercent.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%) yang mencapai atau melebihi standar waktu tunggu maksimal 8 jam. Waktu rata-rata pelayanan foto Thorax pada bulan ini adalah ${averageText}.`;
      const evaluation2 = `Hasil rata-rata waktu pelayanan foto Thorax sebesar ${averageText}. Hasil pemantauan ini menjadi bahan evaluasi alur pelayanan, ketersediaan dokter spesialis radiologi yang stand by di unit radiologi pada jam-jam tertentu, serta faktor operasional lainnya.`;
      const numbered = (num, text) => {
        const lines = doc.splitTextToSize(text, 168);
        doc.text(`${num}.`, margin, y);
        doc.text(lines, margin + 6, y);
        y += lines.length * 4.5 + 4;
      };
      numbered(1, evaluation1);
      numbered(2, evaluation2);
      y += 4;
      doc.setFont('helvetica', 'bold'); doc.text('III. Tindak Lanjut', margin, y); y += 7;
      doc.setFont('helvetica', 'normal');
      const followUp = 'Unit Radiologi akan melakukan evaluasi secara berkesinambungan serta berkoordinasi kembali dengan dokter spesialis radiologi dan pihak terkait dalam meningkatkan mutu waktu tunggu hasil pelayanan foto Thorax di RS Setia Mitra.';
      const followLines = doc.splitTextToSize(followUp, 176); doc.text(followLines, margin, y);
      y = Math.min(Math.max(y + followLines.length * 4.5 + 14, 245), 265);
      doc.text(`Jakarta, ${reportDate}`, 143, y, { align: 'center' });
      doc.text('Kepala Instalasi Radiologi', 143, y + 7, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.text('Eni Indrawati, Dipl. Rad', 143, y + 27, { align: 'center' });

      // HALAMAN 2 dst. — langsung seluruh data; halaman rekap terpisah dihilangkan.
      doc.addPage('a4', 'landscape');
      // Seluruh data ditampilkan berurutan dan header tabel diulang pada setiap halaman.
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('DATA WAKTU TUNGGU HASIL PELAYANAN', 148, 12, { align: 'center' });
      doc.setFontSize(10); doc.text(`PEMERIKSAAN FOTO THORAX ${filtered.rangeLabel.toLocaleUpperCase('id-ID')}`, 148, 18, { align: 'center' });
      // Format ringkas agar setiap baris muat satu baris: dd/mm/yy hh:mm dan durasi "7 jam 05 menit".
      const pdfDate = (date) => date ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(2)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '-';
      const pdfDuration = (minutes) => Number.isFinite(minutes) ? fmtDuration(minutes).replace(/^−/, '-') : '-';
      const dataBody = filtered.allRecords.map((record, index) => [
        index + 1, record.medicalRecord || '-', record.patient || '-', record.registrationNumber || '-',
        record.department || '-', record.exam || '-', pdfDate(record.registrationDate),
        pdfDate(record.inputDate), pdfDate(record.billingDate), pdfDate(record.arrivalDate), pdfDate(record.completionDate),
        pdfDuration(record.billingMinutes), pdfDuration(record.arrivalMinutes), record.status
      ]);
      // Lebar kolom total 280 mm (A4 landscape dikurangi margin 8,5 mm kiri dan kanan).
      const dataColumns = [7, 16, 34, 18, 34, 14, 18, 18, 18, 18, 18, 19, 19, 27];
      doc.autoTable({
        startY: 23,
        head: [['No', 'No. RM', 'Nama Pasien', 'No. Registrasi', 'Departemen', 'Pemeriksaan', 'Waktu Registrasi', 'Waktu Input', 'Konfirmasi Billing', 'Waktu Kedatangan', 'Waktu Selesai', 'Selisih\nSelesai -\nKonfirmasi', 'Selisih\nSelesai -\nKedatangan', 'Keterangan\nWaktu Tunggu']],
        body: dataBody,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 5.8, cellPadding: 0.9, overflow: 'linebreak', valign: 'middle', lineWidth: 0.1, textColor: [20, 20, 20], lineColor: [120, 120, 120] },
        headStyles: { fillColor: [190, 225, 237], textColor: [20, 20, 20], fontStyle: 'bold', halign: 'center', fontSize: 5.6 },
        columnStyles: Object.fromEntries(dataColumns.map((width, i) => [i, { cellWidth: width, halign: i === 0 || i === 1 || i === 3 || i >= 6 && i <= 10 ? 'center' : 'left' }])),
        margin: { top: 23, right: 8.5, bottom: 12, left: 8.5 },
        showHead: 'everyPage',
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        didDrawPage: (data) => {
          doc.setFontSize(7); doc.setFont('helvetica', 'normal');
          doc.text(`Periode ${filtered.rangeLabel} | Total ${filtered.allRecords.length} baris | Halaman ${data.pageNumber + 1}`, 148.5, 205, { align: 'center' });
        }
      });

      const safeName = String(fileName).replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '_');
      const periodSuffix = filtered.periodKey || 'Periode';
      const outputName = `Laporan_Waktu_Pelayanan_${periodSuffix}_${safeName}.pdf`;
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      let downloadMessage = `PDF berhasil dibuat: ${outputName}. Total data pemeriksaan: ${fmtNumber(filtered.allRecords.length)} baris.`;
      if (iosPreviewWindow && !iosPreviewWindow.closed) {
        // iOS Safari/Chrome generally previews PDFs instead of honoring download=.
        iosPreviewWindow.location.href = blobUrl;
        downloadMessage = `PDF berhasil dibuat dan dibuka pada tab baru: ${outputName}. Gunakan tombol Bagikan/Simpan pada pratinjau PDF.`;
      } else {
        const link = document.createElement('a');
        link.href = blobUrl; link.download = outputName; link.rel = 'noopener';
        document.body.appendChild(link); link.click(); link.remove();
      }
      // Tautan cadangan: jika unduhan otomatis diblokir browser, pengguna tetap bisa mengunduh.
      const fallback = document.createElement('a');
      fallback.href = blobUrl; fallback.download = outputName; fallback.rel = 'noopener';
      fallback.textContent = 'Klik di sini untuk mengunduh PDF';
      fallback.className = 'service-pdf-fallback';
      status.replaceChildren(document.createTextNode(`${downloadMessage} `), fallback);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
    } catch (error) {
      console.error('Gagal membuat PDF waktu pelayanan:', error);
      status.textContent = `Gagal membuat PDF: ${error?.message || 'Terjadi kesalahan tidak diketahui'}. Coba muat ulang halaman dan ulangi.`;
    }
  }

  function init() {
    const input = $('serviceImportFile');
    if (!input) return;
    const periodInput = $('servicePeriod');
    // Hindari disabled dinamis pada input file di dalam label karena beberapa
    // browser mobile tidak membuka file picker setelah statusnya diubah.
    input.disabled = false;
    input.addEventListener('change', () => handleFile(input.files?.[0]));
    if (periodInput) {
      periodInput.value = '';
      const syncPeriod = () => {
        if (!periodInput.value) {
          input.value = '';
          $('serviceCurrentReport')._report = null;
          $('serviceReportResult').hidden = true;
          $('serviceDownloadPdf').disabled = true;
          $('serviceImportStatus').textContent = 'Pilih bulan dan tahun sebelum mengunggah file.';
        } else if ($('serviceCurrentReport')._report) {
          applyAndRender();
        } else {
          $('serviceImportStatus').textContent = 'Periode dipilih. Silakan pilih file Excel atau PDF.';
        }
      };
      periodInput.addEventListener('input', syncPeriod);
      periodInput.addEventListener('change', syncPeriod);
    }
    $('serviceDownloadPdf').addEventListener('click', downloadPdf);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
