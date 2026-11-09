(() => {
  'use strict';

  const SERVICE_KEY = 'rekap-radiologi-service-time-v1';
  const $ = (id) => document.getElementById(id);
  let pendingEntries = [];

  const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('id-ID').replace(/[()–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const fmtDuration = (minutes) => {
    if (!Number.isFinite(minutes)) return '—';
    const rounded = Math.round(minutes);
    return `${Math.floor(rounded / 60)} jam ${String(rounded % 60).padStart(2, '0')} menit`;
  };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function headerIndex(headers, candidates) {
    const keys = candidates.map(normalize);
    return headers.findIndex((header) => keys.includes(normalize(header)));
  }

  function findHeaderRow(rows) {
    return rows.findIndex((row) => {
      const headers = row.map(normalize);
      return headers.some((value) => value === 'pemeriksaan' || value === 'jenis pemeriksaan')
        && headers.includes('waktu selesai')
        && headers.includes('waktu kedatangan');
    });
  }

  function readDate(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value === 'number' && window.XLSX?.SSF) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (parts) return new Date(parts.y, parts.m - 1, parts.d, parts.H || 0, parts.M || 0, Math.floor(parts.S || 0));
    }
    const text = String(value ?? '').trim();
    if (!text) return null;
    const mdy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (mdy) {
      const [, month, day, year, hour = '0', minute = '0', second = '0'] = mdy;
      const result = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
      return Number.isNaN(result.getTime()) ? null : result;
    }
    const result = new Date(text);
    return Number.isNaN(result.getTime()) ? null : result;
  }

  function readDuration(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value >= 0 && value < 1 ? value * 1440 : value;
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.getUTCHours() * 60 + value.getUTCMinutes() + value.getUTCSeconds() / 60;
    const match = String(value ?? '').trim().match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60;
  }

  function fingerprint(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  async function parseFile(file) {
    if (!window.XLSX) throw new Error('Pemroses Excel belum siap. Muat ulang halaman dan coba lagi.');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error('Tidak ada sheet yang dapat dibaca.');
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    const start = findHeaderRow(rows);
    if (start < 0) throw new Error('Header tidak dikenali. Pastikan ada kolom Pemeriksaan, Waktu Kedatangan, dan Waktu Selesai.');
    const headers = rows[start];
    const columns = {
      exam: headerIndex(headers, ['Pemeriksaan', 'Jenis Pemeriksaan']),
      registration: headerIndex(headers, ['Waktu Registrasi']),
      billing: headerIndex(headers, ['Konfirmasi Billing']),
      arrival: headerIndex(headers, ['Waktu Kedatangan']),
      completion: headerIndex(headers, ['Waktu Selesai']),
      billingDuration: headerIndex(headers, ['Selisih Waktu (Selesai-Konfirmasi)', 'Selisih Waktu Selesai-Konfirmasi']),
      arrivalDuration: headerIndex(headers, ['Selisih Waktu (Selesai-Kedatangan)', 'Selisih Waktu Selesai-Kedatangan'])
    };
    const valid = [];
    const issues = [];
    let skipped = 0;

    rows.slice(start + 1).forEach((row, offset) => {
      if (!row.some((cell) => String(cell ?? '').trim() !== '')) return;
      const examText = String(row[columns.exam] ?? '').trim();
      const arrival = readDate(row[columns.arrival]);
      const registration = columns.registration >= 0 ? readDate(row[columns.registration]) : null;
      const completion = readDate(row[columns.completion]);
      const billing = columns.billing >= 0 ? readDate(row[columns.billing]) : null;
      const reportDate = arrival || registration || completion;
      let fromBilling = columns.billingDuration >= 0 ? readDuration(row[columns.billingDuration]) : null;
      let fromArrival = columns.arrivalDuration >= 0 ? readDuration(row[columns.arrivalDuration]) : null;
      if (fromBilling == null && completion && billing) fromBilling = Math.max(0, (completion - billing) / 60000);
      if (fromArrival == null && completion && arrival) fromArrival = Math.max(0, (completion - arrival) / 60000);

      if (!examText || !reportDate || (fromBilling == null && fromArrival == null)) {
        skipped += 1;
        if (issues.length < 8) issues.push(`Baris ${start + offset + 2}: pemeriksaan, tanggal, atau durasi tidak terbaca.`);
        return;
      }

      const type = /thorax/i.test(examText) ? 'thorax' : 'lainnya';
      const date = dateKey(reportDate);
      // Deliberately exclude patient name and medical-record number from the fingerprint and stored record.
      const idText = [date, examText.toLocaleLowerCase('id-ID'), row[columns.registration], row[columns.billing], row[columns.arrival], row[columns.completion], fromBilling, fromArrival].join('|');
      valid.push({
        importId: `sheet-${fingerprint(idText)}`,
        source: 'spreadsheet',
        type,
        examCategory: type === 'thorax' ? 'Thorax' : 'Pemeriksaan lainnya',
        examText,
        date,
        confirmationMinutes: fromBilling == null ? null : Math.round(fromBilling * 100) / 100,
        arrivalMinutes: fromArrival == null ? null : Math.round(fromArrival * 100) / 100,
        minutes: fromArrival ?? fromBilling,
        createdAt: new Date().toISOString()
      });
    });
    return { valid, skipped, issues };
  }

  function getRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(SERVICE_KEY) || '{}');
      return records && typeof records === 'object' && !Array.isArray(records) ? records : {};
    } catch { return {}; }
  }

  function allEntries() {
    return Object.values(getRecords()).flatMap((list) => Array.isArray(list) ? list : [])
      .filter((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date));
  }

  function renderMonthly() {
    const host = $('serviceImportMonthly');
    if (!host) return;
    const buckets = new Map();
    allEntries().forEach((entry) => {
      const month = entry.date.slice(0, 7);
      const value = buckets.get(month) || { thorax: { billing: 0, billingN: 0, arrival: 0, arrivalN: 0 }, all: { billing: 0, billingN: 0, arrival: 0, arrivalN: 0 } };
      const groups = [value.all];
      if (entry.type === 'thorax') groups.push(value.thorax);
      groups.forEach((group) => {
        if (Number.isFinite(entry.confirmationMinutes)) { group.billing += entry.confirmationMinutes; group.billingN += 1; }
        if (Number.isFinite(entry.arrivalMinutes)) { group.arrival += entry.arrivalMinutes; group.arrivalN += 1; }
      });
      buckets.set(month, value);
    });
    const rows = [...buckets.entries()].sort(([a], [b]) => b.localeCompare(a));
    host.innerHTML = rows.length ? `<table><thead><tr><th>Bulan</th><th>Jumlah Thorax</th><th>Rata-rata selesai−konfirmasi billing</th><th>Rata-rata selesai−kedatangan</th><th>Jumlah seluruh pemeriksaan</th><th>Rata-rata keseluruhan (billing)</th><th>Rata-rata keseluruhan (kedatangan)</th></tr></thead><tbody>${rows.map(([month, value]) => `<tr><th>${month}</th><td>${value.thorax.arrivalN.toLocaleString('id-ID')}</td><td>${fmtDuration(value.thorax.billingN ? value.thorax.billing / value.thorax.billingN : NaN)}</td><td>${fmtDuration(value.thorax.arrivalN ? value.thorax.arrival / value.thorax.arrivalN : NaN)}</td><td>${value.all.arrivalN.toLocaleString('id-ID')}</td><td>${fmtDuration(value.all.billingN ? value.all.billing / value.all.billingN : NaN)}</td><td>${fmtDuration(value.all.arrivalN ? value.all.arrival / value.all.arrivalN : NaN)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada data waktu pelayanan.</p>';
  }

  function ensureReportHost() {
    const panel = $('serviceImportPanel');
    if (!panel || $('serviceImportMonthly')) return;
    const heading = document.createElement('div');
    heading.className = 'section-title import-report-heading';
    heading.innerHTML = '<div><h3>Rekap rata-rata waktu pelayanan</h3><p class="hint">Thorax dan seluruh pemeriksaan dihitung dari spreadsheet yang diimpor.</p></div>';
    const host = document.createElement('div');
    host.id = 'serviceImportMonthly';
    host.className = 'scroll';
    panel.append(heading, host);
  }

  function showPreview(result) {
    pendingEntries = result.valid;
    const rows = pendingEntries.slice(0, 12);
    $('serviceImportPreview').innerHTML = rows.length ? `<table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Selesai−Billing</th><th>Selesai−Kedatangan</th></tr></thead><tbody>${rows.map((entry) => `<tr><td>${entry.date}</td><td>${escapeHtml(entry.examCategory)}</td><td>${fmtDuration(entry.confirmationMinutes)}</td><td>${fmtDuration(entry.arrivalMinutes)}</td></tr>`).join('')}</tbody></table>${pendingEntries.length > 12 ? `<p class="hint">Menampilkan 12 dari ${pendingEntries.length} baris.</p>` : ''}` : '';
    $('serviceImportConfirm').hidden = pendingEntries.length === 0;
    $('serviceImportStatus').textContent = `Terbaca ${pendingEntries.length} baris; ${result.skipped} baris dilewati.${result.issues.length ? ` ${result.issues.join(' ')}` : ''}`;
  }

  async function readSelectedFile() {
    const file = $('serviceImportFile')?.files?.[0];
    if (!file) return;
    $('serviceImportStatus').textContent = 'File dipilih, sedang dibaca dan dianalisis di browser…';
    $('serviceImportPreview').replaceChildren();
    $('serviceImportConfirm').hidden = true;
    pendingEntries = [];
    try {
      showPreview(await parseFile(file));
    } catch (error) {
      $('serviceImportStatus').textContent = error instanceof Error ? error.message : 'File gagal dibaca.';
    }
  }

  function savePreview() {
    if (!pendingEntries.length) return;
    const records = getRecords();
    const known = new Set(allEntries().map((entry) => entry.importId).filter(Boolean));
    let added = 0;
    let duplicate = 0;
    pendingEntries.forEach((entry) => {
      if (known.has(entry.importId)) { duplicate += 1; return; }
      records[entry.date] = Array.isArray(records[entry.date]) ? records[entry.date] : [];
      records[entry.date].push(entry);
      known.add(entry.importId);
      added += 1;
    });
    try {
      localStorage.setItem(SERVICE_KEY, JSON.stringify(records));
      $('serviceImportStatus').textContent = `Selesai: ${added} baris disimpan; ${duplicate} duplikat dilewati. Nama dan No. RM tidak disimpan.`;
      $('serviceImportConfirm').hidden = true;
      pendingEntries = [];
      renderMonthly();
      $('serviceImportPreview').replaceChildren();
      window.dispatchEvent(new CustomEvent('service-import-complete'));
    } catch {
      $('serviceImportStatus').textContent = 'Gagal menyimpan: kapasitas penyimpanan browser mungkin tidak cukup.';
    }
  }

  function init() {
    if (!$('serviceImportPanel')) return;
    ensureReportHost();
    $('serviceImportFile').addEventListener('change', readSelectedFile);
    $('serviceImportButton').addEventListener('click', readSelectedFile);
    $('serviceImportConfirm').addEventListener('click', savePreview);
    renderMonthly();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
