(() => {
  'use strict';

  const SERVICE_KEY = 'rekap-radiologi-service-time-v1';
  const REQUIRED = {
    exam: ['pemeriksaan', 'jenis pemeriksaan'],
    registration: ['waktu registrasi'],
    arrival: ['waktu kedatangan'],
    completion: ['waktu selesai'],
    billingDuration: ['selisih waktu selesai-konfirmasi', 'selisih waktu (selesai-konfirmasi)'],
    arrivalDuration: ['selisih waktu selesai-kedatangan', 'selisih waktu (selesai-kedatangan)'],
    billingTime: ['konfirmasi billing']
  };

  const $ = (id) => document.getElementById(id);
  let previewEntries = [];

  function cleanHeader(value) {
    return String(value ?? '').trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');
  }

  function getColumnIndex(headers, candidates) {
    return headers.findIndex((header) => candidates.includes(cleanHeader(header)));
  }

  function readRows(file) {
    return file.arrayBuffer().then((buffer) => {
      if (!window.XLSX) throw new Error('Pemroses Excel belum siap. Coba muat ulang halaman atau periksa koneksi internet.');
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('File tidak memiliki sheet yang bisa dibaca.');
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
      const headerIndex = rows.findIndex((row) => {
        const normalized = row.map(cleanHeader);
        return normalized.includes('pemeriksaan') && normalized.includes('waktu selesai') && normalized.includes('waktu kedatangan');
      });
      if (headerIndex < 0) throw new Error('Header wajib tidak ditemukan. Pastikan ada kolom Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai.');
      const headers = rows[headerIndex];
      const columns = {
        exam: getColumnIndex(headers, REQUIRED.exam),
        registration: getColumnIndex(headers, REQUIRED.registration),
        arrival: getColumnIndex(headers, REQUIRED.arrival),
        completion: getColumnIndex(headers, REQUIRED.completion),
        billingDuration: getColumnIndex(headers, REQUIRED.billingDuration),
        arrivalDuration: getColumnIndex(headers, REQUIRED.arrivalDuration),
        billingTime: getColumnIndex(headers, REQUIRED.billingTime)
      };
      if (columns.exam < 0 || columns.arrival < 0 || columns.completion < 0) throw new Error('Kolom Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai wajib ada.');
      return rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell !== '')).map((row, index) => ({ row, index: index + 1, columns }));
    });
  }

  function excelDate(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value === 'number' && window.XLSX?.SSF) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (parts) return new Date(parts.y, parts.m - 1, parts.d, parts.H || 0, parts.M || 0, Math.floor(parts.S || 0));
    }
    const text = String(value ?? '').trim();
    if (!text) return null;
    const usDateTime = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (usDateTime) {
      const [, month, day, year, hour = '0', minute = '0', second = '0'] = usDateTime;
      const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function durationMinutes(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value >= 0 && value < 1 ? value * 24 * 60 : value;
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getUTCHours() * 60 + value.getUTCMinutes() + value.getUTCSeconds() / 60;
    const match = String(value ?? '').trim().match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60;
  }

  function hash(text) {
    let value = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      value ^= text.charCodeAt(index);
      value = Math.imul(value, 16777619);
    }
    return (value >>> 0).toString(36);
  }

  function parseRows(items) {
    const imported = [];
    let skipped = 0;
    const problems = [];

    items.forEach(({ row, index, columns }) => {
      const examText = String(row[columns.exam] ?? '').trim();
      const arrival = excelDate(row[columns.arrival]);
      const registration = columns.registration >= 0 ? excelDate(row[columns.registration]) : null;
      const completion = excelDate(row[columns.completion]);
      const billing = columns.billingTime >= 0 ? excelDate(row[columns.billingTime]) : null;
      const reportDate = arrival || registration || completion;
      if (!examText || !reportDate) {
        skipped += 1;
        if (problems.length < 8) problems.push(`Baris ${index + 1}: pemeriksaan atau tanggal tidak terbaca.`);
        return;
      }

      let confirmationMinutes = columns.billingDuration >= 0 ? durationMinutes(row[columns.billingDuration]) : null;
      let arrivalMinutes = columns.arrivalDuration >= 0 ? durationMinutes(row[columns.arrivalDuration]) : null;
      if (confirmationMinutes == null && completion && billing) confirmationMinutes = Math.max(0, (completion - billing) / 60000);
      if (arrivalMinutes == null && completion && arrival) arrivalMinutes = Math.max(0, (completion - arrival) / 60000);
      if (confirmationMinutes == null && arrivalMinutes == null) {
        skipped += 1;
        if (problems.length < 8) problems.push(`Baris ${index + 1}: tidak ada durasi yang bisa dibaca.`);
        return;
      }

      const type = /thorax/i.test(examText) ? 'thorax' : 'lainnya';
      const date = dateKey(reportDate);
      const signature = [date, examText.toLocaleLowerCase('id-ID'), String(row[columns.registration] ?? ''), String(row[columns.arrival] ?? ''), String(row[columns.completion] ?? ''), confirmationMinutes, arrivalMinutes].join('|');
      imported.push({
        importId: `sheet-${hash(signature)}`,
        source: 'spreadsheet',
        type,
        examCategory: type === 'thorax' ? 'Thorax' : 'Pemeriksaan lainnya',
        date,
        examText,
        confirmationMinutes: confirmationMinutes == null ? null : Math.round(confirmationMinutes * 100) / 100,
        arrivalMinutes: arrivalMinutes == null ? null : Math.round(arrivalMinutes * 100) / 100,
        minutes: arrivalMinutes ?? confirmationMinutes,
        createdAt: new Date().toISOString()
      });
    });

    return { imported, skipped, problems };
  }

  function readExisting() {
    try {
      const value = JSON.parse(localStorage.getItem(SERVICE_KEY) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function formatMinutes(value) {
    if (!Number.isFinite(value)) return '—';
    const rounded = Math.round(value);
    return `${Math.floor(rounded / 60)} jam ${String(rounded % 60).padStart(2, '0')} menit`;
  }

  function monthlyReport(entries) {
    const buckets = new Map();
    entries.forEach((entry) => {
      const key = entry.date.slice(0, 7);
      const month = buckets.get(key) || { thorax: { billing: 0, arrival: 0, countBilling: 0, countArrival: 0 }, all: { billing: 0, arrival: 0, countBilling: 0, countArrival: 0 } };
      const groups = [month.all];
      if (entry.type === 'thorax') groups.push(month.thorax);
      groups.forEach((group) => {
        if (Number.isFinite(entry.confirmationMinutes)) { group.billing += entry.confirmationMinutes; group.countBilling += 1; }
        if (Number.isFinite(entry.arrivalMinutes)) { group.arrival += entry.arrivalMinutes; group.countArrival += 1; }
      });
      buckets.set(key, month);
    });
    const rows = [...buckets.entries()].sort(([a], [b]) => b.localeCompare(a));
    return rows.length ? `<table><thead><tr><th>Bulan</th><th>Jumlah Thorax</th><th>Rata-rata selesai−konfirmasi billing</th><th>Rata-rata selesai−kedatangan</th><th>Jumlah keseluruhan</th><th>Rata-rata keseluruhan (billing)</th><th>Rata-rata keseluruhan (kedatangan)</th></tr></thead><tbody>${rows.map(([key, row]) => `<tr><th>${key}</th><td>${row.thorax.countArrival.toLocaleString('id-ID')}</td><td>${formatMinutes(row.thorax.countBilling ? row.thorax.billing / row.thorax.countBilling : NaN)}</td><td>${formatMinutes(row.thorax.countArrival ? row.thorax.arrival / row.thorax.countArrival : NaN)}</td><td>${row.all.countArrival.toLocaleString('id-ID')}</td><td>${formatMinutes(row.all.countBilling ? row.all.billing / row.all.countBilling : NaN)}</td><td>${formatMinutes(row.all.countArrival ? row.all.arrival / row.all.countArrival : NaN)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada data hasil import spreadsheet.</p>';
  }

  function renderImportedReport() {
    const host = $('serviceImportMonthly');
    if (!host) return;
    const entries = Object.values(readExisting()).flatMap((list) => Array.isArray(list) ? list : []).filter((entry) => entry?.source === 'spreadsheet' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
    host.innerHTML = monthlyReport(entries);
  }

  function renderPreview(entries, skipped, problems) {
    const preview = $('serviceImportPreview');
    const confirmButton = $('serviceImportConfirm');
    const status = $('serviceImportStatus');
    previewEntries = entries;
    confirmButton.hidden = entries.length === 0;
    const sample = entries.slice(0, 12);
    preview.innerHTML = sample.length ? `<table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Selesai−Billing</th><th>Selesai−Kedatangan</th></tr></thead><tbody>${sample.map((entry) => `<tr><td>${entry.date}</td><td>${entry.examCategory}</td><td>${formatMinutes(entry.confirmationMinutes)}</td><td>${formatMinutes(entry.arrivalMinutes)}</td></tr>`).join('')}</tbody></table>${entries.length > sample.length ? `<p class="hint">Pratinjau ${sample.length} dari ${entries.length} baris valid.</p>` : ''}` : '';
    status.textContent = `Terbaca: ${entries.length} baris valid; dilewati: ${skipped}.${problems.length ? ` ${problems.join(' ')}` : ''}`;
  }

  async function importFile() {
    const file = $('serviceImportFile').files?.[0];
    const status = $('serviceImportStatus');
    if (!file) {
      status.textContent = 'Pilih file Excel atau CSV terlebih dahulu.';
      return;
    }
    status.textContent = 'Sedang membaca file di browser…';
    $('serviceImportPreview').innerHTML = '';
    $('serviceImportConfirm').hidden = true;
    try {
      const parsed = parseRows(await readRows(file));
      renderPreview(parsed.imported, parsed.skipped, parsed.problems);
    } catch (error) {
      previewEntries = [];
      status.textContent = error instanceof Error ? error.message : 'File gagal dibaca.';
    }
  }

  function saveImported() {
    if (!previewEntries.length) return;
    const records = readExisting();
    const knownIds = new Set(Object.values(records).flatMap((list) => Array.isArray(list) ? list : []).map((entry) => entry?.importId).filter(Boolean));
    let added = 0;
    let duplicates = 0;
    previewEntries.forEach((entry) => {
      if (knownIds.has(entry.importId)) { duplicates += 1; return; }
      records[entry.date] = Array.isArray(records[entry.date]) ? records[entry.date] : [];
      records[entry.date].push(entry);
      knownIds.add(entry.importId);
      added += 1;
    });
    try {
      localStorage.setItem(SERVICE_KEY, JSON.stringify(records));
      $('serviceImportStatus').textContent = `Import selesai: ${added} baris disimpan; ${duplicates} duplikat dilewati. Informasi identitas tidak ikut disimpan.`;
      $('serviceImportConfirm').hidden = true;
      previewEntries = [];
      renderImportedReport();
      document.dispatchEvent(new CustomEvent('service-import-complete'));
    } catch (error) {
      $('serviceImportStatus').textContent = 'Gagal menyimpan: kapasitas browser mungkin tidak cukup.';
    }
  }

  function injectPanel() {
    const serviceView = $('v-waktu');
    if (!serviceView || $('serviceImportPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'serviceImportPanel';
    panel.className = 'panel service-import-panel';
    panel.innerHTML = `<div class="section-title"><div><h3>Import spreadsheet waktu pelayanan</h3><p class="muted">Membaca .xlsx, .xls, atau .csv. Kolom nama pasien dan No. RM diabaikan dan tidak disimpan.</p></div></div><div class="service-import-controls"><label for="serviceImportFile">Pilih file Excel/CSV<input id="serviceImportFile" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label><button id="serviceImportButton" class="primary-action" type="button">Baca &amp; Pratinjau</button></div><p class="hint">Tanggal laporan memakai Waktu Kedatangan (fallback: Waktu Registrasi). Durasi diambil dari kolom Selisih Waktu di file jika tersedia; jika tidak, dihitung dari tanggal/jam.</p><p id="serviceImportStatus" class="muted" role="status" aria-live="polite"></p><div id="serviceImportPreview" class="scroll"></div><button id="serviceImportConfirm" class="primary-action" type="button" hidden>Simpan data yang dipratinjau</button><div class="section-title import-report-heading"><div><h3>Rata-rata dari data import per bulan</h3><p class="hint">Laporan Thorax dan keseluruhan, dengan kedua patokan waktu spreadsheet.</p></div></div><div id="serviceImportMonthly" class="scroll"></div>`;
    serviceView.insertBefore(panel, $('serviceMonthly')?.closest('.module-report') || null);
    $('serviceImportButton').addEventListener('click', importFile);
    $('serviceImportConfirm').addEventListener('click', saveImported);
    renderImportedReport();
  }

  function init() {
    injectPanel();
    const serviceView = $('v-waktu');
    if (serviceView) new MutationObserver(injectPanel).observe(serviceView, { childList: true });
    document.addEventListener('service-import-complete', () => {
      if ($('serviceMonthly')) $('serviceStatus').textContent = 'Data import sudah disimpan. Laporan import terpisah menampilkan rata-rata Thorax dan keseluruhan.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
