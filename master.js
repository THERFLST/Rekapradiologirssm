(() => {
  'use strict';

  const CONFIG_KEY = 'rekap-radiologi-master-types-v1';
  const CUSTOM_DATA_KEY = 'rekap-radiologi-master-data-v1';
  const CONV_BUILT_INS = [
    'Thorax PA', 'Thorax PA & Lat', 'Extremitas', 'Extremitas Bilateral', 'Columna Vertebralis',
    'Columna Vert 4 Posisi', 'Cranium', 'Sinus', 'BNO/Abdomen', 'Abdomen 3 Posisi', 'Pelvis',
    'Pelvis 2 Posisi', 'OMD/Oesophagografi', 'MD', 'Arthrografi', 'Cholecystografi', 'Urethrocystografi',
    'HSG', 'Colon Inloop (B. Enema)', 'BNO-IVP', 'RPG', 'COR Analisa', 'Appendicogram'
  ];
  const USG_BUILT_INS = ['USG Abdomen', 'USG Obstetri', 'USG Ginjal/Traktus Urinarius', 'USG Tiroid', 'USG Mammae', 'USG Scrotum', 'USG Muskuloskeletal', 'USG Lainnya'];
  const $ = (id) => document.getElementById(id);
  let refreshTimer;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
    } catch (error) {
      console.error(`Gagal membaca ${key}`, error);
      return fallback;
    }
  }

  function config() {
    const value = read(CONFIG_KEY, {});
    return {
      konvensional: Array.isArray(value.konvensional) ? value.konvensional : [],
      usg: Array.isArray(value.usg) ? value.usg : []
    };
  }

  function customData() {
    const value = read(CUSTOM_DATA_KEY, {});
    return {
      konvensional: value.konvensional && typeof value.konvensional === 'object' ? value.konvensional : {},
      usg: value.usg && typeof value.usg === 'object' ? value.usg : {}
    };
  }

  function saveConfig(value) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function activeDate(modality) {
    return modality === 'usg' ? $('usgDate')?.value : $('date')?.value;
  }

  function activeRange() {
    const controls = $('rekapCtl');
    if (!controls) return [];
    const mode = controls.querySelector('[data-mode].on')?.dataset.mode || 'harian';
    const ref = controls.querySelector('input')?.value || $('date')?.value || new Date().toISOString().slice(0, 10);
    if (mode === 'harian') return [ref];
    if (mode === 'mingguan') {
      const start = new Date(`${ref}T12:00:00`);
      start.setDate(start.getDate() - (start.getDay() + 6) % 7);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      });
    }
    const [year, month] = ref.slice(0, 7).split('-').map(Number);
    const count = new Date(year, month, 0).getDate();
    return Array.from({ length: count }, (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`);
  }

  function getCount(entry, modality, kind) {
    if (modality === 'usg') return Number(entry?.patients) || 0;
    return Number(entry?.[kind]) || 0;
  }

  function renderCustomReport() {
    const records = customData();
    const types = config();
    const convWrap = $('masterConventionalReport');
    if (convWrap) {
      const period = activeRange();
      const rows = types.konvensional.map((type) => {
        const patients = period.reduce((sum, date) => sum + getCount(records.konvensional[date]?.[type.id], 'konvensional', 'patients'), 0);
        const exposures = period.reduce((sum, date) => sum + getCount(records.konvensional[date]?.[type.id], 'konvensional', 'exposures'), 0);
        return `<tr><td>${escapeHtml(type.name)}</td><td>${escapeHtml(type.group)}</td><td>${patients.toLocaleString('id-ID')}</td><td>${exposures.toLocaleString('id-ID')}</td></tr>`;
      });
      convWrap.innerHTML = rows.length ? `<section class="panel"><div class="section-title"><h3>Pemeriksaan tambahan</h3></div><div class="scroll"><table><thead><tr><th>Jenis</th><th>Kelompok</th><th>Pasien</th><th>Ekspose</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>` : '';
    }

    const usgWrap = $('masterUsgReport');
    if (usgWrap) {
      const period = window.masterUsgPeriod ? window.masterUsgPeriod() : [activeDate('usg')].filter(Boolean);
      const rows = types.usg.map((type) => {
        const total = period.reduce((sum, date) => sum + getCount(records.usg[date]?.[type.id], 'usg', 'patients'), 0);
        return `<tr><td>${escapeHtml(type.name)}</td><td>${total.toLocaleString('id-ID')}</td></tr>`;
      });
      usgWrap.innerHTML = rows.length ? `<section class="panel"><div class="section-title"><h3>Pemeriksaan tambahan</h3></div><div class="scroll"><table><thead><tr><th>Jenis</th><th>Jumlah</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>` : '';
    }
  }

  function saveCustomValue(modality, date, id, kind, value) {
    if (!date) return;
    const values = customData();
    values[modality][date] ||= {};
    values[modality][date][id] ||= {};
    values[modality][date][id][kind] = value === '' ? '' : Number(value);
    localStorage.setItem(CUSTOM_DATA_KEY, JSON.stringify(values));
    renderCustomReport();
  }

  function appendConvFields() {
    const host = $('exams');
    if (!host) return;
    const current = config().konvensional;
    let block = $('masterConvFields');
    if (!block) {
      block = document.createElement('section');
      block.id = 'masterConvFields';
      block.className = 'master-exam-section';
      host.appendChild(block);
    }
    const values = customData().konvensional[$('date')?.value] || {};
    block.innerHTML = current.length ? `<h4>Pemeriksaan tambahan</h4><div class="exam-grid">${current.map((type) => {
      const value = values[type.id] || {};
      return `<div class="exam-row"><strong>${escapeHtml(type.name)}</strong><label>Pasien<input type="number" min="0" step="1" inputmode="numeric" data-master-type="${type.id}" data-master-kind="patients" value="${value.patients ?? ''}"></label><label>Ekspose<input type="number" min="0" step="1" inputmode="numeric" data-master-type="${type.id}" data-master-kind="exposures" value="${value.exposures ?? ''}"></label></div>`;
    }).join('')}</div>` : '';
    block.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        if (input.value !== '' && (!Number.isInteger(Number(input.value)) || Number(input.value) < 0)) {
          input.setCustomValidity('Masukkan bilangan bulat nol atau lebih.');
          input.reportValidity();
          return;
        }
        input.setCustomValidity('');
        saveCustomValue('konvensional', $('date')?.value, input.dataset.masterType, input.dataset.masterKind, input.value);
      });
    });
  }

  function appendUsgFields() {
    const host = $('usgExamFields');
    if (!host) return;
    const current = config().usg;
    let block = $('masterUsgFields');
    if (!block) {
      block = document.createElement('div');
      block.id = 'masterUsgFields';
      block.className = 'exam-grid master-usg-fields';
      host.after(block);
    }
    const values = customData().usg[$('usgDate')?.value] || {};
    block.innerHTML = current.map((type) => {
      const value = values[type.id] || {};
      return `<div class="exam-row"><strong>${escapeHtml(type.name)}</strong><label>Jumlah<input type="number" min="0" step="1" inputmode="numeric" data-master-usg="${type.id}" value="${value.patients ?? ''}"></label></div>`;
    }).join('');
    block.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        if (input.value !== '' && (!Number.isInteger(Number(input.value)) || Number(input.value) < 0)) {
          input.setCustomValidity('Masukkan bilangan bulat nol atau lebih.');
          input.reportValidity();
          return;
        }
        input.setCustomValidity('');
        saveCustomValue('usg', $('usgDate')?.value, input.dataset.masterUsg, 'patients', input.value);
      });
    });
  }

  function scheduleInjection() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      appendConvFields();
      appendUsgFields();
      renderCustomReport();
    }, 30);
  }

  function renderMasterLists() {
    const types = config();
    const makeList = (modality, builtIns) => {
      const builtinHtml = builtIns.map((name) => `<li><span>${escapeHtml(name)}</span><small>Bawaan</small></li>`).join('');
      const customHtml = types[modality].map((type) => `<li><span>${escapeHtml(type.name)}${modality === 'konvensional' ? ` <small>${escapeHtml(type.group)}</small>` : ''}</span><button type="button" class="master-remove" data-remove-modality="${modality}" data-remove-id="${type.id}">Hapus</button></li>`).join('');
      return `<ul class="master-list">${builtinHtml}${customHtml || '<li class="muted">Belum ada jenis tambahan.</li>'}</ul>`;
    };
    $('masterConventionalList').innerHTML = makeList('konvensional', CONV_BUILT_INS);
    $('masterUsgList').innerHTML = makeList('usg', USG_BUILT_INS);
  }

  function showModule(module) {
    document.querySelectorAll('.view').forEach((view) => {
      view.classList.remove('on');
      if (view.id.startsWith('v-')) view.hidden = view.id !== `v-${module}`;
    });
    document.querySelector('.conventional-nav').hidden = module !== 'konvensional';
    document.body.dataset.activeModule = module;
    $('mainMenu').hidden = true;
    $('mainMenuToggle').setAttribute('aria-expanded', 'false');
    if (module === 'konvensional') {
      const active = document.querySelector('.conventional-nav button.on') || document.querySelector('[data-view="isi"]');
      active?.click();
    } else {
      const panel = $(`v-${module}`);
      if (panel) {
        panel.hidden = false;
        panel.classList.add('on');
      }
      if (module === 'master') renderMasterLists();
      history.replaceState(null, '', `#${module}`);
      window.scrollTo({ top: 0 });
    }
  }

  function init() {
    const form = $('masterForm');
    const modality = $('masterModality');
    const groupWrap = $('masterGroupWrap');
    modality.addEventListener('change', () => { groupWrap.hidden = modality.value !== 'konvensional'; });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('masterExamName').value.trim();
      if (!name) return;
      const list = config();
      const current = list[modality.value];
      if ([...current.map((item) => item.name), ...(modality.value === 'usg' ? USG_BUILT_INS : CONV_BUILT_INS)].some((item) => item.toLocaleLowerCase('id-ID') === name.toLocaleLowerCase('id-ID'))) {
        $('masterStatus').textContent = 'Jenis pemeriksaan tersebut sudah ada.';
        return;
      }
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      current.push({ id, name, ...(modality.value === 'konvensional' ? { group: $('masterExamGroup').value } : {}) });
      saveConfig(list);
      form.reset();
      groupWrap.hidden = false;
      $('masterStatus').textContent = `${name} ditambahkan ke ${modality.value === 'usg' ? 'Rekap USG' : 'Rekap Konvensional'}.`;
      renderMasterLists();
      appendConvFields();
      appendUsgFields();
    });

    document.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-modality]');
      if (remove) {
        const { removeModality, removeId } = remove.dataset;
        if (!confirm('Hapus jenis pemeriksaan tambahan ini dari daftar? Data lama yang sudah dicatat tidak dihapus, tetapi tidak lagi ditampilkan.')) return;
        const list = config();
        list[removeModality] = list[removeModality].filter((item) => item.id !== removeId);
        saveConfig(list);
        renderMasterLists();
        appendConvFields();
        appendUsgFields();
      }

      const moduleButton = event.target.closest('#mainMenu [data-module="master"]');
      if (moduleButton) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showModule('master');
      }
    }, true);

    const menuToggle = $('mainMenuToggle');
    const menu = $('mainMenu');
    menuToggle.addEventListener('click', (event) => {
      event.stopImmediatePropagation();
      menu.hidden = !menu.hidden;
      menuToggle.setAttribute('aria-expanded', String(!menu.hidden));
    }, true);

    $('masterModality').dispatchEvent(new Event('change'));
    renderMasterLists();
    const observe = (id) => {
      const target = $(id);
      if (target) new MutationObserver(scheduleInjection).observe(target, { childList: true, subtree: true });
    };
    observe('exams');
    observe('rekapOut');
    observe('usgExamFields');
    observe('usgReportOutput');
    document.addEventListener('change', (event) => {
      if (event.target.id === 'date' || event.target.id === 'usgDate' || event.target.closest('#rekapCtl')) scheduleInjection();
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest('.conventional-nav')) scheduleInjection();
    });
    scheduleInjection();
  }

  window.masterUsgPeriod = () => {
    const controls = $('usgReportControls');
    const mode = controls?.querySelector('[data-usg-mode].on')?.dataset.usgMode || 'bulanan';
    const ref = controls?.querySelector('input')?.value || new Date().toISOString().slice(0, 10);
    if (mode === 'harian') return [ref];
    if (mode === 'mingguan') {
      const date = new Date(`${ref}T12:00:00`);
      date.setDate(date.getDate() - (date.getDay() + 6) % 7);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(date);
        day.setDate(date.getDate() + index);
        return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      });
    }
    const [year, month] = ref.slice(0, 7).split('-').map(Number);
    return Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
