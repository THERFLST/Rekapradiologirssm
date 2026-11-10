/* reminder.js v1 — Reminder USG: catat pasien (nama, WA, tanggal periksa) dan kirim pengingat via WhatsApp hanya pada H-1. */
(function () {
  'use strict';
  var KEY = 'rekap-radiologi-reminder-usg-v1', TKEY = 'rekap-radiologi-reminder-usg-template-v1';
  var DEFAULT_TPL = 'Halo {nama}, kami dari Instalasi Radiologi RS Setia Mitra mengingatkan bahwa jadwal pemeriksaan USG Anda adalah besok, {tanggal}. Mohon hadir tepat waktu. Jika berhalangan, silakan beri tahu kami. Terima kasih.';
  var MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var DAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var keyOf = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var obj = function (k) { return new Date(k + 'T12:00:00'); };
  var todayKey = function () { return keyOf(new Date()); };
  function addDays(k, n) { var d = obj(k); d.setDate(d.getDate() + n); return keyOf(d); }
  function longDate(k) { var d = obj(k); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function shortDate(k) { var d = obj(k); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function load() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
  function getTpl() { try { return localStorage.getItem(TKEY) || DEFAULT_TPL; } catch (e) { return DEFAULT_TPL; } }
  function setTpl(v) { try { localStorage.setItem(TKEY, v); } catch (e) {} }

  // 0812-3456-7890 / +62 812... / 812... -> 628123456789 (format wa.me)
  function normPhone(v) {
    var d = String(v).replace(/\D/g, '');
    if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.indexOf('8') === 0) d = '62' + d;
    return /^62\d{8,13}$/.test(d) ? d : '';
  }
  // siap = hari ini adalah H-1; tunggu = H-1 belum tiba; lewat = H-1 sudah terlewat
  function stateOf(p) { var t = todayKey(), h1 = addDays(p.tanggal, -1); return h1 === t ? 'siap' : h1 > t ? 'tunggu' : 'lewat'; }
  function fill(p) { return getTpl().replace(/\{nama\}/g, p.nama).replace(/\{tanggal\}/g, longDate(p.tanggal)); }

  var data = load(), filter = 'semua';

  function shell() {
    $('reminderApp').innerHTML =
      '<div id="rmBanner" class="rm-banner" role="status" aria-live="polite"></div>' +
      '<div id="rmQueue" class="rm-queue" hidden></div>' +
      '<form id="rmForm" class="rm-batch" autocomplete="off">' +
        '<div class="rm-batchhead"><h3>Input pasien</h3><label class="rm-same">Samakan tanggal semua baris<input id="rmSame" type="date"></label></div>' +
        '<div class="rm-rowshead"><span>#</span><span>Nama pasien</span><span>No. WhatsApp</span><span>Tanggal periksa</span><span></span></div>' +
        '<div id="rmRows" class="rm-rows"></div>' +
        '<div class="rm-batchfoot"><button type="button" id="rmAdd" class="secondary">+ Tambah baris</button><button type="button" id="rmAdd5" class="secondary">+ 5 baris</button><button class="primary-action" type="submit">Simpan Semua</button></div>' +
      '</form>' +
      '<p id="rmMsg" class="muted rm-msg" role="status" aria-live="polite"></p>' +
      '<details class="rm-tpl"><summary>Isi pesan reminder</summary>' +
        '<p class="hint">Gunakan {nama} dan {tanggal}; keduanya terisi otomatis untuk tiap pasien.</p>' +
        '<textarea id="rmTpl" rows="4"></textarea>' +
        '<button type="button" id="rmTplReset" class="secondary">Kembalikan bawaan</button>' +
      '</details>' +
      '<div class="rm-listhead"><h3>Data pasien</h3><div class="seg" id="rmFilter">' +
        '<button type="button" data-f="semua" class="on">Semua</button><button type="button" data-f="siap">Perlu dikirim</button><button type="button" data-f="terkirim">Terkirim</button>' +
      '</div></div><div id="rmList" class="rm-list"></div>';
    $('rmTpl').value = getTpl();
    renderRows([]);
  }

  function render() {
    var t = todayKey(), tomorrow = addDays(t, 1);
    var due = data.filter(function (p) { return stateOf(p) === 'siap' && p.status !== 'terkirim'; });
    var b = $('rmBanner');
    b.className = 'rm-banner' + (due.length ? ' is-due' : '');
    b.innerHTML = due.length
      ? '<div><strong>' + due.length + ' pasien perlu dikirimi reminder hari ini</strong><span>Pemeriksaan besok, ' + esc(longDate(tomorrow)) + '</span></div><button type="button" class="primary-action" data-act="queue">Kirim semua yang siap (' + due.length + ')</button>'
      : '<strong>Tidak ada reminder yang perlu dikirim hari ini</strong><span>Pasien dengan pemeriksaan besok (' + esc(shortDate(tomorrow)) + ') akan muncul di sini.</span>';

    var rows = data.slice().sort(function (a, c) { return a.tanggal < c.tanggal ? -1 : a.tanggal > c.tanggal ? 1 : a.nama.localeCompare(c.nama); })
      .filter(function (p) {
        if (filter === 'siap') return stateOf(p) === 'siap' && p.status !== 'terkirim';
        if (filter === 'terkirim') return p.status === 'terkirim';
        return true;
      });
    $('rmList').innerHTML = rows.length ? rows.map(item).join('') : '<p class="empty-state">' + (data.length ? 'Tidak ada data pada filter ini.' : 'Belum ada pasien. Isi formulir di atas untuk mencatat pasien pertama.') + '</p>';
    document.querySelectorAll('#rmFilter button').forEach(function (x) { x.classList.toggle('on', x.dataset.f === filter); });
  }

  function item(p) {
    var st = stateOf(p), sent = p.status === 'terkirim', h1 = addDays(p.tanggal, -1);
    var chip = sent ? '<span class="st is-ok">\u2713 Terkirim</span>'
      : st === 'siap' ? '<span class="st rm-ready">Siap dikirim</span>'
      : st === 'tunggu' ? '<span class="st">Bisa dikirim ' + esc(shortDate(h1)) + '</span>'
      : '<span class="st is-bad">Terlewat</span>';
    var can = st === 'siap';
    var tip = can ? '' : ' disabled title="Hanya bisa dikirim H-1 (' + esc(longDate(h1)) + ')"';
    return '<article class="rm-item' + (can && !sent ? ' is-due' : '') + '">' +
      '<div class="rm-main"><strong>' + esc(p.nama) + '</strong><span>+' + esc(p.wa) + '</span><small>Periksa: ' + esc(longDate(p.tanggal)) + '</small></div>' +
      '<div class="rm-side">' + chip + '<div class="rm-actions">' +
        '<button type="button" class="primary-action" data-act="send" data-id="' + esc(p.id) + '"' + tip + '>' + (sent ? 'Kirim ulang' : 'Kirim WA') + '</button>' +
        '<button type="button" class="danger" data-act="del" data-id="' + esc(p.id) + '">Hapus</button>' +
      '</div></div></article>';
  }

  function say(text, bad) { var m = $('rmMsg'); m.textContent = text; m.classList.toggle('bad', !!bad); }

  var MINROWS = 10;
  function rowHTML(i, v) {
    return '<div class="rm-row' + (v.bad ? ' is-bad' : '') + '"><span class="rm-no">' + (i + 1) + '</span>' +
      '<input class="rn" type="text" maxlength="80" placeholder="Nama lengkap" aria-label="Nama pasien baris ' + (i + 1) + '" value="' + esc(v.n || '') + '">' +
      '<input class="rw" type="tel" inputmode="tel" placeholder="0812xxxxxxxx" aria-label="No. WhatsApp baris ' + (i + 1) + '" value="' + esc(v.w || '') + '">' +
      '<input class="rt" type="date" min="' + todayKey() + '" aria-label="Tanggal pemeriksaan baris ' + (i + 1) + '" value="' + esc(v.t || '') + '">' +
      '<button type="button" class="rm-x" data-rm aria-label="Hapus baris ' + (i + 1) + '">\u00d7</button></div>';
  }
  function renderRows(vals) {
    var list = vals.slice(); while (list.length < MINROWS) list.push({});
    $('rmRows').innerHTML = list.map(function (v, i) { return rowHTML(i, v); }).join('');
  }
  function readRows() {
    return Array.prototype.map.call(document.querySelectorAll('#rmRows .rm-row'), function (r) {
      return { n: r.querySelector('.rn').value, w: r.querySelector('.rw').value, t: r.querySelector('.rt').value };
    });
  }
  function addRows(n) {
    var vals = readRows(); for (var i = 0; i < n; i++) vals.push({});
    renderRows(vals);
    var inputs = document.querySelectorAll('#rmRows .rn'); inputs[inputs.length - n].focus();
  }

  function onSubmit(e) {
    e.preventDefault();
    var rows = readRows(), saved = 0, keep = [], errs = [];
    rows.forEach(function (r, i) {
      if (!r.n.trim() && !r.w.trim() && !r.t) return;
      var nama = r.n.trim(), wa = normPhone(r.w), tgl = r.t, problem = '';
      if (!nama) problem = 'nama kosong';
      else if (!wa) problem = 'No. WA tidak valid';
      else if (!tgl) problem = 'tanggal kosong';
      else if (tgl < todayKey()) problem = 'tanggal sudah lewat';
      else if (data.some(function (p) { return p.wa === wa && p.tanggal === tgl; })) problem = 'sudah tercatat';
      if (problem) { keep.push({ n: r.n, w: r.w, t: r.t, bad: true }); errs.push('Baris ' + (i + 1) + ': ' + problem); return; }
      data.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nama: nama, wa: wa, tanggal: tgl, status: 'belum', dibuat: new Date().toISOString() });
      saved++;
    });
    if (!saved && !errs.length) return say('Belum ada data yang diisi.', true);
    if (saved && !save(data)) return say('Gagal menyimpan: ruang browser penuh.', true);
    renderRows(keep);
    say((saved ? saved + ' pasien tersimpan. ' : '') + (errs.length ? 'Perlu diperbaiki \u2192 ' + errs.join('; ') + '.' : ''), errs.length > 0);
    render();
  }

  var queue = [], qTotal = 0;
  function renderQueue() {
    var q = $('rmQueue');
    if (!queue.length) { q.hidden = true; q.innerHTML = ''; return; }
    var p = data.filter(function (x) { return x.id === queue[0]; })[0];
    q.hidden = false;
    q.innerHTML = '<div><strong>Antrean kirim ' + (qTotal - queue.length + 1) + ' dari ' + qTotal + '</strong><span>Berikutnya: ' + esc(p ? p.nama : '') + '</span></div>' +
      '<div class="rm-actions"><button type="button" class="primary-action" data-act="next">Buka WhatsApp \u2192 ' + esc(p ? p.nama : '') + '</button><button type="button" class="danger" data-act="cancel">Batal</button></div>';
  }
  function startQueue() {
    queue = data.filter(function (p) { return stateOf(p) === 'siap' && p.status !== 'terkirim'; })
      .sort(function (a, c) { return a.nama.localeCompare(c.nama); }).map(function (p) { return p.id; });
    qTotal = queue.length; renderQueue();
  }
  function sendNext() {
    var id = queue.shift(), p = data.filter(function (x) { return x.id === id; })[0];
    if (p && stateOf(p) === 'siap') {
      window.open('https://wa.me/' + p.wa + '?text=' + encodeURIComponent(fill(p)), '_blank', 'noopener');
      p.status = 'terkirim'; p.dikirim = new Date().toISOString(); save(data);
    }
    if (!queue.length) say('Antrean selesai. Pastikan tombol kirim sudah ditekan di WhatsApp untuk setiap pasien.');
    renderQueue(); render();
  }

  function onListClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var p = data.filter(function (x) { return x.id === btn.dataset.id; })[0];
    if (!p) return;
    if (btn.dataset.act === 'del') {
      if (!confirm('Hapus ' + p.nama + ' dari daftar reminder?')) return;
      data = data.filter(function (x) { return x !== p; }); save(data); render(); return;
    }
    if (stateOf(p) !== 'siap') return say('Reminder hanya bisa dikirim pada H-1.', true);
    window.open('https://wa.me/' + p.wa + '?text=' + encodeURIComponent(fill(p)), '_blank', 'noopener');
    p.status = 'terkirim'; p.dikirim = new Date().toISOString(); save(data);
    say('WhatsApp dibuka untuk ' + p.nama + '. Tekan tombol kirim di WhatsApp untuk menyelesaikan.');
    render();
  }

  function init() {
    if (!$('reminderApp')) return;
    shell(); render();
    $('rmForm').addEventListener('submit', onSubmit);
    $('rmAdd').addEventListener('click', function () { addRows(1); });
    $('rmAdd5').addEventListener('click', function () { addRows(5); });
    $('rmSame').addEventListener('change', function (e) { document.querySelectorAll('#rmRows .rt').forEach(function (i) { i.value = e.target.value; }); });
    $('rmRows').addEventListener('click', function (e) {
      var x = e.target.closest('[data-rm]'); if (!x) return;
      var row = x.closest('.rm-row'), rows = document.querySelectorAll('#rmRows .rm-row');
      if (rows.length > MINROWS) { var vals = readRows(); vals.splice(Array.prototype.indexOf.call(rows, row), 1); renderRows(vals); }
      else row.querySelectorAll('input').forEach(function (i) { i.value = ''; });
    });
    $('rmBanner').addEventListener('click', function (e) { if (e.target.closest('[data-act="queue"]')) startQueue(); });
    $('rmQueue').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'next') sendNext(); else { queue = []; renderQueue(); }
    });
    $('rmList').addEventListener('click', onListClick);
    $('rmFilter').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; render(); } });
    $('rmTpl').addEventListener('input', function (e) { setTpl(e.target.value); });
    $('rmTplReset').addEventListener('click', function () { $('rmTpl').value = DEFAULT_TPL; setTpl(DEFAULT_TPL); });
    // segarkan status H-1 setiap modul dibuka (mis. tab dibiarkan terbuka semalaman)
    var v = $('v-reminder');
    if (v) new MutationObserver(function () { if (!v.hidden) { render(); } }).observe(v, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
