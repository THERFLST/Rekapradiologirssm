(() => {
  'use strict';

  const USG_KEY = 'rekap-radiologi-usg-v1';
  const SERVICE_KEY = 'rekap-radiologi-service-time-v1';
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
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
  const todayKey = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const fmt = (n) => Number(n || 0).toLocaleString('id-ID');
  const read = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      console.error(`Gagal membaca ${key}`, error);
      return {};
    }
  };
  const monthLabel = (key) => {
    const [year, month] = key.split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
  };

  function renderUsgFields() {
    $('usgFields').innerHTML = USG_TYPES.map(([key, label]) => `
      <label class="usg-field">${label}<input type="number" min="0" step="1" inputmode="numeric" data-usg-type="${key}" value=""></label>`).join('');
  }

  function loadUsgDate() {
    const date = $('usgDate').value;
    const record = read(USG_KEY)[date] || {};
    document.querySelectorAll('[data-usg-type]').forEach((input) => {
      input.value = record[input.dataset.usgType] ?? '';
    });
  }

  function renderUsgMonthly() {
    const records = read(USG_KEY);
    const months = new Map();
    Object.entries(records).forEach(([date, record]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !record || typeof record !== 'object') return;
      const key = date.slice(0, 7);
      const row = months.get(key) || { total: 0, byType: Object.fromEntries(USG_TYPES.map(([type]) => [type, 0])) };
      USG_TYPES.forEach(([type]) => {
        const count = Number(record[type]);
        if (Number.isFinite(count) && count > 0) {
          row.byType[type] += count;
          row.total += count;
        }
      });
      months.set(key, row);
    });
    const rows = [...months.entries()].sort(([a], [b]) => b.localeCompare(a));
    $('usgMonthly').innerHTML = rows.length ? `<table><thead><tr><th>Bulan</th>${USG_TYPES.map(([, label]) => `<th>${label}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows.map(([key, row]) => `<tr><th>${monthLabel(key)}</th>${USG_TYPES.map(([type]) => `<td>${fmt(row.byType[type])}</td>`).join('')}<td><strong>${fmt(row.total)}</strong></td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada rekap USG.</p>';
  }

  function saveUsg() {
    const date = $('usgDate').value;
    if (!date) {
      $('usgStatus').textContent = 'Pilih tanggal terlebih dahulu.';
      return;
    }
    const record = {};
    for (const input of document.querySelectorAll('[data-usg-type]')) {
      const raw = input.value.trim();
      if (raw && (!Number.isInteger(Number(raw)) || Number(raw) < 0)) {
        input.focus();
        $('usgStatus').textContent = 'Jumlah harus berupa bilangan bulat nol atau lebih.';
        return;
      }
      if (raw !== '') record[input.dataset.usgType] = Number(raw);
    }
    const records = read(USG_KEY);
    if (Object.keys(record).length) records[date] = record;
    else delete records[date];
    localStorage.setItem(USG_KEY, JSON.stringify(records));
    $('usgStatus').textContent = 'Rekap USG tersimpan di browser ini.';
    renderUsgMonthly();
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
      loadUsgDate();
      renderUsgMonthly();
    } else {
      renderServiceReports();
    }
  }

  function init() {
    renderUsgFields();
    $('usgDate').value = todayKey();
    $('serviceDate').value = todayKey();
    loadUsgDate();
    renderUsgMonthly();
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
    $('usgDate').addEventListener('change', loadUsgDate);
    $('saveUsg').addEventListener('click', saveUsg);
    $('saveService').addEventListener('click', saveServiceTime);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
