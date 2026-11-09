(() => {
  'use strict';
  const key = 'rekap-radiologi-service-time-v1';
  const $ = (id) => document.getElementById(id);
  function readAll() {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
  }
  function minutes(value) {
    if (!Number.isFinite(value)) return '—';
    const m = Math.round(value);
    return `${Math.floor(m / 60)} jam ${String(m % 60).padStart(2, '0')} menit`;
  }
  function render() {
    const monthly = $('serviceMonthly');
    const recent = $('serviceRecent');
    if (!monthly || !recent) return;
    const entries = Object.entries(readAll()).flatMap(([date, list]) => Array.isArray(list) ? list.map((item) => ({ ...item, date: item.date || date })) : [])
      .filter((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(entry.minutes));
    const map = new Map();
    entries.forEach((entry) => {
      const month = entry.date.slice(0, 7);
      const value = map.get(month) || { thoraxSum: 0, thoraxN: 0, allSum: 0, allN: 0 };
      value.allSum += entry.minutes;
      value.allN += 1;
      if (entry.type === 'thorax') { value.thoraxSum += entry.minutes; value.thoraxN += 1; }
      map.set(month, value);
    });
    const rows = [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
    monthly.innerHTML = rows.length ? `<table><thead><tr><th>Bulan</th><th>Jumlah Thorax</th><th>Rata-rata Thorax</th><th>Jumlah semua pemeriksaan</th><th>Rata-rata keseluruhan</th></tr></thead><tbody>${rows.map(([month, value]) => `<tr><th>${month}</th><td>${value.thoraxN}</td><td>${minutes(value.thoraxN ? value.thoraxSum / value.thoraxN : NaN)}</td><td>${value.allN}</td><td>${minutes(value.allN ? value.allSum / value.allN : NaN)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada catatan waktu pelayanan.</p>';
    const list = entries.slice().sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`)).slice(0, 30);
    recent.innerHTML = list.length ? `<table><thead><tr><th>Tanggal</th><th>Kelompok</th><th>Mulai</th><th>Selesai</th><th>Durasi</th></tr></thead><tbody>${list.map((entry) => `<tr><td>${entry.date}</td><td>${entry.type === 'thorax' ? 'Thorax' : 'Pemeriksaan lainnya'}</td><td>${entry.start || '—'}</td><td>${entry.end || '—'}</td><td>${minutes(entry.minutes)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada catatan waktu pelayanan.</p>';
  }
  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('service-import-complete', render);
  window.addEventListener('storage', (event) => { if (!event.key || event.key === key) render(); });
  if (document.readyState !== 'loading') render();
})();
