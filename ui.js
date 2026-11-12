/* ui.js v1 — sidebar, tombol tema (terang/gelap). Tidak mengubah logika modul; hanya membaca keadaan tampilan. */
(function () {
  'use strict';
  var KEY = 'rekap-radiologi-theme';
  var $ = function (id) { return document.getElementById(id); };
  var svg = function (p) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; };
  var ICON = {
    konvensional: svg('<path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v11"/>'),
    usg: svg('<path d="M3 12h3l2-6 4 12 3-9 2 3h4"/>'),
    waktu: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    reminder: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    master: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    logo: svg('<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>')
  };
  var SHORT = { konvensional: 'Konvensional', usg: 'USG', waktu: 'Waktu', reminder: 'Reminder', master: 'Master' };

  function currentTheme() {
    try { var s = localStorage.getItem(KEY); if (s === 'dark' || s === 'light') return s; } catch (e) {}
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(t, save) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0d1417' : '#f4f7f8');
    if (save) { try { localStorage.setItem(KEY, t); } catch (e) {} }
    var b = $('themeToggle');
    if (b) {
      b.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;
      var label = t === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap';
      b.setAttribute('aria-label', label); b.title = label;
    }
  }

  function buildSidebar() {
    var menu = $('mainMenu');
    if (!menu || menu.dataset.sidebar) return;
    menu.dataset.sidebar = '1';
    menu.querySelectorAll('button[data-module]').forEach(function (b) {
      var m = b.dataset.module, full = b.textContent.trim();
      b.innerHTML = '<span class="mi">' + (ICON[m] || '') + '</span><span class="ml">' + full + '</span><span class="ms">' + (SHORT[m] || full) + '</span>';
      b.setAttribute('title', full);
    });
    var brand = document.createElement('div');
    brand.className = 'sb-brand';
    brand.innerHTML = '<span class="sb-logo">' + ICON.logo + '</span><div><b>Radiologi</b><small>RS Setia Mitra</small></div>';
    var label = document.createElement('div');
    label.className = 'sb-label'; label.textContent = 'Menu';
    menu.insertBefore(label, menu.firstChild);
    menu.insertBefore(brand, menu.firstChild);
  }

  function buildThemeToggle() {
    if ($('themeToggle')) return;
    var logout = $('logoutButton');
    if (!logout) return;
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'themeToggle'; b.className = 'theme-toggle';
    b.addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    });
    logout.parentNode.insertBefore(b, logout);
    applyTheme(currentTheme(), false);
  }

  // Modul aktif dibaca dari tampilan (class "on" & atribut hidden), jadi tetap benar
  // walau perpindahan modul ditangani oleh modules.js maupun master.js.
  function activeModule() {
    var order = ['usg', 'waktu', 'reminder', 'master'];
    for (var i = 0; i < order.length; i++) {
      var v = $('v-' + order[i]);
      if (v && !v.hidden && v.classList.contains('on')) return order[i];
    }
    return 'konvensional';
  }
  var TITLES = { konvensional: 'Rekap Konvensional', usg: 'Rekap USG', waktu: 'Laporan Waktu Pelayanan', reminder: 'Reminder USG', master: 'Master Pemeriksaan' };
  function syncActive() {
    var cur = activeModule();
    var sub = $('activeModuleSubtitle'); if (sub && TITLES[cur]) sub.textContent = TITLES[cur];
    document.querySelectorAll('#mainMenu button[data-module]').forEach(function (b) {
      var on = b.dataset.module === cur;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  function init() {
    buildSidebar();
    buildThemeToggle();
    syncActive();
    var obs = new MutationObserver(syncActive);
    ['v-usg', 'v-waktu', 'v-reminder', 'v-master', 'v-isi', 'v-rekap', 'v-export'].forEach(function (id) {
      var el = $(id);
      if (el) obs.observe(el, { attributes: true, attributeFilter: ['hidden', 'class'] });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('#mainMenu')) setTimeout(syncActive, 0);
    });
  }

  applyTheme(currentTheme(), false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
